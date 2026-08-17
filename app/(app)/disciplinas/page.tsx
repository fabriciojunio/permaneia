import { prisma } from "@/lib/prisma";
import { GestaoDisciplinas } from "./GestaoDisciplinas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disciplinas" };

export default async function PaginaDisciplinas() {
  const disciplinas = await prisma.disciplina.findMany({
    select: {
      id: true,
      nome: true,
      professor: true,
      periodo: true,
      documentos: {
        select: { id: true, titulo: true, referencia: true, totalChunks: true, origem: true, criadoEm: true },
        orderBy: { criadoEm: "desc" },
      },
      _count: { select: { matriculas: true } },
    },
    orderBy: [{ periodo: "desc" }, { nome: "asc" }],
  });

  return (
    <div>
      <div className="grade border-b border-regua pb-6">
        <div className="margem">
          <p className="carimbo">Coordenação</p>
        </div>
        <div>
          <h1 className="font-display text-3xl text-tinta">Disciplinas e documentos</h1>
          <p className="mt-2 max-w-[38rem] text-[15px] leading-relaxed text-tinta-media">
            O assistente só responde com base no que estiver indexado aqui. Informe a data ou versão
            de cada documento: é essa referência que aparece na citação da resposta, e é ela que
            permite ao aluno perceber material desatualizado.
          </p>
        </div>
      </div>

      <GestaoDisciplinas
        disciplinas={disciplinas.map((d) => ({
          id: d.id,
          nome: d.nome,
          professor: d.professor,
          periodo: d.periodo,
          matriculas: d._count.matriculas,
          documentos: d.documentos.map((doc) => ({
            id: doc.id,
            titulo: doc.titulo,
            referencia: doc.referencia,
            totalChunks: doc.totalChunks,
            origem: doc.origem,
            criadoEm: doc.criadoEm.toISOString(),
          })),
        }))}
      />
    </div>
  );
}
