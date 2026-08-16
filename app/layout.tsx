import type { Metadata, Viewport } from "next";
import { Courier_Prime, Libre_Franklin, Zilla_Slab } from "next/font/google";
import "./globals.css";

// next/font baixa e serve as fontes pela própria origem, o que mantém a CSP
// em font-src 'self'.
const zillaSlab = Zilla_Slab({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--fonte-display",
});

const libreFranklin = Libre_Franklin({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--fonte-sans",
});

const courierPrime = Courier_Prime({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--fonte-mono",
});

export const metadata: Metadata = {
  title: {
    default: "PermaneIA",
    template: "%s · PermaneIA",
  },
  description:
    "Assistente de estudos com RAG e painel de risco de evasão por lógica fuzzy, para coordenação pedagógica do ensino superior.",
  applicationName: "PermaneIA",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#a81c2b",
  width: "device-width",
  initialScale: 1,
};

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${zillaSlab.variable} ${libreFranklin.variable} ${courierPrime.variable}`}
    >
      <body className="min-h-screen antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-sagrado focus:bg-papel-alto focus:px-4 focus:py-2 focus:font-mono focus:text-sm"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
