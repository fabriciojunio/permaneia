import type { Config } from "tailwindcss";

// Identidade: documento acadêmico impresso, na cor da instituição.
//
// Os vermelhos vêm do manual da marca do UNISAGRADO (CMYK 15/100/90/10,
// 0/90/85/0 e 0/80/95/0), convertidos para tela com a saturação reduzida.
// Nenhum ativo da marca é usado: só a paleta.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        papel: {
          DEFAULT: "#f6f3ed",
          alto: "#fffdfa",
          fundo: "#ebe5da",
        },
        tinta: {
          DEFAULT: "#221e1a",
          forte: "#11100e",
          media: "#4c453d",
          fraca: "#7d746a",
          apagada: "#a89e91",
        },
        regua: {
          DEFAULT: "#d7cfc1",
          forte: "#b8ad9c",
          fraca: "#e9e3d8",
        },
        sagrado: {
          escuro: "#7d1622",
          DEFAULT: "#a81c2b",
          medio: "#c62828",
          claro: "#d94f2b",
          fraco: "#f5e6e4",
        },
        // Única escala além do vermelho institucional. A etiqueta sempre traz o
        // texto junto, então a cor não é o único canal de informação.
        risco: {
          baixo: "#2f6b4a",
          medio: "#8a6410",
          alto: "#b35418",
          critico: "#7d1622",
        },
      },
      fontFamily: {
        display: ["var(--fonte-display)", "Rockwell", "Georgia", "serif"],
        sans: ["var(--fonte-sans)", "Franklin Gothic", "system-ui", "sans-serif"],
        mono: ["var(--fonte-mono)", "Courier New", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        carimbo: "0.15em",
      },
      boxShadow: {
        folha: "0 1px 0 rgba(34, 30, 26, 0.05), 0 1px 2px rgba(34, 30, 26, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
