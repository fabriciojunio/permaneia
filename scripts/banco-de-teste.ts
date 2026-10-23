/** Impede que suítes que escrevem fixtures usem o banco normal da aplicação. */
export function validarBancoDeTeste(valor: string | undefined): string {
  if (!valor) throw new Error("Configure TEST_DATABASE_URL com um banco exclusivo para testes.");
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error("URL do banco de testes inválida."); }
  const nome = decodeURIComponent(url.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !/(^|[_-])(test|testing|ci|e2e)([_-]|$)/i.test(nome)
  ) {
    throw new Error("O nome do banco deve identificar um ambiente test, testing, ci ou e2e. Nenhum dado foi alterado.");
  }
  return valor;
}
