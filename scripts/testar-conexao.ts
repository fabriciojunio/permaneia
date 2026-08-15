// Verifica a conexão com o banco e a presença da extensão de busca vetorial.
// Uso: npx tsx scripts/testar-conexao.ts

import "./_carregar-env";
import { prisma } from "../lib/prisma";

async function main() {
  const identidade = await prisma.$queryRaw<Array<{ usuario: string; versao: string }>>`
    SELECT current_user AS usuario, current_setting('server_version') AS versao
  `;
  console.log("Conectado como:", identidade[0]?.usuario, "| Postgres", identidade[0]?.versao);

  const extensao = await prisma.$queryRaw<Array<{ existe: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS existe
  `;
  console.log("Extensão pgvector:", extensao[0]?.existe ? "presente" : "AUSENTE");

  const tabelas = await prisma.$queryRaw<Array<{ tabela: string }>>`
    SELECT tablename AS tabela FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log("Tabelas:", tabelas.map((t) => t.tabela).join(", "));

  const contagens = {
    usuarios: await prisma.usuario.count(),
    alunos: await prisma.aluno.count(),
    disciplinas: await prisma.disciplina.count(),
    matriculas: await prisma.matricula.count(),
    documentos: await prisma.documento.count(),
  };
  console.log("Contagens:", JSON.stringify(contagens));
}

main()
  .catch((e) => {
    console.error("FALHOU:", (e as Error).message.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
