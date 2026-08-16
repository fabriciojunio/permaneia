import Link from "next/link";
import { MODO_DEMO, CONTAS_DEMO } from "@/lib/demo";
import { FormularioLogin } from "./FormularioLogin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 border-b-2 border-tinta pb-3">
        <p className="carimbo">Unisagrado · 2026-2</p>
      </div>

      <h1 className="font-display text-4xl text-tinta">PermaneIA</h1>
      <p className="mb-8 mt-2 text-[15px] leading-relaxed text-tinta-media">
        Assistente de estudos e painel de risco de evasão.
      </p>

      <FormularioLogin modoDemo={MODO_DEMO} contasDemo={MODO_DEMO ? CONTAS_DEMO : []} />

      <div className="mt-8 border-t border-regua pt-4 text-center">
        <p className="text-sm text-tinta-media">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-sagrado underline underline-offset-2 hover:text-sagrado-escuro">
            Criar conta de aluno
          </Link>
        </p>
        <Link href="/" className="carimbo mt-3 inline-block hover:text-tinta">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
