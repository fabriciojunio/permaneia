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
          className={`rounded-md border px-3 py-2 text-sm ${
            mensagem.tipo === "ok"
              ? "border-permanencia-800 bg-permanencia-950/50 text-permanencia-200"
              : "border-red-900 bg-red-950/60 text-red-200"
          }`}
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
        <div className="painel p-6 text-sm text-tinta-300">
          Nenhuma disciplina cadastrada ainda.
        </div>
      ) : (
        <ul className="space-y-4">
          {disciplinas.map((d) => (
            <li key={d.id} className="painel p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg text-tinta-50">{d.nome}</h2>
                  <p className="text-xs text-tinta-500">
                    {[d.professor, d.periodo].filter(Boolean).join(" · ") || "Sem professor ou período informado"}
                    {" · "}
                    {pluralizar(d.matriculas, "matrícula", "matrículas")}
                  </p>
                </div>
              </div>

              {d.documentos.length === 0 ? (
                <p className="mb-4 rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                  Sem documento indexado. O assistente não responde perguntas desta disciplina até que a
                  ementa ou o cronograma seja enviado.
                </p>
              ) : (
                <ul className="mb-4 space-y-1.5">
                  {d.documentos.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-tinta-700 bg-tinta-900/50 px-3 py-2 text-xs"
                    >
                      <span className="text-tinta-100">{doc.titulo}</span>
                      {doc.referencia && <span className="text-permanencia-400">{doc.referencia}</span>}
                      <span className="font-mono text-tinta-500">{doc.totalChunks} trecho(s)</span>
                      <span className="ml-auto text-tinta-500">{formatarData(doc.criadoEm)}</span>
                    </li>
                  ))}
                </ul>
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
    <form onSubmit={criar} className="painel space-y-3 p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-tinta-400">Nova disciplina</h2>
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
        {enviando ? "Criando…" : "Criar disciplina"}
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
    <form onSubmit={enviar} className="grid gap-3 border-t border-tinta-700 pt-4 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
      <div>
        <label htmlFor={`arquivo-${disciplinaId}`} className="rotulo-campo">
          PDF da ementa ou do cronograma
        </label>
        <input
          id={`arquivo-${disciplinaId}`}
          type="file"
          accept="application/pdf"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          className="campo file:mr-3 file:rounded file:border-0 file:bg-tinta-700 file:px-3 file:py-1 file:text-xs file:text-tinta-100"
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
          {enviando ? "Indexando…" : "Indexar"}
        </button>
      </div>
    </form>
  );
}
