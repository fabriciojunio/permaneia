"use client";

import { useRef, useState } from "react";

type Disciplina = {
  id: string;
  nome: string;
  professor: string | null;
  periodo: string | null;
  documentos: number;
};

type Fonte = { titulo: string; referencia: string | null; similaridade: number; trecho: string };

type Diagnostico = {
  origemIa: "gemini" | "local";
  similaridadeMaxima: number;
  admitiuNaoSaber: boolean;
  respostaFundamentada: boolean;
  bloqueada: "injecao" | "ilicito" | "dados-de-terceiros" | null;
  duracaoMs: number;
};

type Mensagem =
  | { autor: "aluno"; texto: string }
  | { autor: "assistente"; texto: string; fontes: Fonte[]; diagnostico: Diagnostico };

const SUGESTOES = [
  "Quando é a Prova P1?",
  "Qual é o limite de faltas da disciplina?",
  "Quanto vale o quiz na nota final?",
  "Que conteúdo cai na aula de lógica fuzzy?",
];

export function PainelChat({ disciplinas }: { disciplinas: Disciplina[] }) {
  const [disciplinaId, setDisciplinaId] = useState(disciplinas[0]?.id ?? "");
  const [pergunta, setPergunta] = useState("");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

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
      // Rola só depois de a resposta entrar, para o aluno ver o começo dela.
      requestAnimationFrame(() => fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  const disciplinaAtual = disciplinas.find((d) => d.id === disciplinaId);

  return (
    <div className="space-y-4">
      <div className="painel p-4">
        <label htmlFor="disciplina" className="rotulo-campo">
          Disciplina
        </label>
        <select
          id="disciplina"
          value={disciplinaId}
          onChange={(e) => {
            setDisciplinaId(e.target.value);
            // Trocar de disciplina zera o histórico: manter a conversa daria a
            // impressão de que o contexto anterior ainda vale, e ele não vale.
            setMensagens([]);
            setErro(null);
          }}
          className="campo"
        >
          {disciplinas.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
              {d.periodo ? ` · ${d.periodo}` : ""}
            </option>
          ))}
        </select>
        {disciplinaAtual && (
          <p className="mt-2 text-xs text-tinta-500">
            {disciplinaAtual.professor ? `${disciplinaAtual.professor} · ` : ""}
            {disciplinaAtual.documentos} documento(s) indexado(s)
          </p>
        )}
      </div>

      <div className="painel min-h-[20rem] p-4" role="log" aria-live="polite" aria-label="Conversa">
        {mensagens.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-tinta-400">Comece por uma destas perguntas:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => perguntar(s)}
                  disabled={carregando}
                  className="botao-secundario text-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-5">
            {mensagens.map((m, i) => (
              <li key={i}>
                {m.autor === "aluno" ? (
                  <div className="flex justify-end">
                    <p className="max-w-[85%] rounded-lg rounded-br-sm bg-permanencia-800 px-4 py-2 text-sm text-permanencia-50">
                      {m.texto}
                    </p>
                  </div>
                ) : (
                  <div className="max-w-[92%]">
                    <div
                      className={`rounded-lg rounded-bl-sm px-4 py-3 ${
                        m.diagnostico.bloqueada
                          ? "border border-amber-900/70 bg-amber-950/30"
                          : "bg-tinta-700/60"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-tinta-100">{m.texto}</p>
                    </div>

                    {m.fontes.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-tinta-400 hover:text-tinta-200">
                          {m.fontes.length} trecho(s) usado(s) como fonte
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {m.fontes.map((f, j) => (
                            <li key={j} className="rounded-md border border-tinta-700 bg-tinta-900/60 p-3">
                              <p className="mb-1 text-xs font-medium text-permanencia-300">
                                {f.titulo}
                                {f.referencia ? ` · ${f.referencia}` : ""}
                                <span className="ml-2 font-mono text-tinta-500">
                                  similaridade {f.similaridade.toFixed(2)}
                                </span>
                              </p>
                              <p className="text-xs leading-relaxed text-tinta-400">{f.trecho}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <p className="mt-1.5 text-[11px] text-tinta-500">
                      {m.diagnostico.bloqueada ? (
                        <>Pergunta barrada antes de consultar a IA · {m.diagnostico.duracaoMs} ms</>
                      ) : (
                        <>
                          {m.diagnostico.origemIa === "gemini"
                            ? "Resposta gerada (Gemini)"
                            : "Leitura direta do material"}
                          {" · "}
                          {m.diagnostico.duracaoMs} ms
                          {m.diagnostico.admitiuNaoSaber && " · o assistente admitiu não ter a informação"}
                        </>
                      )}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {carregando && <p className="mt-4 text-sm text-tinta-400">Procurando no material da disciplina…</p>}
        <div ref={fim} />
      </div>

      {erro && (
        <p role="alert" className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
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
          placeholder="Pergunte sobre datas, critérios de avaliação ou conteúdo…"
          maxLength={1000}
          disabled={carregando}
        />
        <button type="submit" disabled={carregando || pergunta.trim().length < 3} className="botao-primario">
          Perguntar
        </button>
      </form>
    </div>
  );
}
