import Link from "next/link";
import { MODO_DEMO } from "@/lib/demo";
import { BASE_DE_REGRAS } from "@/lib/fuzzy/regras";

export const dynamic = "force-dynamic";

const INDICADORES = [
  { valor: "57,2%", texto: "de evasão no ensino superior brasileiro", nota: 1 },
  { valor: "61%", texto: "na rede privada, chegando a 64% no ensino a distância", nota: 2 },
  { valor: "1 em 4", texto: "jovens conclui a graduação que começou", nota: 3 },
];

const NOTAS = [
  "Mapa do Ensino Superior no Brasil 2024, Instituto Semesp.",
  "Mapa do Ensino Superior no Brasil 2026, Instituto Semesp.",
  "OCDE, Education at a Glance 2025.",
];

export default function Inicio() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-16">
      <header className="border-b-2 border-tinta pb-3">
        <p className="carimbo">
          Unisagrado · Inteligência Artificial · Quinta-feira · 2026-2
        </p>
      </header>

      <main id="conteudo">
        <div className="border-b border-regua py-10">
          <p className="carimbo mb-4">Projeto prático de IA generativa</p>
          <h1 className="font-display text-5xl leading-[1.05] text-tinta sm:text-6xl">
            PermaneIA
          </h1>
          <p className="mt-3 font-display text-xl text-sagrado sm:text-2xl">
            Assistente de estudo e alerta de risco de evasão
          </p>

          <p className="mt-6 max-w-2xl text-[17px] leading-[1.7] text-tinta-media">
            O aluno para de acessar a plataforma semanas antes de a nota cair, e meses antes de
            formalizar o trancamento. Quem monitora apenas a média chega tarde. Este sistema olha
            para o intervalo entre uma coisa e outra.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
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

        <section className="py-10" aria-labelledby="problema">
          <div className="secao">
            <span className="secao-numero">1</span>
            <h2 id="problema" className="text-2xl text-tinta">
              O problema
            </h2>
          </div>

          <table className="w-full text-left">
            <caption className="sr-only">Indicadores de evasão no ensino superior brasileiro</caption>
            <tbody>
              {INDICADORES.map((i) => (
                <tr key={i.valor} className="border-b border-regua-fraca align-baseline">
                  <th scope="row" className="py-3 pr-6 font-mono text-2xl font-bold text-sagrado">
                    {i.valor}
                  </th>
                  <td className="py-3 text-[15px] leading-relaxed text-tinta-media">
                    {i.texto}
                    <sup className="marcador-nota">{i.nota}</sup>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-tinta-media">
            A literatura sobre evasão descreve o abandono como precedido por desengajamento, e não
            por notas ruins. É essa a premissa que organiza o sistema inteiro.
          </p>
        </section>

        <section className="border-t border-regua py-10" aria-labelledby="solucao">
          <div className="secao">
            <span className="secao-numero">2</span>
            <h2 id="solucao" className="text-2xl text-tinta">
              As duas técnicas
            </h2>
          </div>

          <div className="space-y-8">
            <article>
              <h3 className="mb-2 flex items-baseline gap-2 text-lg text-tinta">
                <span className="font-mono text-sm text-sagrado">2.1</span>
                IA generativa com RAG
              </h3>
              <p className="max-w-2xl text-[15px] leading-[1.7] text-tinta-media">
                O aluno pergunta e o sistema busca a resposta nos documentos institucionais
                indexados, ementa, cronograma e contrato didático, antes de acionar o modelo de
                linguagem. A resposta cita a fonte. Quando a informação não está no material, o
                sistema diz que não encontrou, em vez de inventar uma data de prova.
              </p>
            </article>

            <article>
              <h3 className="mb-2 flex items-baseline gap-2 text-lg text-tinta">
                <span className="font-mono text-sm text-sagrado">2.2</span>
                Lógica fuzzy
              </h3>
              <p className="max-w-2xl text-[15px] leading-[1.7] text-tinta-media">
                Frequência, desempenho e engajamento entram num sistema de Mamdani com{" "}
                {BASE_DE_REGRAS.length} regras e saem como um score contínuo de risco. Risco de
                evasão não é uma classe fixa: um aluno com nota boa e presença caindo já está em
                risco, e é justamente esse caso que um critério baseado só na média deixa passar.
              </p>
            </article>
          </div>
        </section>

        <section className="border-t border-regua py-10" aria-labelledby="dados">
          <div className="secao">
            <span className="secao-numero">3</span>
            <h2 id="dados" className="text-2xl text-tinta">
              Sobre os dados
            </h2>
          </div>
          <p className="aviso max-w-2xl">
            Esta instalação usa exclusivamente dados sintéticos, gerados para fins acadêmicos.
            Nenhum aluno, nota ou frequência corresponde a uma pessoa real. Os documentos
            indexados, ao contrário, são os documentos públicos da própria disciplina.
          </p>
        </section>

        <section className="border-t border-regua pt-6" aria-labelledby="notas">
          <h2 id="notas" className="carimbo mb-3">
            Notas
          </h2>
          <ol className="space-y-1">
            {NOTAS.map((nota, i) => (
              <li key={nota} className="nota-rodape">
                <sup className="marcador-nota">{i + 1}</sup> {nota}
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="mt-10 border-t-2 border-tinta pt-3">
        <p className="carimbo">Entrega em 19 de novembro de 2026</p>
      </footer>
    </div>
  );
}
