// Política de quem pode abrir conta pelo cadastro público.
//
// Vazia, a lista aceita qualquer e-mail válido, que é o comportamento adequado
// para a demonstração acadêmica: o professor e os colegas precisam conseguir
// entrar com o endereço que tiverem. Preenchida com os domínios da instituição,
// ela fecha o cadastro para fora dela, que é o comportamento adequado a um uso
// real.

/** Domínios aceitos no cadastro. Configurável por `DOMINIOS_CADASTRO`, separados por vírgula. */
export const DOMINIOS_PERMITIDOS: string[] = (process.env.DOMINIOS_CADASTRO ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
  .filter((d) => d.length > 0);

export function dominioPermitido(email: string): boolean {
  if (DOMINIOS_PERMITIDOS.length === 0) return true;
  const dominio = email.split("@")[1]?.toLowerCase();
  if (!dominio) return false;
  // Aceita o domínio exato e os subdomínios dele, para instituição que usa
  // endereços do tipo aluno.instituicao.edu.br.
  return DOMINIOS_PERMITIDOS.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}
