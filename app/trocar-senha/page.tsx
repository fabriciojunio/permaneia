import { FormularioTrocarSenha } from "./FormularioTrocarSenha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trocar senha" };

export default function PaginaTrocarSenha() {
  return (
    <main id="conteudo" className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 border-b-2 border-tinta pb-3">
        <p className="carimbo">Senha provisória</p>
      </div>

      <h1 className="font-display text-3xl text-tinta">Defina uma nova senha</h1>
      <p className="mb-8 mt-2 text-[15px] leading-relaxed text-tinta-media">
        Sua conta está com senha provisória. Escolha uma senha com pelo menos{" "}
        {TAMANHO_MINIMO_SENHA} caracteres, contendo letra e número.
      </p>

      <FormularioTrocarSenha />
    </main>
  );
}
