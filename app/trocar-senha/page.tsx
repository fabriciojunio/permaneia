import { FormularioTrocarSenha } from "./FormularioTrocarSenha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trocar senha" };

export default function PaginaTrocarSenha() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-2 text-3xl text-tinta-50">Defina uma nova senha</h1>
      <p className="mb-8 text-sm text-tinta-400">
        Sua conta está com senha provisória. Escolha uma senha com pelo menos {TAMANHO_MINIMO_SENHA}{" "}
        caracteres, contendo letra e número.
      </p>
      <FormularioTrocarSenha />
    </main>
  );
}
