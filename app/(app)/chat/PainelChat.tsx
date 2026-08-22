"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Disciplina = {
  id: string;
  nome: string;
  professor: string | null;
  periodo: string | null;
  documentos: number;
};

type Fonte = {
  titulo: string;
  referencia: string | null;
  similaridade: number;
  trecho: string;
  origemRecuperacao?: "vetorial" | "termos" | "ambos";
};

type Diagnostico = {
  origemIa: "gemini" | "local";
  similaridadeMaxima: number;
  admitiuNaoSaber: boolean;
  respostaFundamentada: boolean;
  bloqueada: "injecao" | "ilicito" | "dados-de-terceiros" | null;
  /** Preenchido quando a resposta veio do conhecimento geral, e não do material. */
  foraDoMaterial?: "instituicao" | "conteudo" | null;
  duracaoMs: number;
};

type Mensagem =
  | { autor: "aluno"; texto: string }
  | { autor: "assistente"; texto: string; fontes: Fonte[]; diagnostico: Diagnostico };

/** Uma pergunta já respondida, vinda do servidor ou do próprio navegador. */
type ItemHistorico = {
  id: string;
  disciplinaId: string;
  pergunta: string;
  resposta: string;
  fontes: Fonte[];
  criadoEm: string;
};

// Toda sugestão aqui é uma pergunta que o material responde. "Que conteúdo cai
// na aula de lógica fuzzy" saiu da lista: o cronograma diz que a aula é sobre
// lógica fuzzy, e não que assunto cai numa prova, então a resposta certa era
// uma recusa. Sugestão que devolve recusa faz o assistente parecer quebrado.
const SUGESTOES = [
  "Quando é a Prova P1?",
  "Qual é a próxima aula?",
  "Qual é o limite de faltas da disciplina?",
  "Quais são os temas de todas as aulas?",
];

/**
 * Cópia local do histórico.
 *
 * O servidor é a fonte principal, mas ele pode não responder: sessão expirada,
 * rede caindo no meio da apresentação, gravação recusada pelo banco. Em
 * qualquer um desses casos a pergunta que a pessoa acabou de fazer não pode
 * simplesmente desaparecer, então ela também fica guardada aqui, no navegador.
 */
const CHAVE_LOCAL = "permaneia:historico:v1";
const LIMITE_LOCAL = 50;

function lerHistoricoLocal(): ItemHistorico[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_LOCAL);
    if (!bruto) return [];
    const dados: unknown = JSON.parse(bruto);
    return Array.isArray(dados) ? (dados as ItemHistorico[]) : [];
  } catch {
    // Modo anônimo, armazenamento cheio ou conteúdo corrompido. O histórico é
    // conveniência, e nenhuma dessas situações justifica quebrar a tela.
    return [];
  }
}

function gravarHistoricoLocal(itens: ItemHistorico[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(itens.slice(-LIMITE_LOCAL)));
  } catch {
    /* Sem espaço ou sem permissão: segue sem a cópia local. */
  }
}

