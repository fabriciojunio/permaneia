import { describe, expect, it } from "vitest";
import {
  ENGAJAMENTO,
  FREQUENCIA,
  NOTAS,
  RISCO,
  VARIAVEIS_ENTRADA,
  normalizarEngajamento,
  pertinencias,
  termo,
} from "@/lib/fuzzy/variaveis";

const TODAS = [FREQUENCIA, NOTAS, ENGAJAMENTO, RISCO];

describe("estrutura das variáveis linguísticas", () => {
  it.each(TODAS)("$nome tem nome, descrição e universo válidos", (v) => {
    expect(v.nome.length).toBeGreaterThan(0);
    expect(v.descricao.length).toBeGreaterThan(0);
    expect(v.minimo).toBeLessThan(v.maximo);
  });

  it.each(TODAS)("$nome tem ao menos três termos", (v) => {
    expect(v.termos.length).toBeGreaterThanOrEqual(3);
  });

  it.each(TODAS)("$nome não repete rótulo de termo", (v) => {
    const rotulos = v.termos.map((t) => t.rotulo);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it.each(TODAS)("os termos de $nome cabem dentro do universo", (v) => {
    for (const t of v.termos) {
      for (const p of t.forma.pontos) {
        expect(p).toBeGreaterThanOrEqual(v.minimo);
        expect(p).toBeLessThanOrEqual(v.maximo);
      }
    }
  });

  it.each(TODAS)("todo ponto do universo de $nome pertence a algum termo", (v) => {
    // Sem essa cobertura existiria um valor de entrada para o qual nenhuma
    // regra dispararia, e a saída viria de uma agregação vazia.
    const passo = (v.maximo - v.minimo) / 500;
    for (let x = v.minimo; x <= v.maximo; x += passo) {
      const graus = v.termos.map((t) => t.pertinencia(x));
      const soma = graus.reduce((a, b) => a + b, 0);
      expect(soma, `valor ${x} não pertence a nenhum termo de ${v.nome}`).toBeGreaterThan(0);
    }
  });

  it.each(TODAS)("cada termo de $nome atinge pertinência plena em algum ponto", (v) => {
    for (const t of v.termos) {
      const passo = (v.maximo - v.minimo) / 1000;
      let maior = 0;
      for (let x = v.minimo; x <= v.maximo; x += passo) {
        const g = t.pertinencia(x);
        if (g > maior) maior = g;
      }
      expect(maior, `termo ${t.rotulo} de ${v.nome} nunca chega a 1`).toBeCloseTo(1, 2);
    }
  });

  it.each(TODAS)("os termos de $nome se sobrepõem, que é o que produz a gradação", (v) => {
    const passo = (v.maximo - v.minimo) / 500;
    let pontosComSobreposicao = 0;
    for (let x = v.minimo; x <= v.maximo; x += passo) {
      const ativos = v.termos.filter((t) => t.pertinencia(x) > 0).length;
      if (ativos >= 2) pontosComSobreposicao += 1;
    }
    expect(pontosComSobreposicao).toBeGreaterThan(0);
  });
});

describe("FREQUENCIA", () => {
  it("tem universo de 0 a 100", () => {
    expect(FREQUENCIA.minimo).toBe(0);
    expect(FREQUENCIA.maximo).toBe(100);
  });

  it.each([
    [0, "baixa"],
    [10, "baixa"],
    [30, "baixa"],
    [40, "baixa"],
    [67, "media"],
    [70, "media"],
    [90, "alta"],
    [95, "alta"],
    [100, "alta"],
  ])("em %s%% o termo dominante é %s", (valor, esperado) => {
    const graus = pertinencias(FREQUENCIA, valor);
    const dominante = (Object.entries(graus) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]![0];
    expect(dominante).toBe(esperado);
  });

  it("prende valores acima de 100 no topo do universo", () => {
    expect(pertinencias(FREQUENCIA, 150)).toEqual(pertinencias(FREQUENCIA, 100));
  });

  it("prende valores negativos no piso do universo", () => {
    expect(pertinencias(FREQUENCIA, -50)).toEqual(pertinencias(FREQUENCIA, 0));
  });

  it("o limite de 25% de faltas do contrato didático cai na faixa média", () => {
    // 75% de presença é o limite formal. Ali o aluno ainda está aprovado mas
    // já não tem folga, e o termo "média" precisa cobrir esse ponto.
    const graus = pertinencias(FREQUENCIA, 75);
    expect(graus.media).toBeGreaterThan(0);
    expect(graus.baixa).toBe(0);
  });
});

describe("NOTAS", () => {
  it("tem universo de 0 a 10", () => {
    expect(NOTAS.minimo).toBe(0);
    expect(NOTAS.maximo).toBe(10);
  });

  it.each([
    [0, "baixa"],
    [1, "baixa"],
    [2.5, "baixa"],
    [5.5, "media"],
    [8, "alta"],
    [9, "alta"],
    [10, "alta"],
  ])("com média %s o termo dominante é %s", (valor, esperado) => {
    const graus = pertinencias(NOTAS, valor);
    const dominante = (Object.entries(graus) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]![0];
    expect(dominante).toBe(esperado);
  });

  it("a nota de corte 6,0 fica na zona de transição entre média e alta", () => {
    const graus = pertinencias(NOTAS, 6);
    expect(graus.media).toBeGreaterThan(0);
    expect(graus.baixa).toBe(0);
  });

  it("prende valores fora do universo", () => {
    expect(pertinencias(NOTAS, 12)).toEqual(pertinencias(NOTAS, 10));
    expect(pertinencias(NOTAS, -3)).toEqual(pertinencias(NOTAS, 0));
  });
});

describe("ENGAJAMENTO", () => {
  it("tem universo de 0 a 10", () => {
    expect(ENGAJAMENTO.minimo).toBe(0);
    expect(ENGAJAMENTO.maximo).toBe(10);
  });

  it.each([
    [0, "baixo"],
    [1, "baixo"],
    [4, "medio"],
    [8, "alto"],
    [10, "alto"],
  ])("com engajamento %s o termo dominante é %s", (valor, esperado) => {
    const graus = pertinencias(ENGAJAMENTO, valor);
    const dominante = (Object.entries(graus) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]![0];
    expect(dominante).toBe(esperado);
  });
});

describe("RISCO", () => {
  it("tem universo de 0 a 1", () => {
    expect(RISCO.minimo).toBe(0);
    expect(RISCO.maximo).toBe(1);
  });

  it("tem quatro termos, e não três", () => {
    // A coordenação precisa separar "acompanhar" de "procurar hoje": a
    // diferença entre alto e crítico muda a ação, não só o rótulo.
    expect(RISCO.termos.map((t) => t.rotulo)).toEqual(["baixo", "medio", "alto", "critico"]);
  });

  it("os termos aparecem em ordem crescente de risco", () => {
    const centros = RISCO.termos.map((t) => {
      const p = t.forma.pontos;
      return p.reduce((a, b) => a + b, 0) / p.length;
    });
    for (let i = 1; i < centros.length; i += 1) {
      expect(centros[i]!).toBeGreaterThan(centros[i - 1]!);
    }
  });
});

describe("pertinencias", () => {
  it("devolve um grau para cada termo declarado", () => {
    const graus = pertinencias(FREQUENCIA, 50);
    expect(Object.keys(graus).sort()).toEqual(["alta", "baixa", "media"]);
  });

  it.each([0, 10, 25, 40, 55, 70, 85, 100])("todos os graus ficam em [0, 1] para %s%%", (valor) => {
    for (const g of Object.values(pertinencias(FREQUENCIA, valor))) {
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("trata NaN sem quebrar o cálculo da turma", () => {
    expect(() => pertinencias(FREQUENCIA, Number.NaN)).not.toThrow();
  });
});

describe("termo", () => {
  it("encontra o termo pelo rótulo", () => {
    expect(termo(FREQUENCIA, "baixa").rotulo).toBe("baixa");
    expect(termo(NOTAS, "alta").rotulo).toBe("alta");
    expect(termo(ENGAJAMENTO, "medio").rotulo).toBe("medio");
    expect(termo(RISCO, "critico").rotulo).toBe("critico");
  });

  it("lança quando o rótulo não existe, porque isso é erro de programação", () => {
    expect(() => termo(FREQUENCIA, "altíssima" as never)).toThrow(/não existe/);
  });
});

describe("normalizarEngajamento", () => {
  it.each([
    [0, 0],
    [-5, 0],
    [40, 10],
    [100, 10],
    [1000, 10],
  ])("com %s acessos devolve %s", (acessos, esperado) => {
    expect(normalizarEngajamento(acessos)).toBe(esperado);
  });

  it("é monótona crescente no número de acessos", () => {
    let anterior = -1;
    for (let a = 0; a <= 60; a += 1) {
      const atual = normalizarEngajamento(a);
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });

  it("nunca passa de 10", () => {
    for (let a = 0; a <= 500; a += 7) {
      expect(normalizarEngajamento(a)).toBeLessThanOrEqual(10);
    }
  });

  it("cresce mais no começo do que no fim, que é a razão de ser logarítmica", () => {
    // A diferença entre 0 e 5 acessos diz muito mais sobre o vínculo do aluno
    // do que a diferença entre 30 e 35.
    const inicio = normalizarEngajamento(5) - normalizarEngajamento(0);
    const fim = normalizarEngajamento(35) - normalizarEngajamento(30);
    expect(inicio).toBeGreaterThan(fim);
  });

  it("respeita o ponto de saturação configurado", () => {
    expect(normalizarEngajamento(20, 20)).toBe(10);
    expect(normalizarEngajamento(20, 80)).toBeLessThan(10);
  });

  it("rejeita ponto de saturação inválido", () => {
    expect(() => normalizarEngajamento(10, 0)).toThrow(/maior que zero/);
    expect(() => normalizarEngajamento(10, -5)).toThrow(/maior que zero/);
  });

  it("trata entrada não finita como ausência de acesso", () => {
    expect(normalizarEngajamento(Number.NaN)).toBe(0);
    expect(normalizarEngajamento(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("o valor devolvido cabe no universo da variável de engajamento", () => {
    for (let a = 0; a <= 100; a += 3) {
      const v = normalizarEngajamento(a);
      expect(v).toBeGreaterThanOrEqual(ENGAJAMENTO.minimo);
      expect(v).toBeLessThanOrEqual(ENGAJAMENTO.maximo);
    }
  });
});

describe("VARIAVEIS_ENTRADA", () => {
  it("lista exatamente as três entradas do sistema", () => {
    expect(VARIAVEIS_ENTRADA).toHaveLength(3);
    expect(VARIAVEIS_ENTRADA.map((v) => v.nome)).toEqual([
      "frequencia_percentual",
      "media_notas",
      "engajamento",
    ]);
  });

  it("não inclui a variável de saída", () => {
    expect(VARIAVEIS_ENTRADA.map((v) => v.nome)).not.toContain(RISCO.nome);
  });
});
