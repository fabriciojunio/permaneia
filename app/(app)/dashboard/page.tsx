import { prisma } from "@/lib/prisma";
import { listarPainelDeRisco, resumoPorFaixa } from "@/lib/repositorios/matricula";
import { PainelRisco } from "./PainelRisco";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel de risco" };

export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ disciplinaId?: string }>;
}) {
  const { disciplinaId } = await searchParams;

  const [disciplinas, painel, resumo] = await Promise.all([
    prisma.disciplina.findMany({
      select: { id: true, nome: true, periodo: true },
      orderBy: [{ periodo: "desc" }, { nome: "asc" }],
    }),
    listarPainelDeRisco({ disciplinaId, limite: 200 }),
    resumoPorFaixa(disciplinaId),
  ]);

  return (
    <div>
      <div className="grade border-b border-regua pb-6">
        <div className="margem">
          <p className="carimbo">Coordenação</p>
        </div>
        <div>
          <h1 className="font-display text-3xl text-tinta">Painel de risco de evasão</h1>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-tinta-media">
            Ordenado do mais crítico para o menos. Clique em uma linha para ver as regras fuzzy que
            produziram aquele score e a ação sugerida.
          </p>
        </div>
      </div>

      <PainelRisco
        linhas={painel.linhas.map((l) => ({
          ...l,
          calculadoEm: l.calculadoEm ? l.calculadoEm.toISOString() : null,
        }))}
        total={painel.total}
        resumo={resumo}
        disciplinas={disciplinas}
        disciplinaSelecionada={disciplinaId ?? ""}
      />
    </div>
  );
}
