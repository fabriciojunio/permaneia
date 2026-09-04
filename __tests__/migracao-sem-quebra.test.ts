import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Reprova migração que derruba a versão anterior do código.
 *
 * ## O problema
 *
 * Publicar na Vercel não derruba a versão antiga para subir a nova: as duas
 * atendem ao mesmo tempo enquanto o tráfego migra, e a antiga continua servindo
 * quem já estava com a página aberta. Se a migração apagou uma coluna que essa
 * versão ainda lê, a janela vira erro na cara de quem estava usando o sistema.
 * O mesmo vale para renomear coluna e para trocar o tipo dela.
 *
 * ## O processo que isto obriga
 *
 * Expandir, migrar e contrair, em três publicações separadas:
 *
 * 1. **Expandir.** A coluna nova entra ao lado da antiga, aceitando nulo. O
 *    código escreve nas duas e lê da antiga. Nada quebra, porque nada saiu.
 * 2. **Migrar.** Os dados são copiados para a coluna nova e o código passa a
 *    ler dela. A antiga continua lá, para o caso de precisar voltar atrás.
 * 3. **Contrair.** Só quando a versão anterior não existe mais em lugar nenhum,
 *    a coluna antiga sai.
 *
 * Este teste não impede o terceiro passo. Ele impede que ele aconteça sem
 * alguém ter escrito, no próprio arquivo, que sabe o que está fazendo. A marca
 * é a linha `-- contrair:` com o motivo, e existe para forçar a pergunta na
 * revisão em vez de na madrugada seguinte.
 */

/**
 * A marca que libera um comando destrutivo, com o motivo do lado.
 *
 * O motivo tem que estar na mesma linha: com `\s` o padrão atravessa a quebra e
 * engole o próprio comando como se fosse justificativa, e aí a marca vazia
 * liberaria qualquer coisa. Exigir o motivo, e não só a marca, é o que separa
 * uma decisão de um comentário colado para o teste passar.
 */
const MARCA_DE_CONTRACAO = /--[^\S\n]*contrair:[^\S\n]*\S+/i;

/**
 * Comandos que quebram a versão anterior do código enquanto ela ainda atende.
 *
 * `drop table` não está aqui de propósito: tabela inteira sumindo é grande
 * demais para passar despercebido numa revisão, e esta lista existe para pegar
 * o que passa.
 */
const DESTRUTIVOS: Array<[string, RegExp]> = [
  ["apaga coluna", /\balter\s+table\s+\S+\s+drop\s+column\b/i],
  ["renomeia coluna", /\balter\s+table\s+\S+\s+rename\s+column\b/i],
  ["troca o tipo da coluna", /\balter\s+column\s+\S+\s+type\b/i],
  ["passa a exigir valor", /\balter\s+column\s+\S+\s+set\s+not\s+null\b/i],
];

const RAIZ_DAS_MIGRACOES = path.resolve(__dirname, "..", "prisma", "migrations");

function arquivosDeMigracao(diretorio = RAIZ_DAS_MIGRACOES): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = path.join(diretorio, nome);
    if (statSync(caminho).isDirectory()) return arquivosDeMigracao(caminho);
    return caminho.endsWith(".sql") ? [caminho] : [];
  });
}

function problemasEm(nome: string, conteudo: string): string[] {
  if (MARCA_DE_CONTRACAO.test(conteudo)) return [];

  // O comentário sai antes da busca, senão a própria explicação de uma
  // migração ("acrescenta a coluna que vai substituir a que será apagada")
  // reprovaria o arquivo.
  const semComentario = conteudo
    .split("\n")
    .map((linha) => linha.replace(/--.*$/, ""))
    .join("\n");

  return DESTRUTIVOS.filter(([, padrao]) => padrao.test(semComentario)).map(
    ([descricao]) => `${nome} ${descricao}`
  );
}

describe("migração sem quebrar a versão anterior", () => {
  it("existe pelo menos uma migração para conferir, senão este teste não prova nada", () => {
    expect(arquivosDeMigracao()).not.toHaveLength(0);
  });

  it("nenhuma migração derruba a versão anterior sem dizer que é de propósito", () => {
    const problemas = arquivosDeMigracao().flatMap((caminho) =>
      problemasEm(path.basename(path.dirname(caminho)), readFileSync(caminho, "utf-8"))
    );

    expect(
      problemas,
      [
        "Migração destrutiva encontrada. Publicar não derruba a versão antiga:",
        "as duas atendem ao mesmo tempo enquanto o tráfego migra, e apagar ou",
        "renomear coluna que a versão anterior ainda lê quebra quem estiver",
        "usando o sistema naquele instante.",
        "",
        "Faça em três passos: acrescente a coluna nova ao lado da antiga, migre",
        "os dados e só então apague. Se esta migração JÁ é o terceiro passo,",
        "escreva no topo dela a linha:",
        "",
        "    -- contrair: <por que a versão anterior não existe mais>",
      ].join("\n")
    ).toEqual([]);
  });

  it.each([
    "alter table consulta drop column resposta;",
    "ALTER TABLE Consulta DROP COLUMN resposta;",
    "alter table aluno rename column nome to nome_completo;",
    'alter table "Matricula" alter column faltas type integer;',
    "alter table matricula alter column risco set not null;",
  ])("reconhece a forma que quebra, em qualquer caixa: %s", (comando) => {
    expect(problemasEm("teste", comando)).not.toEqual([]);
  });

  it.each([
    "alter table consulta add column origem text;",
    'create index "Chunk_documentoId_idx" on "Chunk"("documentoId");',
    "update matricula set risco = null where risco = '';",
    "alter table matricula alter column risco drop not null;",
    "create extension if not exists vector;",
  ])("deixa passar o que é compatível com a versão anterior: %s", (comando) => {
    expect(problemasEm("teste", comando)).toEqual([]);
  });

  it("a marca de contração libera, e é o que documenta a decisão", () => {
    const marcado = [
      "-- contrair: a coluna resposta saiu do código na publicação de 02/09/2026",
      "alter table consulta drop column resposta;",
    ].join("\n");

    expect(problemasEm("V9_contrai", marcado)).toEqual([]);
  });

  it("a marca sem motivo não libera, senão vira comentário colado para o teste passar", () => {
    const semMotivo = ["-- contrair:", "alter table consulta drop column resposta;"].join("\n");

    expect(problemasEm("V9_contrai", semMotivo)).not.toEqual([]);
  });

  it("comentário que só menciona a palavra não conta como marca", () => {
    const soFalando = [
      "-- esta migração é o passo de expandir; a contração vem depois",
      "alter table consulta drop column resposta;",
    ].join("\n");

    expect(problemasEm("V9_expande", soFalando)).not.toEqual([]);
  });
});
