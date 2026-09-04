// Um trecho de rastro por consulta ao banco.
//
// O que o rastro dizia antes: que responder a pergunta do aluno levou 900 ms.
// O que ele não dizia: quanto disso foi a busca vetorial, quanto foi o Gemini e
// quanto foram as sete consultas que o carregamento de relação disparou por
// conta própria. É essa última que interessa, porque é a que ninguém escreveu.
//
// Instrumentar o cliente inteiro, e não repositório por repositório, é o que
// pega também o que o Prisma emite sozinho, incluindo a consulta dentro de laço
// que transforma uma ida ao banco em N. Esse caso só aparece quando alguém vê
// as linhas repetidas enfileiradas com o mesmo traceId.
//
// O QUE NÃO VAI PARA O TRECHO: o valor dos parâmetros. Telemetria sai da
// aplicação e fica guardada em outro lugar; matrícula, e-mail e nome de aluno
// não têm por que passear por lá (ver LGPD.md). A operação e a tabela bastam
// para identificar a consulta.

import type { PrismaClient } from "@prisma/client";
import { emitirTrecho } from "./rastro-ativo";

/** Limite do texto guardado. Comando gerado por ORM é enorme e ninguém lê o fim. */
const LIMITE_DO_TEXTO = 500;

/**
 * O verbo SQL correspondente a cada operação do Prisma.
 *
 * Fica em termos de SQL, e não do nome do método, para que o trecho signifique
 * a mesma coisa venha ele do cliente tipado ou de uma consulta escrita à mão,
 * que aqui são as duas metades: a busca vetorial é `$queryRaw` porque o Prisma
 * não conhece o tipo `vector` (ver docs/adr/005-vetor-unsupported-no-prisma.md).
 */
const VERBOS: Record<string, string> = {
  findUnique: "select",
  findUniqueOrThrow: "select",
  findFirst: "select",
  findFirstOrThrow: "select",
  findMany: "select",
  count: "select",
  aggregate: "select",
  groupBy: "select",
  create: "insert",
  createMany: "insert",
  update: "update",
  updateMany: "update",
  upsert: "update",
  delete: "delete",
  deleteMany: "delete",
};

/** As operações que carregam SQL escrito à mão, em que o texto é a fonte do nome. */
const CRUAS = new Set(["$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"]);

export function resumir(comando: string): string {
  const numaLinha = comando.replace(/\s+/g, " ").trim();
  return numaLinha.length <= LIMITE_DO_TEXTO ? numaLinha : `${numaLinha.slice(0, LIMITE_DO_TEXTO)}...`;
}

function tabelaDepoisDe(comando: string, marca: string): string {
  const inicio = comando.indexOf(marca);
  if (inicio < 0) return "?";
  const resto = comando.slice(inicio + marca.length).trim();
  const fim = resto.search(/[\s(;]/);
  const bruto = fim < 0 ? resto : resto.slice(0, fim);
  // Aspas em identificador são convenção do Postgres, não parte do nome.
  return bruto.replace(/["`]/g, "") || "?";
}

/**
 * O nome do trecho é a operação e a tabela, e nunca o comando inteiro.
 *
 * Painel e log agrupam por nome. Com o comando inteiro no nome, cada consulta
 * vira um grupo de uma linha só, e a pergunta "qual consulta está lenta em
 * geral" deixa de ter resposta.
 */
export function nomeDeConsultaCrua(comando: string): string {
  const limpo = comando.trim().toLowerCase();
  if (limpo.startsWith("select")) return `db select ${tabelaDepoisDe(limpo, " from ")}`;
  if (limpo.startsWith("insert")) return `db insert ${tabelaDepoisDe(limpo, " into ")}`;
  if (limpo.startsWith("update")) return `db update ${tabelaDepoisDe(limpo, "update ")}`;
  if (limpo.startsWith("delete")) return `db delete ${tabelaDepoisDe(limpo, " from ")}`;
  return "db comando";
}

/**
 * O texto do comando quando ele foi escrito à mão.
 *
 * O Prisma entrega a consulta com marcador de gabarito em três formatos
 * diferentes conforme a forma de chamada, e nenhum deles é documentado como
 * estável. Por isso a leitura é defensiva: sem o texto o trecho ainda sai, só
 * com nome genérico, e uma exceção aqui derrubaria a consulta de verdade por
 * causa da telemetria.
 */
export function textoDoComando(argumentos: unknown): string | null {
  if (typeof argumentos === "string") return argumentos;

  if (Array.isArray(argumentos)) {
    const primeiro = argumentos[0];
    if (typeof primeiro === "string") return primeiro;
    if (Array.isArray(primeiro)) return primeiro.join("?");
    return textoDoComando(primeiro);
  }

  if (argumentos && typeof argumentos === "object") {
    const objeto = argumentos as { sql?: unknown; strings?: unknown; text?: unknown; values?: unknown };
    if (typeof objeto.sql === "string") return objeto.sql;
    if (typeof objeto.text === "string") return objeto.text;
    if (Array.isArray(objeto.strings)) return objeto.strings.join("?");
  }

  return null;
}

/** O nome do trecho para uma operação qualquer do cliente. */
export function nomeDoTrecho(modelo: string | undefined, operacao: string, argumentos: unknown): string {
  if (CRUAS.has(operacao)) {
    const comando = textoDoComando(argumentos);
    return comando ? nomeDeConsultaCrua(comando) : "db comando";
  }
  const verbo = VERBOS[operacao];
  if (!verbo) return "db comando";
  // O nome do modelo, e não o da tabela: é o que aparece no código de quem vai
  // investigar. O mapeamento para a tabela está no schema, a um passo de
  // distância, e inverter isso obrigaria a consultar o schema para ler o log.
  return `db ${verbo} ${modelo ? modelo.toLowerCase() : "?"}`;
}

type Interceptacao = {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

/**
 * Devolve o cliente com a instrumentação aplicada.
 *
 * Sai desligada nos testes unitários: eles não tocam o banco, e a extensão só
 * acrescentaria ruído à saída. Em produção e em integração fica ligada.
 */
export function comRastroDeConsultas<T extends PrismaClient>(cliente: T): T {
  const registrar = async ({ model, operation, args, query }: Interceptacao) => {
    const inicio = Date.now();
    try {
      return await query(args);
    } finally {
      const atributos: Record<string, unknown> = {
        "db.system": "postgresql",
        "db.operation": operation,
      };
      if (model) atributos["db.model"] = model;
      if (CRUAS.has(operation)) {
        const comando = textoDoComando(args);
        // Só o gabarito da consulta, com os marcadores no lugar dos valores.
        if (comando) atributos["db.statement"] = resumir(comando);
      }
      emitirTrecho(nomeDoTrecho(model, operation, args), Date.now() - inicio, atributos);
    }
  };

  return cliente.$extends({
    name: "rastro-das-consultas",
    query: {
      $allModels: { $allOperations: registrar },
      // As consultas cruas não passam por $allModels: elas não têm modelo.
      // Sem esta segunda entrada, a busca vetorial, que é justamente a parte
      // lenta, seria a única invisível no rastro.
      $allOperations: registrar,
    },
  }) as unknown as T;
}
