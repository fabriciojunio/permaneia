/** Valida parâmetros antes de consultar o banco ou chamar um provedor pago. */
export function configuracaoAvaliacao(
  argumento: string | undefined,
  data: string | undefined,
  modo: "local" | "gemini",
) {
  const limiar = argumento === undefined ? undefined : Number(argumento);
  if (argumento !== undefined && (
    argumento.trim() === "" || !Number.isFinite(limiar) || limiar! < 0 || limiar! > 1
  )) {
    throw new Error("O limiar deve ser um número entre 0 e 1.");
  }

  // Meio-dia de Brasília evita mudar o dia ao converter para o fuso do domínio.
  const hoje = data === undefined ? new Date() : new Date(`${data}T15:00:00.000Z`);
  if (data !== undefined && (
    !/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(hoje.getTime()) ||
    hoje.toISOString().slice(0, 10) !== data
  )) {
    throw new Error("RAG_DATA_REFERENCIA deve ser uma data válida no formato AAAA-MM-DD.");
  }
  return { limiar, hoje, pausaMs: modo === "local" ? 0 : 4_000 };
}
