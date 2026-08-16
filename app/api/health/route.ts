import { prisma } from "@/lib/prisma";
import { origemAtual } from "@/lib/ia";
import { BASE_DE_REGRAS } from "@/lib/fuzzy/regras";
import { comTratamentoDeErro, respostaOk } from "@/lib/observabilidade";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Prontidão do serviço.
 *
 * Verifica o banco de verdade, com uma consulta, e não apenas se o processo
 * subiu: uma função serverless viva com o banco fora do ar continuaria
 * respondendo 200 num health check superficial, e o monitor não veria nada.
 *
 * A rota é pública de propósito, mas não devolve nada que ajude um atacante:
 * sem versão de biblioteca, sem host de banco, sem contagem de usuários.
 */
export const GET = comTratamentoDeErro(async () => {
  const inicio = Date.now();
  let bancoOk = false;
  let extensaoVetorOk = false;

  try {
    const linhas = await prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS existe
    `;
    bancoOk = true;
    extensaoVetorOk = linhas[0]?.existe === true;
  } catch {
    bancoOk = false;
  }

  const saudavel = bancoOk && extensaoVetorOk;
  const corpo = {
    estado: saudavel ? "saudavel" : "degradado",
    banco: bancoOk ? "ok" : "indisponivel",
    buscaVetorial: extensaoVetorOk ? "ok" : "indisponivel",
    // Qual provedor responderia agora. Não expõe a chave, só o modo de operação.
    provedorIa: origemAtual(),
    regrasFuzzy: BASE_DE_REGRAS.length,
    latenciaMs: Date.now() - inicio,
    momento: new Date().toISOString(),
  };

  if (!saudavel) return NextResponse.json(corpo, { status: 503 });
  return await respostaOk(corpo);
});
