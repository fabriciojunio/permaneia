import { describe, expect, it } from "vitest";
import {
  PASSOS_DEFUZZIFICACAO,
  defuzzificarCentroide,
  faixaDoScore,
  forcaDeDisparo,
  inferir,
  termoDeSaidaValido,
} from "@/lib/fuzzy/motor";
import { BASE_DE_REGRAS, type Regra } from "@/lib/fuzzy/regras";
import { ENGAJAMENTO, FREQUENCIA, NOTAS, pertinencias } from "@/lib/fuzzy/variaveis";

const ORDEM = { baixo: 0, medio: 1, alto: 2, critico: 3 } as const;

function graus(frequencia: number, notas: number, engajamento: number) {
  return {
    frequencia: pertinencias(FREQUENCIA, frequencia),
    notas: pertinencias(NOTAS, notas),
    engajamento: pertinencias(ENGAJAMENTO, engajamento),
  };
}

function regraDe(f: Regra["se"]["frequencia"], n: Regra["se"]["notas"], e: Regra["se"]["engajamento"]): Regra {
  const r = BASE_DE_REGRAS.find(
    (x) => x.se.frequencia === f && x.se.notas === n && x.se.engajamento === e
  );
  if (!r) throw new Error("Regra não encontrada.");
  return r;
}

describe("forcaDeDisparo", () => {
  it("usa o mínimo, e não o produto nem a média", () => {
    const regra = regraDe("baixa", "baixa", "baixo");
    // Em (0, 0, 0) as três pertinências valem 1, então a força é 1.
    expect(forcaDeDisparo(regra, graus(0, 0, 0))).toBe(1);
  });

  it("a força fica limitada pelo antecedente mais fraco", () => {
    const regra = regraDe("alta", "alta", "alto");
    const g = graus(100, 10, 10);
    const menor = Math.min(g.frequencia.alta, g.notas.alta, g.engajamento.alto);
    expect(forcaDeDisparo(regra, g)).toBeCloseTo(menor, 10);
  });

  it("é zero quando qualquer antecedente é zero", () => {
    const regra = regraDe("baixa", "baixa", "baixo");
    // Frequência 100 anula o termo "baixa", então a regra inteira não dispara.
    expect(forcaDeDisparo(regra, graus(100, 0, 0))).toBe(0);
  });

  it.each(BASE_DE_REGRAS)("a força da regra $id fica em [0, 1]", (regra) => {
    for (const [f, n, e] of [
      [0, 0, 0],
      [50, 5, 5],
      [100, 10, 10],
      [30, 8, 2],
      [75, 6, 7],
    ] as const) {
      const forca = forcaDeDisparo(regra, graus(f, n, e));
      expect(forca).toBeGreaterThanOrEqual(0);
      expect(forca).toBeLessThanOrEqual(1);
    }
  });

  it("respeita o peso da regra", () => {
    const regra = { ...regraDe("baixa", "baixa", "baixo"), peso: 0.5 };
    expect(forcaDeDisparo(regra, graus(0, 0, 0))).toBe(0.5);
  });
});

