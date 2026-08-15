import { prisma } from "@/lib/prisma";
import { listarPainelDeRisco, resumoPorFaixa } from "@/lib/repositorios/matricula";
import { PainelRisco } from "./PainelRisco";

export const dynamic = "force-dynamic";
export const metadata = { title: "Painel de risco" };

export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: { disciplinaId?: string };
}) {
  const disciplinaId = searchParams.disciplinaId;

  const [disciplinas, painel, resumo] = await Promise.all([
    prisma.disciplina.findMany({
      select: { id: true, nome: true, periodo: true },
      orderBy: [{ periodo: "desc" }, { nome: "asc" }],
    }),
    listarPainelDeRisco({ disciplinaId, limite: 200 }),
    resumoPorFaixa(disciplinaId),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-tinta-50">Painel de risco de evasão</h1>
        <p className="mt-2 max-w-2xl text-tinta-400">
          Ordenado do mais crítico para o menos. Clique em uma linha para ver as regras fuzzy que produziram
          aquele score e a ação sugerida.
        </p>
      </header>

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
