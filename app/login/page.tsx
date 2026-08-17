import Link from "next/link";
import { MODO_DEMO, CONTAS_DEMO } from "@/lib/demo";
import { FormularioLogin } from "./FormularioLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

const PERFIS = [
  [
    "Aluno",
    "Pergunta sobre datas, critérios de avaliação e conteúdo das aulas. Toda resposta cita o documento de onde saiu, e o assistente diz quando a informação não está no material.",
  ],
  [
    "Coordenação",
    "Acompanha o risco de evasão de cada matrícula, calculado por lógica fuzzy a partir de frequência, desempenho e engajamento, e mantém os documentos que o assistente pode citar.",
  ],
] as const;

export default function PaginaLogin() {
  return (
    <main id="conteudo" className="folha-tela max-w-6xl">
      <div className="carimbo flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-tinta pb-2 pt-5">
        <span>Unisagrado · Inteligência Artificial · Quinta-feira</span>
        <span>2026-2</span>
      </div>

      <div className="grid flex-1 content-center items-start gap-x-16 gap-y-10 py-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <p className="carimbo">Acesso ao sistema</p>
          <h1 className="mt-2 font-display text-5xl leading-none text-tinta">PermaneIA</h1>
          <p className="mt-3 max-w-[34rem] font-display text-xl leading-snug text-sagrado">
            Assistente de estudos e alerta de risco de evasão
          </p>

          <p className="mt-6 max-w-[34rem] text-[15px] leading-[1.7] text-tinta-media">
            O que você vê depois de entrar depende do seu perfil. As duas metades do sistema não se
            misturam: o aluno nunca alcança o painel de risco, e a coordenação não usa o assistente
            no lugar dele.
          </p>

          <dl className="mt-8 border-t border-regua">
            {PERFIS.map(([perfil, texto]) => (
              <div key={perfil} className="grid gap-x-8 border-b border-regua py-5 md:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="carimbo md:pt-1 md:text-right">{perfil}</dt>
                <dd className="mt-1 max-w-[30rem] text-[14px] leading-[1.7] text-tinta-media md:mt-0">
                  {texto}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 max-w-[34rem] text-[13px] leading-relaxed text-tinta-fraca">
            Projeto prático da disciplina de Inteligência Artificial. A base é sintética e nenhum
            registro corresponde a uma pessoa real.
          </p>
        </div>

        <div className="lg:sticky lg:top-8">
          <FormularioLogin modoDemo={MODO_DEMO} contasDemo={MODO_DEMO ? CONTAS_DEMO : []} />

          <div className="mt-6 border-t border-regua pt-4">
            <p className="text-[14px] leading-relaxed text-tinta-media">
              Ainda não tem conta?{" "}
              <Link
                href="/cadastro"
                className="text-sagrado underline underline-offset-2 hover:text-sagrado-escuro"
              >
                Criar conta de aluno
              </Link>
            </p>
            <Link href="/" className="carimbo mt-3 inline-block hover:text-tinta">
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>

      <footer className="rodape-folha">
        <p className="carimbo">Projeto prático de IA generativa</p>
        <p className="carimbo">Prof. Patrick Pedreira Silva</p>
      </footer>
    </main>
  );
}
