import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

// next/font baixa a fonte no build e a serve pela própria origem. Isso mantém a
// CSP em font-src 'self' e evita uma requisição a um domínio de terceiro a cada
// carregamento de página.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--fonte-inter",
});

const lora = Lora({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--fonte-lora",
});

export const metadata: Metadata = {
  title: {
    default: "PermaneIA",
    template: "%s · PermaneIA",
  },
  description:
    "Assistente de estudos com RAG e painel de risco de evasão por lógica fuzzy, para coordenação pedagógica do ensino superior.",
  applicationName: "PermaneIA",
  // A aplicação lida com dado acadêmico e não tem por que aparecer em busca.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1018",
  width: "device-width",
  initialScale: 1,
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen antialiased">
        {/* Atalho de teclado para quem navega sem mouse pular a navegação. */}
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-permanencia-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
