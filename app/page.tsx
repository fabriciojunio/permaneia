import Link from "next/link";
import { MODO_DEMO } from "@/lib/demo";
import { BASE_DE_REGRAS } from "@/lib/fuzzy/regras";
import indicadoresPublicos from "@/data/indicadores-publicos.json";

export const dynamic = "force-dynamic";

const INDICADORES = indicadoresPublicos.indicadores;

export default function Inicio() {
  return (
    <div className="folha-tela max-w-5xl py-8 sm:py-12">
      <header className="flex items-baseline justify-between gap-x-4 border-b-2 border-tinta pb-2">
        <p className="carimbo">
          Unisagrado · Inteligência Artificial
          <span className="hidden sm:inline"> · Quinta-feira</span>
        </p>
        <p className="carimbo hidden sm:block">2026-2</p>
      </header>

      <main id="conteudo" className="flex flex-1 flex-col">
        <div className="grade border-b border-regua py-10">
          <div className="margem">
            <p className="carimbo">Projeto prático</p>
            <p className="carimbo mt-1">IA generativa</p>
          </div>

          <div>
            <h1 className="font-display text-5xl leading-[1.02] text-tinta sm:text-6xl">
              PermaneIA
            </h1>
            <p className="mt-2 font-display text-xl text-sagrado sm:text-2xl">
              Assistente de estudo e alerta de risco de evasão
            </p>

            <p className="mt-6 max-w-[38rem] text-[17px] leading-[1.7] text-tinta-media">
              Frequência, notas e uso da plataforma podem apoiar o acompanhamento dos estudantes.
              Este protótipo reúne esses sinais em regras explicáveis e oferece um assistente
              de estudos baseado nos documentos da disciplina.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login" className="botao-primario">
                Entrar
              </Link>
              <Link href="/cadastro" className="botao-secundario">
                Criar conta
              </Link>
              {MODO_DEMO && (
                <Link href="/login" className="botao-secundario">
                  Ver demonstração
                </Link>
              )}
            </div>
          </div>
        </div>

        <section className="grade border-b border-regua py-10" aria-labelledby="problema">
          <div className="margem">
            <p className="margem-numero">1</p>
            <p className="carimbo mt-1">O problema</p>
          </div>

          <div>
            <h2 id="problema" className="sr-only">
              O problema
            </h2>

            <dl>
              {INDICADORES.map((i, indice) => (
                <div
                  key={i.valor}
                  className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-5 border-b border-regua-fraca py-3 first:border-t first:border-regua-fraca"
                >
                  <dt className="font-mono text-[22px] font-bold text-sagrado">{i.valor}</dt>
                  <dd className="text-[15px] leading-relaxed text-tinta-media">
                    {i.texto}
                    <sup className="marcador-nota">{indice + 1}</sup>
                    <span className="mt-1 block font-sans text-[12px] leading-snug text-tinta-apagada">
                      <a href={i.url} className="underline">{i.fonte}</a>
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 max-w-[38rem] text-[15px] leading-relaxed text-tinta-media">
              Os indicadores têm populações e períodos diferentes. Desistência acumulada acompanha
              uma coorte ao longo do tempo e não equivale à taxa anual de evasão.
            </p>
          </div>
        </section>

        <section className="grade border-b border-regua py-10" aria-labelledby="solucao">
          <div className="margem">
            <p className="margem-numero">2</p>
            <p className="carimbo mt-1">As duas técnicas</p>
          </div>

          <div className="space-y-7">
            <h2 id="solucao" className="sr-only">
              As duas técnicas
            </h2>

            <article className="border-l-2 border-regua-forte pl-5">
              <h3 className="mb-1 text-lg text-tinta">
                <span className="mr-2 font-mono text-sm text-sagrado">2.1</span>
                IA generativa com RAG
              </h3>
              <p className="max-w-[36rem] text-[15px] leading-[1.7] text-tinta-media">
                O aluno pergunta e o sistema busca a resposta nos documentos institucionais
                indexados, ementa, cronograma e contrato didático, antes de acionar o modelo de
                linguagem. A resposta cita a fonte. Quando a informação não está no material, o
                sistema diz que não encontrou, em vez de inventar uma data de prova.
              </p>
            </article>

            <article className="border-l-2 border-regua-forte pl-5">
              <h3 className="mb-1 text-lg text-tinta">
                <span className="mr-2 font-mono text-sm text-sagrado">2.2</span>
                Lógica fuzzy
              </h3>
              <p className="max-w-[36rem] text-[15px] leading-[1.7] text-tinta-media">
                Frequência, desempenho e engajamento entram num sistema de Mamdani com{" "}
                {BASE_DE_REGRAS.length} regras e produzem uma pontuação de alerta de 0 a 1.
                As regras são heurísticas acadêmicas: a pontuação não é uma probabilidade
                de evasão e ainda não foi validada com desfechos de alunos reais.
              </p>
            </article>
          </div>
        </section>

        <section className="grade py-10" aria-labelledby="dados">
          <div className="margem">
            <p className="margem-numero">3</p>
            <p className="carimbo mt-1">Sobre os dados</p>
          </div>

          <div>
            <h2 id="dados" className="sr-only">
              Sobre os dados
            </h2>
            <p className="aviso max-w-[38rem]">
              Esta instalação usa exclusivamente dados sintéticos, gerados para fins acadêmicos.
              Nenhum aluno, nota ou frequência corresponde a uma pessoa real. Os documentos
              indexados, ao contrário, são os documentos públicos da própria disciplina.
            </p>
          </div>
        </section>
      </main>

      <footer className="rodape-folha">
        <p className="carimbo">Entrega em 19 de novembro de 2026</p>
        <p className="carimbo">Prof. Patrick Pedreira Silva</p>
      </footer>
    </div>
  );
}
