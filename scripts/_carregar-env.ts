// Carrega o .env nos scripts executados fora do Next.
//
// O Next lê o .env sozinho, mas `tsx script.ts` não. Em vez de acrescentar uma
// dependência para isso, o arquivo é lido aqui: o formato que usamos é simples
// e um leitor de vinte linhas cobre todo ele.
//
// Importe este módulo ANTES de qualquer coisa que leia process.env.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function carregar(arquivo: string): void {
  const caminho = resolve(process.cwd(), arquivo);
  if (!existsSync(caminho)) return;

  for (const linha of readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const conteudo = linha.trim();
    if (!conteudo || conteudo.startsWith("#")) continue;

    const separador = conteudo.indexOf("=");
    if (separador === -1) continue;

    const chave = conteudo.slice(0, separador).trim();
    let valor = conteudo.slice(separador + 1).trim();

    // Remove as aspas do valor, se houver, mantendo o conteúdo interno intacto.
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }

    // O que já veio do ambiente tem precedência: no CI as variáveis são
    // injetadas pelo runner e um .env esquecido no disco não pode sobrescrevê-las.
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

carregar(".env.local");
carregar(".env");
