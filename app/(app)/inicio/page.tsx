import Link from "next/link";
import { sessaoAtual } from "@/lib/auth";
import { podeFazer } from "@/lib/acesso";
import { prisma } from "@/lib/prisma";
import { resumoPorFaixa } from "@/lib/repositorios/matricula";
import { origemAtual } from "@/lib/ia";
import { primeiroNome, pluralizar } from "@/lib/formato";

export const dynamic = "force-dynamic";
export const metadata = { title: "Início" };

const FAIXAS = [
  ["critico", "Crítico", "text-risco-critico"],
  ["alto", "Alto", "text-risco-alto"],
  ["medio", "Médio", "text-risco-medio"],
  ["baixo", "Baixo", "text-risco-baixo"],
] as const;

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
  let numeroSecao = 0;

  return (
    <div>
      <div className="grade border-b border-regua pb-8">
        <div className="margem">
          <p className="carimbo">Painel de trabalho</p>
        </div>
        <div>
          <h1 className="font-display text-3xl text-tinta">Olá, {primeiroNome(sessao.nome)}</h1>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-tinta-media">
            {verPainel
              ? "Comece pelo painel de risco: a lista já vem ordenada de quem precisa de contato primeiro."
              : "Tire dúvidas sobre suas disciplinas com base nos documentos oficiais enviados pela coordenação."}
          </p>
        </div>
      </div>

      {resumo && (
        <section className="grade border-b border-regua py-8" aria-labelledby="resumo">
          <div className="margem">
            <p className="margem-numero">{++numeroSecao}</p>
            <p className="carimbo mt-1">Situação da base</p>
          </div>
          <div>
            <h2 id="resumo" className="sr-only">
              Situação da base
            </h2>
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              {FAIXAS.map(([chave, rotulo, cor]) => (
                <div key={chave}>
                  <dd className={`font-mono text-2xl font-bold leading-none ${cor}`}>
                    {resumo[chave] ?? 0}
                  </dd>
                  <dt className="carimbo mt-1.5">{rotulo}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="grade border-b border-regua py-8" aria-labelledby="acessos">
        <div className="margem">
          <p className="margem-numero">{++numeroSecao}</p>
          <p className="carimbo mt-1">O que fazer agora</p>
        </div>
        <div className="space-y-5">
          <h2 id="acessos" className="sr-only">
            O que fazer agora
          </h2>

          {podeFazer(sessao.papel, "chat.perguntar") && (
            <Link
              href="/chat"
              className="block max-w-[38rem] border-l-2 border-sagrado pl-5 transition-colors hover:border-sagrado-escuro"
            >
              <h3 className="mb-1 text-lg text-tinta">Assistente de estudos</h3>
              <p className="text-[14px] leading-relaxed text-tinta-media">
                Pergunte sobre datas, critérios de avaliação e conteúdo. A resposta cita o documento
                de onde veio, e o sistema admite quando a informação não está no material.
              </p>
              <p className="carimbo mt-2">
                {pluralizar(disciplinas, "disciplina", "disciplinas")} ·{" "}
                {pluralizar(documentos, "documento", "documentos")}
              </p>
            </Link>
          )}

          {verPainel && (
            <Link
              href="/dashboard"
              className="block max-w-[38rem] border-l-2 border-sagrado pl-5 transition-colors hover:border-sagrado-escuro"
            >
              <h3 className="mb-1 text-lg text-tinta">Painel de risco de evasão</h3>
              <p className="text-[14px] leading-relaxed text-tinta-media">
                Todos os alunos ordenados pelo score fuzzy, do mais crítico ao menos. Cada linha abre
                o detalhamento das regras que produziram aquele número.
              </p>
              {resumo && (
                <p className="carimbo mt-2">
                  {(resumo.critico ?? 0) + (resumo.alto ?? 0)} precisando de contato
                </p>
              )}
            </Link>
          )}
        </div>
      </section>

      <section className="grade py-8" aria-labelledby="modo">
        <div className="margem">
          <p className="margem-numero">{++numeroSecao}</p>
          <p className="carimbo mt-1">Modo do assistente</p>
        </div>
        <div>
          <h2 id="modo" className="sr-only">
            Modo de operação do assistente
          </h2>
          <p className="max-w-[38rem] text-[14px] leading-relaxed text-tinta-media">
            {provedor === "gemini" ? (
              <>
                <span className="font-medium text-tinta">Generativo.</span> As respostas são
                redigidas por um modelo de linguagem a partir dos trechos recuperados, sempre com a
                fonte citada.
              </>
            ) : (
              <>
                <span className="font-medium text-tinta">Leitura direta do material.</span> Sem
                chave de API configurada, o sistema responde transcrevendo os trechos recuperados em
                vez de redigir um texto novo. Continua respondendo e continua citando a fonte.
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}
