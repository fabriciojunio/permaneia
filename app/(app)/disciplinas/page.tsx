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
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-tinta-50">Disciplinas e documentos</h1>
        <p className="mt-2 max-w-2xl text-tinta-400">
          O assistente só responde com base no que estiver indexado aqui. Envie a ementa, o cronograma e o
          contrato didático, e informe a data ou versão de cada documento: é essa referência que aparece na
          citação da resposta.
        </p>
      </header>

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
