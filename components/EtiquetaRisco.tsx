import { ROTULO_FAIXA } from "@/lib/fuzzy/risco";

export type Faixa = "baixo" | "medio" | "alto" | "critico";

// A cor carrega informação aqui, então ela não pode ser o único canal: cada
// etiqueta traz também o texto da faixa. Quem não distingue verde de vermelho
// lê a mesma coisa que todo mundo.
const ESTILOS: Record<Faixa, string> = {
  baixo: "bg-permanencia-900/60 text-permanencia-200 ring-1 ring-inset ring-permanencia-700",
  medio: "bg-amber-950/60 text-amber-200 ring-1 ring-inset ring-amber-800",
  alto: "bg-orange-950/60 text-orange-200 ring-1 ring-inset ring-orange-800",
  critico: "bg-red-950/70 text-red-200 ring-1 ring-inset ring-red-800",
};

const PONTOS: Record<Faixa, string> = {
  baixo: "bg-risco-baixo",
  medio: "bg-risco-medio",
  alto: "bg-risco-alto",
  critico: "bg-risco-critico",
};

export function EtiquetaRisco({ faixa, score }: { faixa: Faixa | null; score?: number | null }) {
  if (!faixa) {
    return (
      <span className="etiqueta bg-tinta-700 text-tinta-300">
        <span className="h-1.5 w-1.5 rounded-full bg-tinta-400" aria-hidden="true" />
        Sem cálculo
      </span>
    );
  }

  return (
    <span className={`etiqueta ${ESTILOS[faixa]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${PONTOS[faixa]}`} aria-hidden="true" />
      {ROTULO_FAIXA[faixa]}
      {typeof score === "number" && (
        <span className="font-mono text-[11px] opacity-70">{Math.round(score * 100)}</span>
      )}
    </span>
  );
}
