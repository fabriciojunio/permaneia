import Link from "next/link";
import { DOMINIOS_PERMITIDOS } from "@/lib/cadastro";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";
import { FormularioCadastro } from "./FormularioCadastro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Criar conta" };

export default function PaginaCadastro() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 border-b-2 border-tinta pb-3">
        <p className="carimbo">Ficha de cadastro · Aluno</p>
      </div>

      <h1 className="font-display text-3xl text-tinta">Criar conta</h1>
      <p className="mb-8 mt-2 text-[15px] leading-relaxed text-tinta-media">
        A conta dá acesso ao assistente de estudos. O painel de risco é restrito à coordenação
        pedagógica e não é liberado por este cadastro.
        {DOMINIOS_PERMITIDOS.length > 0 && (
          <> Apenas e-mails de {DOMINIOS_PERMITIDOS.join(", ")} são aceitos.</>
        )}
      </p>

      <FormularioCadastro tamanhoMinimoSenha={TAMANHO_MINIMO_SENHA} />

      <div className="mt-8 border-t border-regua pt-4 text-center">
        <p className="text-sm text-tinta-media">
          Já tem conta?{" "}
          <Link href="/login" className="text-sagrado underline underline-offset-2 hover:text-sagrado-escuro">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
