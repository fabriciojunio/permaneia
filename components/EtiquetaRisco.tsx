import { ROTULO_FAIXA } from "@/lib/fuzzy/risco";

export type Faixa = "baixo" | "medio" | "alto" | "critico";

// A cor carrega informação, então nunca aparece sozinha: cada etiqueta traz o
// texto da faixa. Quem não distingue as matizes lê a mesma coisa.
const ESTILOS: Record<Faixa, string> = {
  baixo: "border-risco-baixo text-risco-baixo bg-papel-alto",
  medio: "border-risco-medio text-risco-medio bg-papel-alto",
  alto: "border-risco-alto text-risco-alto bg-papel-alto",
  critico: "border-risco-critico bg-risco-critico text-papel-alto",
};

export function EtiquetaRisco({ faixa, score }: { faixa: Faixa | null; score?: number | null }) {
  if (!faixa) {
    return <span className="etiqueta border-regua-forte text-tinta-fraca">sem cálculo</span>;
  }

  return (
    <span className={`etiqueta ${ESTILOS[faixa]}`}>
      {ROTULO_FAIXA[faixa].replace("Risco ", "")}
      {typeof score === "number" && <span className="opacity-70">{Math.round(score * 100)}</span>}
    </span>
  );
}
