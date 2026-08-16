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

  return (
    <div className="space-y-10">
      <header className="border-b-2 border-tinta pb-3">
        <p className="carimbo mb-2">Painel de trabalho</p>
        <h1 className="font-display text-3xl text-tinta">Olá, {primeiroNome(sessao.nome)}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-tinta-media">
          {verPainel
            ? "Comece pelo painel de risco: a lista já vem ordenada de quem precisa de contato primeiro."
            : "Tire dúvidas sobre suas disciplinas com base nos documentos oficiais enviados pela coordenação."}
        </p>
      </header>

      {resumo && (
        <section aria-labelledby="resumo">
          <div className="secao">
            <span className="secao-numero">1</span>
            <h2 id="resumo" className="text-xl text-tinta">
              Situação da base
            </h2>
          </div>
          <table className="w-full max-w-lg text-left">
            <tbody>
              {FAIXAS.map(([chave, rotulo, cor]) => (
                <tr key={chave} className="border-b border-regua-fraca">
                  <th scope="row" className="py-2 pr-6 font-sans text-[15px] font-normal text-tinta-media">
                    {rotulo}
                  </th>
                  <td className={`py-2 text-right font-mono text-xl font-bold ${cor}`}>
                    {resumo[chave] ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section aria-labelledby="acessos">
        <div className="secao">
          <span className="secao-numero">{resumo ? "2" : "1"}</span>
          <h2 id="acessos" className="text-xl text-tinta">
            O que fazer agora
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {podeFazer(sessao.papel, "chat.perguntar") && (
            <Link href="/chat" className="folha block p-5 transition-colors hover:border-sagrado">
              <h3 className="mb-2 text-lg text-tinta">Assistente de estudos</h3>
              <p className="text-[14px] leading-relaxed text-tinta-media">
                Pergunte sobre datas, critérios de avaliação e conteúdo. A resposta cita o documento
                de onde veio, e o sistema admite quando a informação não está no material.
              </p>
              <p className="carimbo mt-4">
                {pluralizar(disciplinas, "disciplina", "disciplinas")} ·{" "}
                {pluralizar(documentos, "documento", "documentos")}
              </p>
            </Link>
          )}

          {verPainel && (
            <Link href="/dashboard" className="folha block p-5 transition-colors hover:border-sagrado">
              <h3 className="mb-2 text-lg text-tinta">Painel de risco de evasão</h3>
              <p className="text-[14px] leading-relaxed text-tinta-media">
                Todos os alunos ordenados pelo score fuzzy, do mais crítico ao menos. Cada linha abre
                o detalhamento das regras que produziram aquele número.
              </p>
              {resumo && (
                <p className="carimbo mt-4">
                  {(resumo.critico ?? 0) + (resumo.alto ?? 0)} precisando de contato
                </p>
              )}
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="modo">
        <h2 id="modo" className="carimbo mb-2">
          Modo de operação do assistente
        </h2>
        <p className="max-w-2xl border-l-2 border-regua-forte pl-4 text-[14px] leading-relaxed text-tinta-media">
          {provedor === "gemini" ? (
            <>
              <span className="font-medium text-tinta">Generativo.</span> As respostas são redigidas
              por um modelo de linguagem a partir dos trechos recuperados, sempre com a fonte citada.
            </>
          ) : (
            <>
              <span className="font-medium text-tinta">Leitura direta do material.</span> Sem chave
              de API configurada, o sistema responde transcrevendo os trechos recuperados em vez de
              redigir um texto novo. Continua respondendo e continua citando a fonte.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
