import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Impede que uma marca combinante volte a ser escrita literalmente no código.
 *
 * ## O defeito que isto trava
 *
 * As barreiras do assistente normalizam o texto para NFD e removem as marcas de
 * acento antes de comparar. A classe de caracteres foi escrita com as marcas
 * LITERAIS entre colchetes. Funcionava em toda a suíte, funcionava no `npm run
 * dev`, e falhava no pacote publicado: alguma etapa entre o fonte e o artefato
 * altera esses pontos de código, e a classe deixava de casar. O sintoma era o
 * assistente respondendo a uma injeção de prompt escrita COM acento, que é
 * justamente como uma pessoa digita.
 *
 * Escrito como escape, `\u0300-\u036f`, o mesmo código sobrevive a
 * qualquer transformação, porque o que viaja são caracteres ASCII.
 *
 * ## Por que um teste, e não uma regra de lint
 *
 * A regra existiria em um arquivo que ninguém lê, com um nome que não conta a
 * história. Aqui, quem quebrar a trava lê o motivo junto com a falha.
 */

const RAIZ = path.resolve(__dirname, "..");

/** Onde procurar. O que é gerado ou baixado fica de fora. */
const PASTAS = ["lib", "app", "components", "scripts", "e2e", "__tests__"];
const ARQUIVOS_SOLTOS = ["middleware.ts"];

const EXTENSOES = new Set([".ts", ".tsx", ".mjs", ".js"]);

/**
 * O bloco Unicode das marcas combinantes, montado por código de propósito.
 *
 * Escrever o intervalo literalmente aqui reintroduziria, no próprio teste, o
 * defeito que ele existe para pegar.
 */
const MARCAS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]");

function arquivos(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = path.join(diretorio, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return EXTENSOES.has(path.extname(caminho)) ? [caminho] : [];
  });
}

function candidatos(): string[] {
  return [
    ...PASTAS.flatMap((pasta) => arquivos(path.join(RAIZ, pasta))),
    ...ARQUIVOS_SOLTOS.map((nome) => path.join(RAIZ, nome)),
  ];
}

describe("marca combinante nunca literal no código", () => {
  it("encontra arquivos para conferir, senão este teste passa sempre e não vale nada", () => {
    expect(candidatos().length).toBeGreaterThan(20);
  });

  it("nenhum arquivo do sistema traz marca combinante escrita à mão", () => {
    const problemas = candidatos()
      .map((caminho) => {
        const linhas = readFileSync(caminho, "utf-8").split(String.fromCharCode(10));
        const achadas = linhas
          .map((linha, i) => (MARCAS.test(linha) ? i + 1 : 0))
          .filter((n) => n > 0);
        return achadas.length > 0 ? `${path.relative(RAIZ, caminho)}:${achadas.join(",")}` : null;
      })
      .filter((p): p is string => p !== null);

    expect(
      problemas,
      [
        "Marca combinante escrita literalmente no código.",
        "",
        "Funciona no fonte, funciona no npm run dev, e falha no pacote",
        "publicado: as barreiras do assistente já quebraram exatamente assim,",
        "e o sintoma foi injeção de prompt COM acento passando pela recusa.",
        "",
        "Troque pelo escape: \u0300-\u036f",
      ].join(String.fromCharCode(10))
    ).toEqual([]);
  });

  it("a busca de fato acha a forma literal, senão a trava é decorativa", () => {
    const barra = String.fromCharCode(92);
    const literal = "texto.replace(/[" + String.fromCharCode(0x0300, 0x036f) + "]/g, '')";
    expect(MARCAS.test(literal)).toBe(true);

    // E deixa passar a forma escapada, que é a correta.
    const escapada = "texto.replace(/[" + barra + "u0300-" + barra + "u036f]/g, '')";
    expect(MARCAS.test(escapada)).toBe(false);
  });
});
