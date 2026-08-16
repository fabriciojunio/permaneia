import Link from "next/link";
import { sessaoAtual } from "@/lib/auth";
import { podeFazer } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { resumoPorFaixa } from "@/lib/repositorios/matricula";
import { origemAtual } from "@/lib/ia";
import { primeiroNome, pluralizar } from "@/lib/formato";

export const dynamic = "force-dynamic";
export const metadata = { title: "Início" };

export default async function PaginaInicio() {
  const sessao = await sessaoAtual();
  if (!sessao) return null;

  const verPainel = podeFazer(sessao.papel, "dashboard.ver");

  const [disciplinas, documentos, resumo] = await Promise.all([
    prisma.disciplina.count(),
    prisma.documento.count(),
    verPainel ? resumoPorFaixa() : Promise.resolve(null),
  ]);

  const provedor = origemAtual();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl text-tinta-50">Olá, {primeiroNome(sessao.nome)}</h1>
        <p className="mt-2 text-tinta-400">
          {verPainel
            ? "Comece pelo painel de risco: a lista já vem ordenada de quem precisa de contato primeiro."
            : "Tire dúvidas sobre suas disciplinas com base nos documentos oficiais enviados pela coordenação."}
        </p>
      </header>

      {resumo && (
        <section aria-labelledby="resumo">
          <h2 id="resumo" className="mb-3 text-sm font-medium uppercase tracking-wide text-tinta-400">
            Situação da base
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {(
              [
                ["critico", "Risco crítico", "text-risco-critico"],
                ["alto", "Risco alto", "text-risco-alto"],
                ["medio", "Risco médio", "text-risco-medio"],
                ["baixo", "Risco baixo", "text-risco-baixo"],
              ] as const
            ).map(([chave, rotulo, cor]) => (
              <div key={chave} className="painel p-4">
                <p className={`font-display text-3xl ${cor}`}>{resumo[chave] ?? 0}</p>
                <p className="mt-1 text-sm text-tinta-300">{rotulo}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {podeFazer(sessao.papel, "chat.perguntar") && (
          <Link href="/chat" className="painel block p-6 transition-colors hover:border-permanencia-700">
            <h2 className="mb-2 text-xl text-tinta-50">Assistente de estudos</h2>
            <p className="text-sm leading-relaxed text-tinta-300">
              Pergunte sobre datas, critérios de avaliação e conteúdo. A resposta cita o documento de onde
              veio, e o sistema admite quando a informação não está no material.
            </p>
            <p className="mt-4 text-xs text-tinta-500">
              {pluralizar(disciplinas, "disciplina cadastrada", "disciplinas cadastradas")} ·{" "}
              {pluralizar(documentos, "documento indexado", "documentos indexados")}
            </p>
          </Link>
        )}

        {verPainel && (
          <Link href="/dashboard" className="painel block p-6 transition-colors hover:border-permanencia-700">
            <h2 className="mb-2 text-xl text-tinta-50">Painel de risco de evasão</h2>
            <p className="text-sm leading-relaxed text-tinta-300">
              Todos os alunos ordenados pelo score fuzzy, do mais crítico ao menos. Cada linha abre o
              detalhamento das regras que produziram aquele número.
            </p>
            <p className="mt-4 text-xs text-tinta-500">
              {resumo ? `${(resumo.critico ?? 0) + (resumo.alto ?? 0)} aluno(s) precisando de contato` : ""}
            </p>
          </Link>
        )}
      </section>

      <section className="painel p-5">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-tinta-400">
          Modo de operação do assistente
        </h2>
        {provedor === "gemini" ? (
          <p className="text-sm text-tinta-300">
            <span className="font-medium text-permanencia-400">Generativo (Gemini).</span> As respostas são
            redigidas por um modelo de linguagem a partir dos trechos recuperados, sempre com a fonte citada.
          </p>
        ) : (
          <p className="text-sm text-tinta-300">
            <span className="font-medium text-amber-400">Leitura direta do material.</span> Sem chave de API
            configurada, o sistema responde transcrevendo os trechos recuperados em vez de redigir um texto
            novo. Continua respondendo e continua citando a fonte.
          </p>
        )}
      </section>
    </div>
  );
}
