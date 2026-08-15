import Link from "next/link";
import { DOMINIOS_PERMITIDOS } from "@/lib/cadastro";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";
import { FormularioCadastro } from "./FormularioCadastro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar conta" };

export default function PaginaCadastro() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-sm text-tinta-400 hover:text-tinta-200">
        ← Voltar
      </Link>

      <h1 className="mb-2 text-3xl text-tinta-50">Criar conta</h1>
      <p className="mb-8 text-sm leading-relaxed text-tinta-400">
        A conta dá acesso ao assistente de estudos. O painel de risco é restrito à coordenação pedagógica e
        não é liberado por este cadastro.
        {DOMINIOS_PERMITIDOS.length > 0 && (
          <> Apenas e-mails de {DOMINIOS_PERMITIDOS.join(", ")} são aceitos.</>
        )}
      </p>

      <FormularioCadastro tamanhoMinimoSenha={TAMANHO_MINIMO_SENHA} />

      <p className="mt-6 text-center text-sm text-tinta-400">
        Já tem conta?{" "}
        <Link href="/login" className="text-permanencia-400 hover:text-permanencia-300">
          Entrar
        </Link>
      </p>
    </main>
  );
}
