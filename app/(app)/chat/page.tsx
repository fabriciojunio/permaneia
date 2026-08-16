import { prisma } from "@/lib/prisma";
import { PainelChat } from "./PainelChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assistente de estudos" };

export default async function PaginaChat() {
  // Só disciplinas com documento indexado: oferecer uma vazia levaria o aluno
  // direto a um "não encontrei", e ele atribuiria a falha ao assistente.
  const disciplinas = await prisma.disciplina.findMany({
    where: { documentos: { some: {} } },
    select: {
      id: true,
      nome: true,
      professor: true,
      periodo: true,
      _count: { select: { documentos: true } },
    },
    orderBy: [{ periodo: "desc" }, { nome: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header className="border-b-2 border-tinta pb-3">
        <p className="carimbo mb-2">Aluno</p>
        <h1 className="font-display text-3xl text-tinta">Assistente de estudos</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-tinta-media">
          As respostas vêm apenas dos documentos oficiais da disciplina. Quando a informação não
          está no material, o assistente diz que não encontrou em vez de arriscar um palpite.
        </p>
      </header>

      {disciplinas.length === 0 ? (
        <div className="folha p-6">
          <h2 className="mb-2 text-lg text-tinta">Nenhum documento indexado ainda</h2>
          <p className="text-[15px] leading-relaxed text-tinta-media">
            O assistente só responde com base em documento enviado pela coordenação. Assim que uma
            ementa ou um cronograma for indexado, a disciplina aparece aqui.
          </p>
        </div>
      ) : (
        <PainelChat
          disciplinas={disciplinas.map((d) => ({
            id: d.id,
            nome: d.nome,
            professor: d.professor,
            periodo: d.periodo,
            documentos: d._count.documentos,
          }))}
        />
      )}
    </div>
  );
}