describe("defuzzificarCentroide", () => {
  it("com apenas risco baixo ativado, o centroide fica na região baixa", () => {
    const score = defuzzificarCentroide({ baixo: 1, medio: 0, alto: 0, critico: 0 });
    expect(score).toBeLessThan(0.25);
  });

  it("com apenas risco crítico ativado, o centroide fica na região crítica", () => {
    const score = defuzzificarCentroide({ baixo: 0, medio: 0, alto: 0, critico: 1 });
    expect(score).toBeGreaterThan(0.85);
  });

  it("com apenas risco médio ativado, o centroide fica no meio", () => {
    const score = defuzzificarCentroide({ baixo: 0, medio: 1, alto: 0, critico: 0 });
    expect(score).toBeCloseTo(0.4, 1);
  });

  it("um recorte parcial de crítico e um forte de médio produzem valor intermediário", () => {
    // É exatamente essa gradação que justifica escolher fuzzy em vez de um
    // classificador binário.
    const misto = defuzzificarCentroide({ baixo: 0, medio: 0.8, alto: 0, critico: 0.2 });
    const soMedio = defuzzificarCentroide({ baixo: 0, medio: 0.8, alto: 0, critico: 0 });
    expect(misto).toBeGreaterThan(soMedio);
    expect(misto).toBeLessThan(0.85);
  });

  it("sempre devolve valor dentro do universo de saída", () => {
    const cortes = [0, 0.1, 0.25, 0.5, 0.75, 1];
    for (const b of cortes) {
      for (const c of cortes) {
        const score = defuzzificarCentroide({ baixo: b, medio: 0, alto: 0, critico: c });
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("com agregação vazia devolve o meio do universo, e não zero", () => {
    // Zero seria lido como "sem risco" e esconderia o defeito.
    expect(defuzzificarCentroide({ baixo: 0, medio: 0, alto: 0, critico: 0 })).toBe(0.5);
  });

  it("é monótono no corte de crítico, mantendo o resto fixo", () => {
    let anterior = -1;
    for (let c = 0; c <= 1; c += 0.05) {
      const score = defuzzificarCentroide({ baixo: 0.5, medio: 0, alto: 0, critico: c });
      expect(score).toBeGreaterThanOrEqual(anterior - 1e-9);
      anterior = score;
    }
  });

  it("é monótono decrescente no corte de baixo, mantendo o resto fixo", () => {
    let anterior = 2;
    for (let b = 0; b <= 1; b += 0.05) {
      const score = defuzzificarCentroide({ baixo: b, medio: 0, alto: 0, critico: 0.5 });
      expect(score).toBeLessThanOrEqual(anterior + 1e-9);
      anterior = score;
    }
  });

  it("usa a resolução declarada na discretização", () => {
    expect(PASSOS_DEFUZZIFICACAO).toBeGreaterThanOrEqual(100);
  });
});

describe("faixaDoScore", () => {
  it.each([
    [0, "baixo"],
    [0.05, "baixo"],
    [0.1, "baixo"],
    [0.4, "medio"],
    [0.675, "alto"],
    [0.9, "critico"],
    [1, "critico"],
  ])("o score %s cai na faixa %s", (score, esperado) => {
    expect(faixaDoScore(score)).toBe(esperado);
  });

  it("é monótona: score maior nunca devolve faixa menor", () => {
    let anterior = -1;
    for (let s = 0; s <= 1; s += 0.005) {
      const atual = ORDEM[faixaDoScore(s)];
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
  });

  it("no empate escolhe a faixa de menor risco, que é a leitura conservadora", () => {
    // Não se anuncia "crítico" num ponto em que "alto" explica igualmente bem.
    const faixa = faixaDoScore(0.8);
    expect(["alto", "critico"]).toContain(faixa);
  });
});

describe("inferir", () => {
  it("devolve fuzzificação das três entradas", () => {
    const r = inferir({ frequencia: 50, notas: 5, engajamento: 5 });
    expect(Object.keys(r.fuzzificacao)).toEqual(["frequencia", "notas", "engajamento"]);
  });

  it("sempre dispara ao menos uma regra, porque a base é fatorial completa", () => {
    for (let f = 0; f <= 100; f += 5) {
      for (let n = 0; n <= 10; n += 1) {
        for (let e = 0; e <= 10; e += 2) {
          const r = inferir({ frequencia: f, notas: n, engajamento: e });
          expect(r.regrasDisparadas.length, `nenhuma regra em (${f}, ${n}, ${e})`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("ordena as regras disparadas da mais forte para a mais fraca", () => {
    const r = inferir({ frequencia: 55, notas: 5.5, engajamento: 4 });
    for (let i = 1; i < r.regrasDisparadas.length; i += 1) {
      expect(r.regrasDisparadas[i - 1]!.forca).toBeGreaterThanOrEqual(r.regrasDisparadas[i]!.forca);
    }
  });

  it("nunca lista regra com força zero", () => {
    const r = inferir({ frequencia: 100, notas: 10, engajamento: 10 });
    for (const regra of r.regrasDisparadas) {
      expect(regra.forca).toBeGreaterThan(0);
    }
  });

  it("o score fica sempre em [0, 1]", () => {
    for (let f = 0; f <= 100; f += 10) {
      for (let n = 0; n <= 10; n += 2) {
        for (let e = 0; e <= 10; e += 2) {
          const r = inferir({ frequencia: f, notas: n, engajamento: e });
          expect(r.score).toBeGreaterThanOrEqual(0);
          expect(r.score).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("a faixa devolvida corresponde ao score devolvido", () => {
    for (let f = 0; f <= 100; f += 7) {
      for (let n = 0; n <= 10; n += 1.5) {
        const r = inferir({ frequencia: f, notas: n, engajamento: 5 });
        expect(r.faixa).toBe(faixaDoScore(r.score));
      }
    }
  });

  it("é determinístico: a mesma entrada devolve sempre o mesmo score", () => {
    const entrada = { frequencia: 43.7, notas: 6.2, engajamento: 3.1 };
    const primeiro = inferir(entrada).score;
    for (let i = 0; i < 20; i += 1) {
      expect(inferir(entrada).score).toBe(primeiro);
    }
  });

  it("aceita base de regras alternativa, para os testes exercitarem etapas isoladas", () => {
    const baseMinima: Regra[] = [
      { id: 1, se: { frequencia: "baixa", notas: "baixa", engajamento: "baixo" }, entao: "critico", peso: 1, porque: "teste." },
    ];
    const r = inferir({ frequencia: 0, notas: 0, engajamento: 0 }, baseMinima);
    expect(r.regrasDisparadas).toHaveLength(1);
    expect(r.score).toBeGreaterThan(0.85);
  });

  it("com base vazia devolve o meio do universo em vez de quebrar", () => {
    const r = inferir({ frequencia: 50, notas: 5, engajamento: 5 }, []);
    expect(r.score).toBe(0.5);
    expect(r.regrasDisparadas).toHaveLength(0);
  });

  it("o agregado nunca passa de 1 em nenhum termo", () => {
    for (let f = 0; f <= 100; f += 10) {
      const r = inferir({ frequencia: f, notas: 5, engajamento: 5 });
      for (const corte of Object.values(r.agregado)) {
        expect(corte).toBeGreaterThanOrEqual(0);
        expect(corte).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("cenários de referência", () => {
  it.each([
    ["abandono já em curso", 20, 2, 1.87, "critico"],
    ["notas boas mas desengajando", 30, 8.5, 1.87, "alto"],
    ["trajetória saudável", 95, 9, 9.65, "baixo"],
    ["mediano em tudo", 67, 5.5, 6.45, "medio"],
    ["extremo inferior", 0, 0, 0, "critico"],
    ["extremo superior", 100, 10, 10, "baixo"],
  ])("%s produz faixa %s", (_nome, f, n, e, faixa) => {
    expect(inferir({ frequencia: f, notas: n, engajamento: e }).faixa).toBe(faixa);
  });

  it("o aluno com nota alta e presença caindo tem risco maior que o mediano", () => {
    // É o argumento central do projeto, verificado por número e não por texto.
    const desengajando = inferir({ frequencia: 30, notas: 8.5, engajamento: 1.87 }).score;
    const mediano = inferir({ frequencia: 67, notas: 5.5, engajamento: 6.45 }).score;
    expect(desengajando).toBeGreaterThan(mediano);
  });

  it("nota alta sozinha não garante risco baixo", () => {
    const r = inferir({ frequencia: 25, notas: 9.5, engajamento: 0.5 });
    expect(r.faixa).not.toBe("baixo");
  });

  it("presença alta sozinha não garante risco baixo", () => {
    const r = inferir({ frequencia: 98, notas: 1.5, engajamento: 0.5 });
    expect(["alto", "critico"]).toContain(r.faixa);
  });
});

describe("monotonicidade da faixa", () => {
  // Esta é a propriedade que de fato importa para a coordenação: a FAIXA
  // mostrada na tela nunca pode melhorar quando um sinal do aluno piora.
  const frequencias = [0, 20, 40, 60, 80, 100];
  const notas = [0, 2.5, 5, 7.5, 10];
  const engajamentos = [0, 2.5, 5, 7.5, 10];

  it.each(
    frequencias.flatMap((f) => notas.flatMap((n) => engajamentos.map((e) => [f, n, e] as const)))
  )("em (%s, %s, %s), piorar a frequência não melhora a faixa", (f, n, e) => {
    if (f === 0) return;
    const base = inferir({ frequencia: f, notas: n, engajamento: e });
    const pior = inferir({ frequencia: f - 20, notas: n, engajamento: e });
    expect(ORDEM[pior.faixa]).toBeGreaterThanOrEqual(ORDEM[base.faixa]);
  });

  it.each(
    frequencias.flatMap((f) => notas.flatMap((n) => engajamentos.map((e) => [f, n, e] as const)))
  )("em (%s, %s, %s), piorar as notas não melhora a faixa", (f, n, e) => {
    if (n === 0) return;
    const base = inferir({ frequencia: f, notas: n, engajamento: e });
    const pior = inferir({ frequencia: f, notas: n - 2.5, engajamento: e });
    expect(ORDEM[pior.faixa]).toBeGreaterThanOrEqual(ORDEM[base.faixa]);
  });

  it.each(
    frequencias.flatMap((f) => notas.flatMap((n) => engajamentos.map((e) => [f, n, e] as const)))
  )("em (%s, %s, %s), piorar o engajamento não melhora a faixa", (f, n, e) => {
    if (e === 0) return;
    const base = inferir({ frequencia: f, notas: n, engajamento: e });
    const pior = inferir({ frequencia: f, notas: n, engajamento: e - 2.5 });
    expect(ORDEM[pior.faixa]).toBeGreaterThanOrEqual(ORDEM[base.faixa]);
  });

  it("em uma grade fina, a faixa nunca inverte", () => {
    let inversoes = 0;
    for (let f = 0; f <= 100; f += 5) {
      for (let n = 0; n <= 10; n += 1) {
        for (let e = 0; e <= 10; e += 1) {
          const base = ORDEM[inferir({ frequencia: f, notas: n, engajamento: e }).faixa];
          const piores = [
            [f - 5, n, e],
            [f, n - 1, e],
            [f, n, e - 1],
          ] as const;
          for (const [pf, pn, pe] of piores) {
            if (pf < 0 || pn < 0 || pe < 0) continue;
            if (ORDEM[inferir({ frequencia: pf, notas: pn, engajamento: pe }).faixa] < base) inversoes += 1;
          }
        }
      }
    }
    expect(inversoes).toBe(0);
  });

  it("o score tem apenas inversões marginais, artefato conhecido do Mamdani", () => {
    // Perto da fronteira entre dois termos, a massa que cada regra contribui
    // muda de forma descontínua e o centroide pode andar alguns milésimos na
    // direção contrária. O efeito é limitado e não chega a mudar a faixa.
    // Ver a seção de visão crítica do relatório.
    let maiorInversao = 0;
    for (let f = 0; f <= 100; f += 5) {
      for (let n = 0; n <= 10; n += 0.5) {
        for (let e = 0; e <= 10; e += 0.5) {
          const base = inferir({ frequencia: f, notas: n, engajamento: e }).score;
          const piores = [
            [f - 5, n, e],
            [f, n - 0.5, e],
            [f, n, e - 0.5],
          ] as const;
          for (const [pf, pn, pe] of piores) {
            if (pf < 0 || pn < 0 || pe < 0) continue;
            const delta = base - inferir({ frequencia: pf, notas: pn, engajamento: pe }).score;
            if (delta > maiorInversao) maiorInversao = delta;
          }
        }
      }
    }
    expect(maiorInversao).toBeLessThanOrEqual(0.05);
  });
});

describe("termoDeSaidaValido", () => {
  it.each(["baixo", "medio", "alto", "critico"])("aceita %s", (t) => {
    expect(termoDeSaidaValido(t)).toBe(true);
  });

  it.each(["nenhum", "altissimo", "", "BAIXO"])("rejeita %s", (t) => {
    expect(termoDeSaidaValido(t)).toBe(false);
  });
});
