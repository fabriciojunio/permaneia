import Link from "next/link";
import { MODO_DEMO } from "@/lib/demo";
import { BASE_DE_REGRAS } from "@/lib/fuzzy/regras";

export const dynamic = "force-dynamic";

const NUMEROS = [
  { valor: "57,2%", texto: "de evasão no ensino superior brasileiro", fonte: "Mapa do Ensino Superior 2024, Semesp" },
  { valor: "~61%", texto: "na rede privada, chegando a 64% no EaD", fonte: "Mapa do Ensino Superior 2026, Semesp" },
  { valor: "1 em 4", texto: "jovens conclui a graduação que começou", fonte: "OCDE, Education at a Glance 2025" },
];

export default function Inicio() {
  return (
    <main id="conteudo" className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <header className="mb-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-permanencia-400">
          Projeto prático · Inteligência Artificial · 2026-2
        </p>
        <h1 className="max-w-3xl text-4xl leading-tight text-tinta-50 sm:text-5xl">
          O aluno some da plataforma semanas antes de a nota cair.
          <span className="block text-permanencia-400">O PermaneIA percebe nesse intervalo.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-tinta-300">
          Duas frentes contra a evasão no ensino superior: um assistente que responde dúvidas do aluno usando
          apenas os documentos oficiais da disciplina, e um painel que ordena a turma por risco de evasão
          calculado com lógica fuzzy.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="botao-primario">
            Entrar no sistema
          </Link>
          <Link href="/cadastro" className="botao-secundario">
            Criar conta
          </Link>
          {MODO_DEMO && (
            <Link href="/login" className="botao-secundario">
              Ver a demonstração
            </Link>
          )}
        </div>
      </header>

      <section className="mb-16" aria-labelledby="problema">
        <h2 id="problema" className="mb-6 text-2xl text-tinta-50">
          O problema não é hipotético
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {NUMEROS.map((n) => (
            <div key={n.valor} className="painel p-5">
              <p className="font-display text-3xl text-permanencia-400">{n.valor}</p>
              <p className="mt-2 text-sm leading-relaxed text-tinta-200">{n.texto}</p>
              <p className="mt-3 text-xs text-tinta-400">{n.fonte}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16 grid gap-6 md:grid-cols-2" aria-labelledby="tecnicas">
        <h2 id="tecnicas" className="sr-only">
          As duas técnicas de inteligência artificial
        </h2>

        <article className="painel p-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-tinta-400">Técnica 1</p>
          <h3 className="mb-3 text-xl text-tinta-50">IA generativa com RAG</h3>
          <p className="text-sm leading-relaxed text-tinta-300">
            O aluno pergunta sobre a disciplina e o sistema busca a resposta nos documentos institucionais
            indexados, ementa, cronograma e contrato didático, antes de acionar o modelo de linguagem. A
            resposta vem com a fonte citada, e quando a informação não está no material o sistema diz que
            não sabe em vez de inventar uma data de prova.
          </p>
        </article>

        <article className="painel p-6">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-tinta-400">Técnica 2</p>
          <h3 className="mb-3 text-xl text-tinta-50">Lógica fuzzy</h3>
          <p className="text-sm leading-relaxed text-tinta-300">
            Frequência, desempenho e engajamento entram num sistema Mamdani com {BASE_DE_REGRAS.length} regras
            e saem como um score contínuo de risco. Risco de evasão não é uma classe fixa: um aluno com nota
            boa e presença caindo já está em risco, e é exatamente esse caso que um critério baseado só na
            média deixa passar.
          </p>
        </article>
      </section>

      <section className="painel p-6" aria-labelledby="etica">
        <h2 id="etica" className="mb-3 text-lg text-tinta-50">
          Sobre os dados
        </h2>
        <p className="text-sm leading-relaxed text-tinta-300">
          Esta instalação usa exclusivamente dados sintéticos, gerados para fins acadêmicos. Nenhum aluno,
          nota ou frequência corresponde a uma pessoa real. O tratamento de dados pessoais previsto para um
          uso real está descrito na documentação do projeto, incluindo os direitos de acesso e portabilidade
          garantidos pela LGPD.
        </p>
      </section>

      <footer className="mt-16 border-t border-tinta-700 pt-6 text-sm text-tinta-400">
        <p>
          PermaneIA · Projeto prático de Inteligência Artificial · Entrega em 19 de novembro de 2026
        </p>
      </footer>
    </main>
  );
}
