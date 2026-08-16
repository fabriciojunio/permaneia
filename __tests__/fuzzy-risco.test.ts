import { describe, expect, it } from "vitest";
import {
  LIMITES_FAIXA,
  ROTULO_FAIXA,
  calcularRiscoEvasao,
  compararComCriterioPorNota,
} from "@/lib/fuzzy/risco";

const CASO_PADRAO = { frequenciaPercentual: 70, mediaNotas: 6, acessosPlataforma: 12 };

describe("calcularRiscoEvasao", () => {
  it("devolve score, faixa, entradas, fuzzificação e regras", () => {
    const r = calcularRiscoEvasao(CASO_PADRAO);
    expect(r).toHaveProperty("score");
    expect(r).toHaveProperty("faixa");
    expect(r).toHaveProperty("entradas");
    expect(r).toHaveProperty("fuzzificacao");
    expect(r).toHaveProperty("regrasDisparadas");
    expect(r).toHaveProperty("acaoSugerida");
    expect(r).toHaveProperty("calculadoEm");
  });

  it("converte acessos brutos em engajamento normalizado", () => {
    const r = calcularRiscoEvasao({ ...CASO_PADRAO, acessosPlataforma: 40 });
    expect(r.entradas.engajamentoNormalizado).toBe(10);
  });

  it("preserva os acessos brutos no detalhamento", () => {
    const r = calcularRiscoEvasao({ ...CASO_PADRAO, acessosPlataforma: 17 });
    expect(r.entradas.acessosPlataforma).toBe(17);
  });

  it("a regra dominante é a de maior força", () => {
    const r = calcularRiscoEvasao(CASO_PADRAO);
    expect(r.regraDominante).not.toBeNull();
    expect(r.regraDominante!.forca).toBe(r.regrasDisparadas[0]!.forca);
  });

  it("traz ação sugerida coerente com a faixa", () => {
    const critico = calcularRiscoEvasao({ frequenciaPercentual: 5, mediaNotas: 1, acessosPlataforma: 0 });
    expect(critico.faixa).toBe("critico");
    expect(critico.acaoSugerida).toMatch(/hoje/i);

    const baixo = calcularRiscoEvasao({ frequenciaPercentual: 98, mediaNotas: 9.5, acessosPlataforma: 38 });
    expect(baixo.faixa).toBe("baixo");
    expect(baixo.acaoSugerida).toMatch(/nenhuma ação/i);
  });

  it("registra o momento do cálculo em formato ISO", () => {
    const r = calcularRiscoEvasao(CASO_PADRAO);
    expect(() => new Date(r.calculadoEm).toISOString()).not.toThrow();
    expect(r.calculadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it.each([
    [150, 100],
    [100.5, 100],
    [-20, 0],
    [0, 0],
  ])("prende a frequência %s em %s em vez de rejeitar", (entrada, esperado) => {
    // Dado acadêmico chega com arredondamento de planilha. Derrubar o cálculo
    // da turma inteira por causa de um 100,01 seria pior do que prender.
    const r = calcularRiscoEvasao({ ...CASO_PADRAO, frequenciaPercentual: entrada });
    expect(r.entradas.frequenciaPercentual).toBe(esperado);
  });

  it.each([
    [12, 10],
    [10.4, 10],
    [-3, 0],
  ])("prende a média %s em %s", (entrada, esperado) => {
    const r = calcularRiscoEvasao({ ...CASO_PADRAO, mediaNotas: entrada });
    expect(r.entradas.mediaNotas).toBe(esperado);
  });

  it("trata acessos negativos como zero", () => {
    const r = calcularRiscoEvasao({ ...CASO_PADRAO, acessosPlataforma: -10 });
    expect(r.entradas.acessosPlataforma).toBe(0);
    expect(r.entradas.engajamentoNormalizado).toBe(0);
  });

  it.each([
    ["frequenciaPercentual"],
    ["mediaNotas"],
    ["acessosPlataforma"],
  ])("não quebra com NaN em %s", (campo) => {
    const dados = { ...CASO_PADRAO, [campo]: Number.NaN };
    expect(() => calcularRiscoEvasao(dados)).not.toThrow();
    const r = calcularRiscoEvasao(dados);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it("é determinístico para a mesma entrada", () => {
    const primeiro = calcularRiscoEvasao(CASO_PADRAO).score;
    for (let i = 0; i < 15; i += 1) {
      expect(calcularRiscoEvasao(CASO_PADRAO).score).toBe(primeiro);
    }
  });

  it.each([
    [0, 0, 0],
    [10, 1, 1],
    [25, 3, 2],
    [50, 5, 8],
    [75, 6.5, 15],
    [90, 8, 25],
    [100, 10, 40],
  ])("o score de (%s, %s, %s) fica em [0, 1]", (f, n, a) => {
    const r = calcularRiscoEvasao({ frequenciaPercentual: f, mediaNotas: n, acessosPlataforma: a });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("arredonda o score a três casas, que é a precisão da coluna do banco", () => {
    for (let f = 0; f <= 100; f += 13) {
      const r = calcularRiscoEvasao({ ...CASO_PADRAO, frequenciaPercentual: f });
      expect(String(r.score).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });
});

describe("perfis plantados no seed", () => {
  it.each([
    ["Abandono já em curso", 18, 2.1, 1, "critico"],
    ["Reprovação por nota se aproximando", 88, 3.2, 26, "medio"],
    ["Notas boas, mas desengajando", 34, 8.6, 2, "alto"],
    ["Notas boas, presença apertada", 62, 8.9, 3, "medio"],
    ["Mediano em tudo", 68, 5.6, 11, "medio"],
    ["Trajetória saudável", 96, 9.1, 34, "baixo"],
  ])("%s cai na faixa %s", (_nome, f, n, a, faixa) => {
    const r = calcularRiscoEvasao({ frequenciaPercentual: f, mediaNotas: n, acessosPlataforma: a });
    expect(r.faixa).toBe(faixa);
  });

  it("a 62% de presença o aluno já passou do limite de faltas, mas o sistema só marca risco médio", () => {
    // Limitação conhecida e deliberadamente mantida: os conjuntos de
    // frequência seguem a especificação do trabalho, em que "baixa" termina em
    // 60%. O contrato didático da disciplina, porém, reprova por falta abaixo
    // de 75%. Alinhar o conjunto "baixa" a essa linha institucional é a
    // primeira recalibração sugerida no relatório.
    const r = calcularRiscoEvasao({ frequenciaPercentual: 62, mediaNotas: 8.9, acessosPlataforma: 3 });
    expect(r.faixa).toBe("medio");
    expect(62).toBeLessThan(75);
  });

  it("o perfil desengajando tem risco maior que o mediano, apesar da nota bem melhor", () => {
    const desengajando = calcularRiscoEvasao({ frequenciaPercentual: 34, mediaNotas: 8.6, acessosPlataforma: 2 });
    const mediano = calcularRiscoEvasao({ frequenciaPercentual: 68, mediaNotas: 5.6, acessosPlataforma: 11 });
    expect(desengajando.score).toBeGreaterThan(mediano.score);
  });
});

describe("compararComCriterioPorNota", () => {
  it("identifica divergência quando a nota é boa mas o risco fuzzy é alto", () => {
    // Este é o caso que sustenta a escolha de fuzzy no relatório.
    const c = compararComCriterioPorNota({
      frequenciaPercentual: 30,
      mediaNotas: 8.5,
      acessosPlataforma: 1,
    });
    expect(c.criterioPorNota).toBe("sem risco");
    expect(["alto", "critico"]).toContain(c.faixaFuzzy);
    expect(c.divergem).toBe(true);
  });

  it("não diverge quando os dois critérios concordam em risco", () => {
    const c = compararComCriterioPorNota({
      frequenciaPercentual: 20,
      mediaNotas: 2,
      acessosPlataforma: 0,
    });
    expect(c.criterioPorNota).toBe("em risco");
    expect(c.divergem).toBe(false);
  });

  it("não diverge quando os dois critérios concordam em tranquilidade", () => {
    const c = compararComCriterioPorNota({
      frequenciaPercentual: 97,
      mediaNotas: 9.2,
      acessosPlataforma: 36,
    });
    expect(c.criterioPorNota).toBe("sem risco");
    expect(c.faixaFuzzy).toBe("baixo");
    expect(c.divergem).toBe(false);
  });

  it.each([
    [5.9, "em risco"],
    [6, "sem risco"],
    [0, "em risco"],
    [10, "sem risco"],
  ])("a média %s é classificada como %s pelo critério ingênuo", (media, esperado) => {
    const c = compararComCriterioPorNota({
      frequenciaPercentual: 70,
      mediaNotas: media,
      acessosPlataforma: 10,
    });
    expect(c.criterioPorNota).toBe(esperado);
  });

  it("o score devolvido bate com o do cálculo direto", () => {
    const dados = { frequenciaPercentual: 55, mediaNotas: 7, acessosPlataforma: 8 };
    expect(compararComCriterioPorNota(dados).scoreFuzzy).toBe(calcularRiscoEvasao(dados).score);
  });

  it("existe um conjunto não vazio de alunos em que os critérios divergem", () => {
    let divergencias = 0;
    for (let f = 10; f <= 100; f += 10) {
      for (let n = 6; n <= 10; n += 1) {
        for (let a = 0; a <= 10; a += 5) {
          if (compararComCriterioPorNota({
            frequenciaPercentual: f,
            mediaNotas: n,
            acessosPlataforma: a,
          }).divergem) divergencias += 1;
        }
      }
    }
    expect(divergencias).toBeGreaterThan(0);
  });
});

describe("rótulos e limites de faixa", () => {
  it.each(["baixo", "medio", "alto", "critico"] as const)("a faixa %s tem rótulo legível", (faixa) => {
    expect(ROTULO_FAIXA[faixa]).toMatch(/^Risco /);
  });

  it("os limites de faixa são crescentes", () => {
    expect(LIMITES_FAIXA.baixo).toBeLessThan(LIMITES_FAIXA.medio);
    expect(LIMITES_FAIXA.medio).toBeLessThan(LIMITES_FAIXA.alto);
    expect(LIMITES_FAIXA.alto).toBeLessThan(LIMITES_FAIXA.critico);
  });

  it("todos os limites ficam dentro do universo de saída", () => {
    for (const v of Object.values(LIMITES_FAIXA)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
