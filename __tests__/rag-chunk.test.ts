import { describe, expect, it } from "vitest";
import {
  SOBREPOSICAO,
  TAMANHO_ALVO,
  TAMANHO_MINIMO,
  dividirEmTrechos,
  limparTexto,
  recortarCauda,
  unidadesAtomicas,
} from "@/lib/rag/chunk";

describe("limparTexto", () => {
  it("normaliza quebras de linha do Windows", () => {
    expect(limparTexto("a\r\nb")).toBe("a b");
  });

  it("junta palavra hifenizada no fim da linha, comum em PDF", () => {
    expect(limparTexto("avalia-\ncao")).toBe("avaliacao");
    expect(limparTexto("disci-\nplina")).toBe("disciplina");
  });

  it("não junta quando a quebra separa palavras distintas", () => {
    expect(limparTexto("prova P1\nem setembro")).toBe("prova P1 em setembro");
  });

  it("quebra simples vira espaço, quebra dupla é separador de parágrafo", () => {
    expect(limparTexto("linha um\nlinha dois")).toBe("linha um linha dois");
    expect(limparTexto("parágrafo um\n\nparágrafo dois")).toBe("parágrafo um\n\nparágrafo dois");
  });

  it("colapsa três ou mais quebras em duas", () => {
    expect(limparTexto("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("colapsa espaços e tabulações repetidos", () => {
    expect(limparTexto("muitos     espaços")).toBe("muitos espaços");
    expect(limparTexto("com\t\ttabulação")).toBe("com tabulação");
  });

  it("remove espaços das bordas de cada linha", () => {
    expect(limparTexto("  a  \n\n  b  ")).toBe("a\n\nb");
  });

  it("texto vazio permanece vazio", () => {
    expect(limparTexto("")).toBe("");
    expect(limparTexto("   \n\n   ")).toBe("");
  });

  it("preserva acentuação", () => {
    expect(limparTexto("Inteligência Artificial")).toBe("Inteligência Artificial");
  });
});

describe("unidadesAtomicas", () => {
  it("separa por parágrafo", () => {
    expect(unidadesAtomicas("um\n\ndois\n\ntrês")).toEqual(["um", "dois", "três"]);
  });

  it("quebra parágrafo grande demais por frase", () => {
    const paragrafo = `${"a".repeat(60)}. ${"b".repeat(60)}. ${"c".repeat(60)}.`;
    const u = unidadesAtomicas(paragrafo, 100);
    expect(u.length).toBeGreaterThan(1);
    for (const unidade of u) expect(unidade.length).toBeLessThanOrEqual(100);
  });

  it("corta na força bruta apenas frase maior que o alvo", () => {
    const frase = "x".repeat(250);
    const u = unidadesAtomicas(frase, 100);
    expect(u).toHaveLength(3);
    expect(u[0]).toHaveLength(100);
  });

  it("mantém o ponto final na frase que termina", () => {
    const u = unidadesAtomicas(`${"a".repeat(50)}. ${"b".repeat(50)}.`, 60);
    expect(u[0]!.endsWith(".")).toBe(true);
  });

  it("descarta parágrafos vazios", () => {
    expect(unidadesAtomicas("um\n\n\n\n\n\ndois")).toEqual(["um", "dois"]);
  });

  it("texto vazio devolve lista vazia", () => {
    expect(unidadesAtomicas("")).toEqual([]);
  });
});

describe("recortarCauda", () => {
  it.each([
    ["", 10, ""],
    ["curto", 10, "curto"],
    ["abc", 0, ""],
    ["abc", -5, ""],
  ])("com texto %s e n=%s devolve %s", (texto, n, esperado) => {
    expect(recortarCauda(texto, n)).toBe(esperado);
  });

  it("começa numa fronteira de palavra, para não cortar termo ao meio", () => {
    const cauda = recortarCauda("uma frase razoavelmente longa para testar o corte", 20);
    expect(cauda.startsWith(" ")).toBe(false);
    expect("uma frase razoavelmente longa para testar o corte").toContain(cauda);
  });

  it("prefere começar depois de um fim de frase", () => {
    // O trecho é mostrado literalmente ao aluno como citação; começar em
    // "de 2026, quinta-feira." parece defeito do sistema.
    const texto = "Primeira frase qualquer. Segunda frase bem mais longa que serve de cauda.";
    const cauda = recortarCauda(texto, 60);
    expect(cauda.startsWith("Segunda")).toBe(true);
  });

  it("cai para a fronteira de palavra quando não há fim de frase na janela", () => {
    const cauda = recortarCauda("palavras sem nenhuma pontuacao final aqui dentro", 20);
    expect(cauda).not.toContain(".");
    expect(cauda.startsWith(" ")).toBe(false);
  });

  it("nunca devolve mais que n caracteres", () => {
    const texto = "palavra ".repeat(50);
    for (const n of [5, 10, 40, 100]) {
      expect(recortarCauda(texto, n).length).toBeLessThanOrEqual(n);
    }
  });

  it("a cauda é sufixo do texto original", () => {
    const texto = "o cronograma da disciplina de inteligência artificial";
    const cauda = recortarCauda(texto, 25);
    expect(texto.endsWith(cauda)).toBe(true);
  });
});

describe("dividirEmTrechos", () => {
  const cronograma = Array.from(
    { length: 20 },
    (_, i) => `${String(i + 1).padStart(2, "0")} de mês de 2026, quinta-feira. Aula normal. Conteúdo número ${i + 1} da disciplina.`
  ).join("\n\n");

  it("texto vazio devolve lista vazia", () => {
    expect(dividirEmTrechos("")).toEqual([]);
    expect(dividirEmTrechos("   \n\n  ")).toEqual([]);
  });

  it("numera os trechos a partir de zero, sem furos", () => {
    const trechos = dividirEmTrechos(cronograma, 300, 60);
    expect(trechos.map((t) => t.indice)).toEqual(trechos.map((_, i) => i));
  });

  it("nenhum trecho é vazio", () => {
    for (const t of dividirEmTrechos(cronograma, 300, 60)) {
      expect(t.texto.trim().length).toBeGreaterThan(0);
    }
  });

  it("todo trecho tem tamanho compatível com o alvo mais a sobreposição", () => {
    const alvo = 300;
    for (const t of dividirEmTrechos(cronograma, alvo, 60)) {
      expect(t.texto.length).toBeLessThanOrEqual(alvo + 60 + 200);
    }
  });

  it("alvo menor produz mais trechos", () => {
    const grandes = dividirEmTrechos(cronograma, 1500, 100);
    const pequenos = dividirEmTrechos(cronograma, 300, 60);
    expect(pequenos.length).toBeGreaterThan(grandes.length);
  });

  it("preserva a informação: todo conteúdo aparece em algum trecho", () => {
    const trechos = dividirEmTrechos(cronograma, 300, 60);
    const tudo = trechos.map((t) => t.texto).join(" ");
    for (let i = 1; i <= 20; i += 1) {
      expect(tudo).toContain(`Conteúdo número ${i} `);
    }
  });

  it("a sobreposição garante que informação na fronteira apareça inteira", () => {
    const trechos = dividirEmTrechos(cronograma, 300, 100);
    let houveSobreposicao = false;
    for (let i = 1; i < trechos.length; i += 1) {
      const fimAnterior = trechos[i - 1]!.texto.slice(-40);
      if (trechos[i]!.texto.includes(fimAnterior.trim().slice(0, 20))) houveSobreposicao = true;
    }
    expect(houveSobreposicao).toBe(true);
  });

  it("sem sobreposição, os trechos não se repetem", () => {
    const trechos = dividirEmTrechos(cronograma, 300, 0);
    expect(trechos.length).toBeGreaterThan(1);
    for (let i = 1; i < trechos.length; i += 1) {
      expect(trechos[i]!.texto).not.toBe(trechos[i - 1]!.texto);
    }
  });

  it("um texto curto vira um único trecho", () => {
    const trechos = dividirEmTrechos("Uma frase curta apenas.", 2000, 200);
    expect(trechos).toHaveLength(1);
    expect(trechos[0]!.texto).toBe("Uma frase curta apenas.");
  });

  it("junta um último trecho curto demais ao anterior", () => {
    // Sobra de rodapé indexada sozinha só produziria ruído na busca.
    const texto = `${"a".repeat(300)}\n\n${"b".repeat(300)}\n\ncurto`;
    const trechos = dividirEmTrechos(texto, 320, 0);
    expect(trechos[trechos.length - 1]!.texto.length).toBeGreaterThanOrEqual(TAMANHO_MINIMO);
  });

  it.each([
    [0, 10],
    [-100, 10],
  ])("rejeita alvo inválido (%s)", (alvo, sobreposicao) => {
    expect(() => dividirEmTrechos("texto", alvo, sobreposicao)).toThrow(/maior que zero/);
  });

  it("rejeita sobreposição negativa", () => {
    expect(() => dividirEmTrechos("texto", 100, -5)).toThrow(/negativa/);
  });

  it("rejeita sobreposição maior ou igual ao alvo, que faria o laço não avançar", () => {
    expect(() => dividirEmTrechos("texto", 100, 100)).toThrow(/menor que o tamanho alvo/);
    expect(() => dividirEmTrechos("texto", 100, 200)).toThrow(/menor que o tamanho alvo/);
  });

  it("é determinístico", () => {
    const a = dividirEmTrechos(cronograma, 400, 80);
    const b = dividirEmTrechos(cronograma, 400, 80);
    expect(a).toEqual(b);
  });

  it("com trechos pequenos, poucas aulas do cronograma caem no mesmo vetor", () => {
    // O parâmetro de maior impacto do RAG: quatro aulas no mesmo vetor derrubam
    // a similaridade de qualquer pergunta específica. Ver docs/AVALIACAO-RAG.md.
    const trechos = dividirEmTrechos(cronograma, 320, 60);
    const aulasPorTrecho = 20 / trechos.length;
    expect(aulasPorTrecho).toBeLessThanOrEqual(4);
  });

  it("com o alvo padrão, o mesmo cronograma cabe em pouquíssimos trechos", () => {
    // O contraste que motiva o parâmetro menor na ingestão dos documentos
    // estruturados: aqui cada vetor representaria dezenas de aulas ao mesmo tempo.
    const trechos = dividirEmTrechos(cronograma);
    expect(20 / trechos.length).toBeGreaterThan(4);
  });

  it("usa os valores padrão declarados quando os parâmetros são omitidos", () => {
    expect(TAMANHO_ALVO).toBeGreaterThan(0);
    expect(SOBREPOSICAO).toBeLessThan(TAMANHO_ALVO);
    expect(() => dividirEmTrechos(cronograma)).not.toThrow();
  });

  it("limpa o texto antes de dividir", () => {
    const trechos = dividirEmTrechos("texto   com\n\n\n\n\nespaço  demais", 2000, 100);
    expect(trechos[0]!.texto).not.toContain("   ");
    expect(trechos[0]!.texto).not.toContain("\n\n\n");
  });
});
