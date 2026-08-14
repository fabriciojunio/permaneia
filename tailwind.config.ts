import type { Config } from "tailwindcss";

// Identidade visual: contexto acadêmico brasileiro, tom sóbrio de painel
// institucional. Verde-ensino como cor de marca (permanência, continuidade) e
// uma escala de risco que vai do verde ao vermelho, usada tanto no dashboard
// quanto na apresentação.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        tinta: {
          50: "#f4f6f8",
          100: "#e6eaef",
          200: "#c9d2dc",
          300: "#9fadbe",
          400: "#71829a",
          500: "#4f6079",
          600: "#3a4a60",
          700: "#2b3849",
          800: "#1d2735",
          900: "#141b26",
          950: "#0b1018",
        },
        permanencia: {
          50: "#eefbf3",
          100: "#d6f5e3",
          200: "#b0e9cb",
          300: "#7bd7ac",
          400: "#45bd8a",
          500: "#22a06e",
          600: "#158058",
          700: "#126749",
          800: "#12523b",
          900: "#104432",
        },
        risco: {
          baixo: "#22a06e",
          medio: "#d9a015",
          alto: "#e2703a",
          critico: "#d0473f",
        },
      },
      fontFamily: {
        sans: ["var(--fonte-texto)", "system-ui", "sans-serif"],
        display: ["var(--fonte-titulo)", "var(--fonte-texto)", "system-ui", "sans-serif"],
        mono: ["var(--fonte-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        painel: "0 1px 2px rgba(11, 16, 24, 0.28), 0 8px 24px -12px rgba(11, 16, 24, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
