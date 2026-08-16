import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { podeFazer } from "@/lib/acesso";
import { primeiroNome, rotuloPapel } from "@/lib/formato";
import { BotaoSair } from "@/components/BotaoSair";

export const dynamic = "force-dynamic";

export default function LayoutAplicacao({ children }: { children: React.ReactNode }) {
  const sessao = sessaoAtual();
  // O middleware já barra quem não tem sessão. Este redirecionamento cobre a
  // hipótese de a página ser renderizada fora daquele caminho.
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
      <header className="border-b border-tinta-700 bg-tinta-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/inicio" className="font-display text-lg text-tinta-50">
            Permane<span className="text-permanencia-400">IA</span>
          </Link>

          <nav aria-label="Navegação principal" className="flex flex-wrap gap-1">
            {itens.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm text-tinta-300 transition-colors hover:bg-tinta-800 hover:text-tinta-50"
              >
                {item.rotulo}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-tinta-400 sm:inline">
              {primeiroNome(sessao.nome)} · {rotuloPapel(sessao.papel)}
            </span>
            <BotaoSair />
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-6xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
