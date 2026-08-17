import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { podeFazer } from "@/lib/acesso";
import { primeiroNome, rotuloPapel } from "@/lib/formato";
import { BotaoSair } from "@/components/BotaoSair";

export const dynamic = "force-dynamic";

export default async function LayoutAplicacao({ children }: { children: React.ReactNode }) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/login");

  const itens = [
    { href: "/inicio", rotulo: "Início", visivel: true },
    { href: "/chat", rotulo: "Assistente", visivel: podeFazer(sessao.papel, "chat.perguntar") },
    { href: "/dashboard", rotulo: "Painel de risco", visivel: podeFazer(sessao.papel, "dashboard.ver") },
    { href: "/disciplinas", rotulo: "Disciplinas", visivel: podeFazer(sessao.papel, "disciplina.escrever") },
    { href: "/privacidade", rotulo: "Meus dados", visivel: true },
  ].filter((i) => i.visivel);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6">
      <header className="nao-imprime">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-tinta pb-2 pt-5">
          <Link href="/inicio" className="font-display text-xl text-tinta">
            Permane<span className="text-sagrado">IA</span>
          </Link>
          <div className="flex items-baseline gap-5">
            <span className="carimbo hidden sm:inline">
              {primeiroNome(sessao.nome)} · {rotuloPapel(sessao.papel)}
            </span>
            <BotaoSair />
          </div>
        </div>

        <nav
          aria-label="Navegação principal"
          className="flex flex-wrap gap-x-6 border-b border-regua py-1.5"
        >
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-[11px] uppercase tracking-carimbo text-tinta-media transition-colors hover:text-sagrado"
            >
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </header>

      <main id="conteudo" className="py-8">
        {children}
      </main>
    </div>
  );
}
