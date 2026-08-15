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
  /** 0 a 4, para a barra de força do formulário. */
  pontuacao: number;
  rotulo: "muito fraca" | "fraca" | "razoável" | "boa" | "forte";
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
  if (SEQUENCIAS.some((s) => senha.toLowerCase().includes(s))) {
    problemas.push("A senha não pode conter uma sequência óbvia como \"1234\" ou \"abcd\".");
  }

  return {
    valida: problemas.length === 0,
    problemas,
    pontuacao: pontuar(senha),
    rotulo: ROTULOS[pontuar(senha)]!,
  };
}

const SEQUENCIAS = ["1234", "2345", "3456", "4567", "5678", "6789", "abcd", "qwer", "asdf"];

const ROTULOS = ["muito fraca", "fraca", "razoável", "boa", "forte"] as const;

/**
 * Pontuação de 0 a 4 para a barra de força.
 *
 * Serve à interface, não à decisão: quem aceita ou recusa a senha é
 * `avaliarForca`. Uma barra que diz "forte" para algo que a política recusa
 * seria pior do que não ter barra nenhuma, então a pontuação nunca passa de 1
 * enquanto a senha for inválida.
 */
export function pontuar(senha: string): number {
  if (senha.length < TAMANHO_MINIMO_SENHA) return senha.length === 0 ? 0 : 1;

  let pontos = 1;
  if (senha.length >= 14) pontos += 1;
  if (senha.length >= 20) pontos += 1;

  const variedade = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(senha)).length;
  if (variedade >= 3) pontos += 1;

  // Poucos caracteres distintos indicam repetição, que anula o ganho do comprimento.
  if (new Set(senha).size < Math.min(8, senha.length / 2)) pontos -= 1;

  return Math.max(0, Math.min(4, pontos));
}
