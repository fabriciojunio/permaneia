import Link from "next/link";
import { MODO_DEMO, CONTAS_DEMO } from "@/lib/demo";
import { FormularioLogin } from "./FormularioLogin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-sm text-tinta-400 hover:text-tinta-200">
        ← Voltar
      </Link>

      <h1 className="mb-2 text-3xl text-tinta-50">PermaneIA</h1>
      <p className="mb-8 text-sm text-tinta-400">
        Assistente de estudos e painel de risco de evasão.
      </p>

      <FormularioLogin modoDemo={MODO_DEMO} contasDemo={MODO_DEMO ? CONTAS_DEMO : []} />

      <p className="mt-6 text-center text-sm text-tinta-400">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-permanencia-400 hover:text-permanencia-300">
          Criar conta de aluno
        </Link>
      </p>
    </main>
  );
}
