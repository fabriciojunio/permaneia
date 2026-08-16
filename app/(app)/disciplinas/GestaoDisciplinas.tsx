"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatarData, pluralizar } from "@/lib/formato";

type Documento = {
  id: string;
  titulo: string;
  referencia: string | null;
  totalChunks: number;
  origem: string;
  criadoEm: string;
};

type Disciplina = {
  id: string;
  nome: string;
  professor: string | null;
  periodo: string | null;
  matriculas: number;
  documentos: Documento[];
};

export function GestaoDisciplinas({ disciplinas }: { disciplinas: Disciplina[] }) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  return (
    <div className="space-y-6">
      {mensagem && (
        <p
          role="status"
          className={
            mensagem.tipo === "ok"
              ? "border-l-2 border-risco-baixo bg-papel-alto px-4 py-3 text-sm text-tinta"
              : "aviso"
          }
        >
          {mensagem.texto}
        </p>
      )}

      <NovaDisciplina
        aoCriar={(texto) => {
          setMensagem({ tipo: "ok", texto });
          router.refresh();
        }}
        aoFalhar={(texto) => setMensagem({ tipo: "erro", texto })}
      />

      {disciplinas.length === 0 ? (
        <div className="folha p-6 text-[15px] text-tinta-media">
          Nenhuma disciplina cadastrada ainda.
        </div>
      ) : (
        <ul className="space-y-4">
          {disciplinas.map((d) => (
            <li key={d.id} className="folha p-5">
              <div className="mb-3 border-b border-regua pb-2">
                <h2 className="text-lg text-tinta">{d.nome}</h2>
                <p className="carimbo mt-0.5">
                  {[d.professor, d.periodo].filter(Boolean).join(" · ") || "Sem professor ou período"}
                  {" · "}
                  {pluralizar(d.matriculas, "matrícula", "matrículas")}
                </p>
              </div>

              {d.documentos.length === 0 ? (
                <p className="mb-4 border-l-2 border-risco-medio bg-papel px-3 py-2 text-[13px] text-tinta-media">
                  Sem documento indexado. O assistente não responde perguntas desta disciplina até
                  que a ementa ou o cronograma seja enviado.
                </p>
              ) : (
                <table className="mb-4 w-full text-left text-[13px]">
                  <tbody>
                    {d.documentos.map((doc) => (
                      <tr key={doc.id} className="border-b border-regua-fraca last:border-0">
                        <td className="py-1.5 pr-4 text-tinta">{doc.titulo}</td>
                        <td className="py-1.5 pr-4 font-mono text-[11px] text-sagrado">
                          {doc.referencia ?? ""}
                        </td>
                        <td className="py-1.5 pr-4 text-right font-mono text-[11px] text-tinta-fraca">
                          {doc.totalChunks} trecho(s)
                        </td>
                        <td className="py-1.5 text-right font-mono text-[11px] text-tinta-fraca">
                          {formatarData(doc.criadoEm)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <EnvioDocumento
                disciplinaId={d.id}
                aoEnviar={(texto) => {
                  setMensagem({ tipo: "ok", texto });
                  router.refresh();
                }}
                aoFalhar={(texto) => setMensagem({ tipo: "erro", texto })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NovaDisciplina({
  aoCriar,
  aoFalhar,
}: {
  aoCriar: (texto: string) => void;
  aoFalhar: (texto: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [professor, setProfessor] = useState("");
  const [periodo, setPeriodo] = useState("2026-2");
  const [enviando, setEnviando] = useState(false);

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    try {
      const resposta = await fetch("/api/disciplinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          professor: professor || undefined,
          periodo: periodo || undefined,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        aoFalhar(dados?.erro?.mensagem ?? "Não foi possível criar a disciplina.");
        return;
      }
      setNome("");
      setProfessor("");
      aoCriar(`Disciplina "${dados.disciplina.nome}" criada.`);
    } catch {
      aoFalhar("Falha de conexão.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={criar} className="folha space-y-3 p-5">
      <h2 className="carimbo border-b border-regua pb-2">Nova disciplina</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="nome" className="rotulo-campo">Nome</label>
          <input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} className="campo" />
        </div>
        <div>
          <label htmlFor="professor" className="rotulo-campo">Professor</label>
          <input id="professor" value={professor} onChange={(e) => setProfessor(e.target.value)} className="campo" />
        </div>
        <div>
          <label htmlFor="periodo" className="rotulo-campo">Período</label>
          <input
            id="periodo"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="campo"
            placeholder="2026-2"
          />
        </div>
      </div>
      <button type="submit" disabled={enviando || !nome.trim()} className="botao-primario">
        {enviando ? "Criando" : "Criar disciplina"}
      </button>
    </form>
  );
}

function EnvioDocumento({
  disciplinaId,
  aoEnviar,
  aoFalhar,
}: {
  disciplinaId: string;
  aoEnviar: (texto: string) => void;
  aoFalhar: (texto: string) => void;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!arquivo) return;

    setEnviando(true);
    try {
      const formulario = new FormData();
      formulario.append("arquivo", arquivo);
      if (titulo.trim()) formulario.append("titulo", titulo.trim());
      if (referencia.trim()) formulario.append("referencia", referencia.trim());

      const resposta = await fetch(`/api/disciplinas/${disciplinaId}/documentos`, {
        method: "POST",
        body: formulario,
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        aoFalhar(dados?.erro?.mensagem ?? "Não foi possível indexar o documento.");
        return;
      }
      setArquivo(null);
      setTitulo("");
      setReferencia("");
      aoEnviar(
        `Documento "${dados.documento.titulo}" indexado em ${dados.documento.trechos} trecho(s), com embeddings do provedor ${dados.documento.origemEmbedding}.`
      );
    } catch {
      aoFalhar("Falha de conexão durante o envio.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 border-t border-regua pt-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
      <div>
        <label htmlFor={`arquivo-${disciplinaId}`} className="rotulo-campo">
          PDF da ementa ou cronograma
        </label>
        <input
          id={`arquivo-${disciplinaId}`}
          type="file"
          accept="application/pdf"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="campo file:mr-3 file:border file:border-regua-forte file:bg-papel file:px-2 file:py-0.5 file:font-mono file:text-[11px] file:text-tinta"
        />
      </div>
      <div>
        <label htmlFor={`titulo-${disciplinaId}`} className="rotulo-campo">Título</label>
        <input
          id={`titulo-${disciplinaId}`}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="campo"
          placeholder="Cronograma"
        />
      </div>
      <div>
        <label htmlFor={`referencia-${disciplinaId}`} className="rotulo-campo">Referência</label>
        <input
          id={`referencia-${disciplinaId}`}
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          className="campo"
          placeholder="versão de ago/2026"
        />
      </div>
      <div className="flex items-end">
        <button type="submit" disabled={enviando || !arquivo} className="botao-primario w-full">
          {enviando ? "Indexando" : "Indexar"}
        </button>
      </div>
    </form>
  );
}
