import { FormularioTrocarSenha } from "./FormularioTrocarSenha";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trocar senha" };

export default function PaginaTrocarSenha() {
  return (
    <main id="conteudo" className="folha-tela max-w-6xl">
      <div className="carimbo flex items-baseline justify-between gap-x-6 border-b-2 border-tinta pb-2 pt-5">
        <span>
          Unisagrado · Inteligência Artificial
          <span className="hidden sm:inline"> · Quinta-feira</span>
        </span>
        <span className="hidden sm:inline">2026-2</span>
      </div>

      <div className="grid flex-1 content-center items-start gap-x-16 gap-y-10 py-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <p className="carimbo">Senha provisória</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-tinta">
            Defina uma nova senha
          </h1>
          <p className="mt-4 max-w-[34rem] text-[15px] leading-[1.7] text-tinta-media">
            Sua conta está com senha provisória. Escolha uma senha com pelo menos{" "}
            {TAMANHO_MINIMO_SENHA} caracteres, contendo letra e número. Enquanto ela não for
            trocada, o acesso ao restante do sistema fica bloqueado.
          </p>
        </div>

        <div className="order-first lg:order-none lg:sticky lg:top-8">
          <FormularioTrocarSenha />
        </div>
      </div>

      <footer className="rodape-folha">
        <p className="carimbo">Projeto prático de IA generativa</p>
        <p className="carimbo">Prof. Patrick Pedreira Silva</p>
      </footer>
    </main>
  );
}
