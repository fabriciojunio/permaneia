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
    <div className="min-h-screen">
      <header className="nao-imprime border-b-2 border-tinta bg-papel-alto">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-regua py-2">
            <Link href="/inicio" className="font-display text-lg text-tinta">
              Permane<span className="text-sagrado">IA</span>
            </Link>
            <div className="flex items-baseline gap-4">
              <span className="carimbo hidden sm:inline">
                {primeiroNome(sessao.nome)} · {rotuloPapel(sessao.papel)}
              </span>
              <BotaoSair />
            </div>
          </div>

          <nav aria-label="Navegação principal" className="flex flex-wrap">
            {itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b-2 border-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-carimbo text-tinta-media transition-colors hover:border-sagrado hover:text-tinta"
              >
                {item.rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
