import Link from "next/link";
import { DOMINIOS_PERMITIDOS } from "@/lib/cadastro";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";
import { FormularioCadastro } from "./FormularioCadastro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar conta" };

const CONDICOES = [
  [
    "Perfil",
    "A conta nasce como aluno. O painel de risco é restrito à coordenação pedagógica e não é liberado por este cadastro.",
  ],
  [
    "Senha",
    `Mínimo de ${TAMANHO_MINIMO_SENHA} caracteres, com maiúscula, minúscula, número e símbolo. Senhas conhecidas de vazamentos são recusadas, e o que fica guardado é apenas o hash bcrypt.`,
  ],
  [
    "Dados",
    "Guardamos nome, e-mail e as perguntas feitas ao assistente. Você pode baixar tudo isso em formato aberto pela tela Meus dados, a qualquer momento.",
  ],
] as const;

export default function PaginaCadastro() {
  return (
    <main id="conteudo" className="mx-auto min-h-screen max-w-6xl px-6">
      <div className="carimbo flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-tinta pb-2 pt-5">
        <span>Unisagrado · Inteligência Artificial · Quinta-feira</span>
        <span>2026-2</span>
      </div>

      <div className="grid items-start gap-x-16 gap-y-10 py-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <p className="carimbo">Ficha de cadastro</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-tinta">Criar conta de aluno</h1>
          <p className="mt-4 max-w-[34rem] text-[15px] leading-[1.7] text-tinta-media">
            A conta dá acesso ao assistente de estudos, que responde sobre datas, critérios de
            avaliação e conteúdo das aulas usando os documentos que a coordenação indexou.
            {DOMINIOS_PERMITIDOS.length > 0 && (
              <> Apenas e-mails de {DOMINIOS_PERMITIDOS.join(", ")} são aceitos.</>
            )}
          </p>

          <dl className="mt-8 border-t border-regua">
            {CONDICOES.map(([titulo, texto]) => (
              <div key={titulo} className="grid gap-x-8 border-b border-regua py-5 md:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="carimbo md:pt-1 md:text-right">{titulo}</dt>
                <dd className="mt-1 max-w-[30rem] text-[14px] leading-[1.7] text-tinta-media md:mt-0">
                  {texto}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:sticky lg:top-8">
          <FormularioCadastro tamanhoMinimoSenha={TAMANHO_MINIMO_SENHA} />

          <div className="mt-6 border-t border-regua pt-4">
            <p className="text-[14px] leading-relaxed text-tinta-media">
              Já tem conta?{" "}
              <Link
                href="/login"
                className="text-sagrado underline underline-offset-2 hover:text-sagrado-escuro"
              >
                Entrar
              </Link>
            </p>
            <Link href="/" className="carimbo mt-3 inline-block hover:text-tinta">
              Voltar ao início
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