function momento(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export function PainelChat({ disciplinas }: { disciplinas: Disciplina[] }) {
  // Começa numa disciplina que tenha material. Começar na primeira da lista
  // parece inofensivo e não é: a ordem é alfabética, e uma disciplina sem
  // documento indexado recusa toda pergunta antes mesmo de buscar. Quem abria a
  // tela e perguntava concluía, com razão, que o assistente não achava nada.
  const [disciplinaId, setDisciplinaId] = useState(
    () => (disciplinas.find((d) => d.documentos > 0) ?? disciplinas[0])?.id ?? ""
  );
  const [pergunta, setPergunta] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const disciplinaAtual = disciplinas.find((d) => d.id === disciplinaId);
  const semMaterial = disciplinaAtual !== undefined && disciplinaAtual.documentos === 0;

  /** Junta o que veio do servidor com o que está no navegador, sem repetir. */
  const guardar = useCallback((novos: ItemHistorico[]) => {
    setHistorico((atual) => {
      const porId = new Map(atual.map((i) => [i.id, i]));
      for (const item of novos) porId.set(item.id, item);
      const juntos = [...porId.values()].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
      gravarHistoricoLocal(juntos);
      return juntos;
    });
  }, []);

  useEffect(() => {
    let ativo = true;
    guardar(lerHistoricoLocal());

    (async () => {
      try {
        const resposta = await fetch("/api/rag/historico");
        if (!resposta.ok) return;
        const dados = await resposta.json();
        if (!ativo || !Array.isArray(dados?.consultas)) return;
        guardar(
          dados.consultas.map((c: Record<string, unknown>) => ({
            id: String(c.id),
            disciplinaId: String((c.disciplina as { id?: string } | undefined)?.id ?? ""),
            pergunta: String(c.pergunta ?? ""),
            resposta: String(c.resposta ?? ""),
            fontes: Array.isArray(c.fontes) ? (c.fontes as Fonte[]) : [],
            criadoEm: new Date(String(c.criadoEm)).toISOString(),
          }))
        );
      } catch {
        /* Sem servidor, fica o que o navegador guardou. */
      }
    })();

    return () => {
      ativo = false;
    };
  }, [guardar]);

  const anteriores = useMemo(
    () => historico.filter((i) => i.disciplinaId === disciplinaId).slice(-20).reverse(),
    [historico, disciplinaId]
  );

  async function perguntar(texto: string) {
    const limpo = texto.trim();
    if (limpo.length < 3 || carregando) return;

    setErro(null);
    setCarregando(true);
    setMensagens((atual) => [...atual, { autor: "aluno", texto: limpo }]);
    setPergunta("");

    try {
      const resposta = await fetch("/api/rag/perguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disciplinaId, pergunta: limpo }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados?.erro?.mensagem ?? "Não foi possível responder agora.");
        // A pergunta fica guardada mesmo quando a resposta falha: é justamente
        // a pergunta que ficou sem resposta que interessa rever depois.
        guardar([
          {
            id: `local:${Date.now()}`,
            disciplinaId,
            pergunta: limpo,
            resposta: dados?.erro?.mensagem ?? "A pergunta não foi respondida.",
            fontes: [],
            criadoEm: new Date().toISOString(),
          },
        ]);
        return;
      }

      setMensagens((atual) => [
        ...atual,
        {
          autor: "assistente",
          texto: dados.resposta,
          fontes: dados.fontes ?? [],
          diagnostico: dados.diagnostico,
        },
      ]);
      guardar([
        {
          id: `local:${Date.now()}`,
          disciplinaId,
          pergunta: limpo,
          resposta: dados.resposta,
          fontes: dados.fontes ?? [],
          criadoEm: new Date().toISOString(),
        },
      ]);
      requestAnimationFrame(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  /** Traz para a conversa uma pergunta já respondida, sem gastar nova consulta. */
  function reabrir(item: ItemHistorico) {
    setMensagens((atual) => [
      ...atual,
      { autor: "aluno", texto: item.pergunta },
      {
        autor: "assistente",
        texto: item.resposta,
        fontes: item.fontes,
        diagnostico: {
          origemIa: "local",
          similaridadeMaxima: 0,
          admitiuNaoSaber: false,
          respostaFundamentada: true,
          bloqueada: null,
          duracaoMs: 0,
        },
      },
    ]);
    requestAnimationFrame(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  }

  return (
    <div className="grade mt-8 grow">
      <div className="margem">
        <p className="carimbo">Conversa</p>
        <p className="mt-1 text-[13px] leading-snug text-tinta-fraca md:ml-auto md:max-w-[10rem]">
          Cada resposta traz os trechos que a originaram.
        </p>
      </div>

      <div className="space-y-4">
        <div className="folha p-4">
          <label htmlFor="disciplina" className="rotulo-campo">
            Disciplina
          </label>
          <select
            id="disciplina"
            value={disciplinaId}
            onChange={(e) => {
              setDisciplinaId(e.target.value);
              // Trocar de disciplina zera a conversa: manter as mensagens daria a
              // impressão de que o contexto anterior ainda vale.
              setMensagens([]);
              setErro(null);
            }}
            className="campo"
          >
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
                {d.periodo ? ` · ${d.periodo}` : ""}
                {d.documentos === 0 ? " · sem material indexado" : ""}
              </option>
            ))}
          </select>
          {disciplinaAtual && (
            <p className="carimbo mt-2">
              {disciplinaAtual.professor ? `${disciplinaAtual.professor} · ` : ""}
              {disciplinaAtual.documentos} documento(s) indexado(s)
            </p>
          )}
          {semMaterial && (
            <p className="aviso mt-3">
              Esta disciplina ainda não tem documento indexado, então o assistente não tem o que
              consultar. Escolha uma disciplina com material ou peça à coordenação para enviar o
              cronograma.
            </p>
          )}
        </div>

        {anteriores.length > 0 && (
          <details className="folha p-4">
            <summary className="carimbo cursor-pointer hover:text-tinta">
              {anteriores.length} pergunta(s) que você já fez nesta disciplina
            </summary>
            <ul className="mt-3 space-y-2">
              {anteriores.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => reabrir(item)}
                    className="w-full border border-regua bg-papel px-3 py-2 text-left transition-colors hover:border-sagrado"
                  >
                    <span className="font-mono text-[11px] text-tinta-fraca">
                      {momento(item.criadoEm)}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-tinta">
                      {item.pergunta}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="folha min-h-[20rem] p-4" role="log" aria-live="polite" aria-label="Conversa">
          {mensagens.length === 0 ? (
            <div className="py-8 text-center">
              <p className="carimbo mb-4">Comece por uma destas perguntas</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => perguntar(s)}
                    disabled={carregando || semMaterial}
                    className="border border-regua-forte bg-papel px-3 py-1.5 text-[13px] text-tinta-media transition-colors hover:border-sagrado hover:text-tinta disabled:opacity-45"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-6">
              {mensagens.map((m, i) => (
                <li key={i}>
                  {m.autor === "aluno" ? (
                    <div className="border-l-2 border-tinta pl-3">
                      <p className="carimbo mb-1">Pergunta</p>
                      <p className="text-[15px] text-tinta">{m.texto}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="carimbo mb-1">
                        {m.diagnostico.bloqueada
                          ? "Pergunta barrada"
                          : m.diagnostico.foraDoMaterial
                            ? "Resposta fora do material"
                            : "Resposta"}
                      </p>
                      <div
                        className={
                          m.diagnostico.bloqueada
                            ? "aviso"
                            : m.diagnostico.foraDoMaterial
                              ? // Traço diferente do das respostas com fonte: quem
                                // olha a tela de longe precisa ver que esta não
                                // saiu dos documentos da disciplina.
                                "border-l-2 border-dashed border-tinta-fraca bg-papel px-4 py-3"
                              : "border-l-2 border-sagrado bg-papel px-4 py-3"
                        }
                      >
                        <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-tinta">
                          {m.texto}
                        </p>
                      </div>

                      {m.fontes.length > 0 && (
                        <details className="mt-2">
                          <summary className="carimbo cursor-pointer hover:text-tinta">
                            {m.fontes.length} trecho(s) usado(s) como fonte
                          </summary>
                          <ol className="mt-2 space-y-2">
                            {m.fontes.map((f, j) => (
                              <li key={j} className="border border-regua bg-papel p-3">
                                <p className="mb-1 font-mono text-[11px] text-sagrado">
                                  {f.titulo}
                                  {f.referencia ? ` · ${f.referencia}` : ""}
                                  <span className="ml-2 text-tinta-fraca">
                                    {f.origemRecuperacao === "termos"
                                      ? "encontrado por termos"
                                      : `similaridade ${f.similaridade.toFixed(2)}`}
                                    {f.origemRecuperacao === "ambos" && " e por termos"}
                                  </span>
                                </p>
                                <p className="text-[13px] leading-relaxed text-tinta-media">{f.trecho}</p>
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}

                      <p className="mt-1.5 font-mono text-[11px] text-tinta-fraca">
                        {m.diagnostico.bloqueada ? (
                          <>Barrada antes de consultar a IA · {m.diagnostico.duracaoMs} ms</>
                        ) : (
                          <>
                            {m.diagnostico.origemIa === "gemini"
                              ? "Resposta gerada (Gemini)"
                              : "Leitura direta do material"}
                            {" · "}
                            {m.diagnostico.duracaoMs} ms
                            {m.diagnostico.foraDoMaterial
                              ? " · conhecimento geral do modelo, sem fonte no material indexado"
                              : m.diagnostico.admitiuNaoSaber &&
                                " · o assistente admitiu não ter a informação"}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {carregando && (
            <p className="carimbo mt-4">Procurando no material da disciplina…</p>
          )}
          <div ref={fim} />
        </div>

        {erro && (
          <p role="alert" className="aviso">
            {erro}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            perguntar(pergunta);
          }}
          className="flex gap-2"
        >
          <label htmlFor="pergunta" className="sr-only">
            Sua pergunta
          </label>
          <input
            id="pergunta"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            className="campo flex-1"
            placeholder="Pergunte sobre datas, critérios de avaliação ou conteúdo"
            maxLength={1000}
            disabled={carregando || semMaterial}
          />
          <button
            type="submit"
            disabled={carregando || semMaterial || pergunta.trim().length < 3}
            className="botao-primario"
          >
            Perguntar
          </button>
        </form>
      </div>
    </div>
  );
}
