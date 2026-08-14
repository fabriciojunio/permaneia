// Hash de senha e política de força.

import bcrypt from "bcryptjs";

/**
 * Custo do bcrypt. 12 é o ponto em que o hash leva algumas centenas de
 * milissegundos numa CPU serverless: caro o bastante para inviabilizar força
 * bruta em massa, barato o bastante para não estourar o tempo da função.
 */
export const CUSTO_BCRYPT = 12;

export const TAMANHO_MINIMO_SENHA = 10;

export async function gerarHash(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

/**
 * Confere a senha. Nunca propaga exceção: um hash corrompido no banco deve
 * significar "não autenticado", e não um 500 que revela que aquele usuário
 * existe e tem um registro quebrado.
 */
export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(senha, hash);
  } catch {
    return false;
  }
}

export type ForcaSenha = {
  valida: boolean;
  problemas: string[];
};

/** Senhas comuns demais para serem aceitas, mesmo satisfazendo as demais regras. */
const PROIBIDAS = new Set([
  "senha123456",
  "1234567890",
  "permaneia123",
  "unisagrado123",
  "administrador",
  "estudante123",
]);

/**
 * Política de senha.
 *
 * Comprimento pesa mais do que variedade de símbolo: exigir caractere especial
 * empurra o usuário para "Senha@123", que é adivinhável. Exigir dez caracteres
 * com letra e número, e barrar a lista de senhas óbvias, protege mais.
 */
export function avaliarForca(senha: string): ForcaSenha {
  const problemas: string[] = [];

  if (senha.length < TAMANHO_MINIMO_SENHA) {
    problemas.push(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }
  if (senha.length > 200) {
    // Limite superior porque o bcrypt trunca em 72 bytes e uma entrada enorme
    // só serviria para consumir CPU no hash.
    problemas.push("A senha não pode passar de 200 caracteres.");
  }
  if (!/[a-zA-ZÀ-ÿ]/.test(senha)) {
    problemas.push("A senha precisa conter ao menos uma letra.");
  }
  if (!/[0-9]/.test(senha)) {
    problemas.push("A senha precisa conter ao menos um número.");
  }
  if (/^(.)\1+$/.test(senha)) {
    problemas.push("A senha não pode ser um único caractere repetido.");
  }
  if (PROIBIDAS.has(senha.toLowerCase())) {
    problemas.push("Essa senha é fácil de adivinhar. Escolha outra.");
  }

  return { valida: problemas.length === 0, problemas };
}
