import { describe, expect, it } from "vitest";
import { BASE_DE_REGRAS, regrasEmDestaque } from "@/lib/fuzzy/regras";
import { ENGAJAMENTO, FREQUENCIA, NOTAS, RISCO } from "@/lib/fuzzy/variaveis";

const ORDEM_RISCO = { baixo: 0, medio: 1, alto: 2, critico: 3 } as const;

describe("completude da base de regras", () => {
  it("tem exatamente as 27 combinações possíveis", () => {
    // 3 termos de frequência x 3 de notas x 3 de engajamento. A base fatorial
    // completa garante que nenhuma entrada cai num vazio da base.
    expect(BASE_DE_REGRAS).toHaveLength(27);
  });

  it("cobre toda combinação de termos, sem faltar nenhuma", () => {
    const vistas = new Set(
      BASE_DE_REGRAS.map((r) => `${r.se.frequencia}|${r.se.notas}|${r.se.engajamento}`)
    );
    for (const f of FREQUENCIA.termos) {
      for (const n of NOTAS.termos) {
        for (const e of ENGAJAMENTO.termos) {
          expect(vistas.has(`${f.rotulo}|${n.rotulo}|${e.rotulo}`)).toBe(true);
        }
      }
    }
    expect(vistas.size).toBe(27);
  });

  it("não tem antecedente repetido", () => {
    const chaves = BASE_DE_REGRAS.map((r) => `${r.se.frequencia}|${r.se.notas}|${r.se.engajamento}`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("os identificadores são únicos e sequenciais de 1 a 27", () => {
    const ids = BASE_DE_REGRAS.map((r) => r.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
  });

  it("usa todos os quatro termos de saída", () => {
    const usados = new Set(BASE_DE_REGRAS.map((r) => r.entao));
    expect(usados.size).toBe(4);
    for (const t of RISCO.termos) {
      expect(usados.has(t.rotulo)).toBe(true);
    }
  });
});

describe("integridade de cada regra", () => {
  it.each(BASE_DE_REGRAS)("regra $id tem termo de frequência declarado", (regra) => {
    expect(FREQUENCIA.termos.map((t) => t.rotulo)).toContain(regra.se.frequencia);
  });

  it.each(BASE_DE_REGRAS)("regra $id tem termo de notas declarado", (regra) => {
    expect(NOTAS.termos.map((t) => t.rotulo)).toContain(regra.se.notas);
  });

  it.each(BASE_DE_REGRAS)("regra $id tem termo de engajamento declarado", (regra) => {
    expect(ENGAJAMENTO.termos.map((t) => t.rotulo)).toContain(regra.se.engajamento);
  });

  it.each(BASE_DE_REGRAS)("regra $id tem termo de saída declarado", (regra) => {
    expect(RISCO.termos.map((t) => t.rotulo)).toContain(regra.entao);
  });

  it.each(BASE_DE_REGRAS)("regra $id tem peso positivo", (regra) => {
    expect(regra.peso).toBeGreaterThan(0);
    expect(regra.peso).toBeLessThanOrEqual(1);
  });

  it.each(BASE_DE_REGRAS)("regra $id traz justificativa em linguagem natural", (regra) => {
    // A justificativa vai para a tela de explicação da coordenação. Uma regra
    // sem ela produz um score que ninguém consegue defender numa conversa.
    expect(regra.porque.length).toBeGreaterThan(30);
    expect(regra.porque.trim()).toBe(regra.porque);
  });

  it.each(BASE_DE_REGRAS)("a justificativa da regra $id termina em ponto final", (regra) => {
    expect(regra.porque.endsWith(".")).toBe(true);
  });
});

describe("coerência pedagógica da base", () => {
  function riscoDe(f: string, n: string, e: string): number {
    const regra = BASE_DE_REGRAS.find(
      (r) => r.se.frequencia === f && r.se.notas === n && r.se.engajamento === e
    );
    if (!regra) throw new Error(`Regra ausente para (${f}, ${n}, ${e}).`);
    return ORDEM_RISCO[regra.entao];
  }

  const FREQ = ["alta", "media", "baixa"] as const;
  const NOTA = ["alta", "media", "baixa"] as const;
  const ENG = ["alto", "medio", "baixo"] as const;

  it.each(
    NOTA.flatMap((n) => ENG.map((e) => [n, e] as const))
  )("piorar a frequência nunca reduz o risco (notas %s, engajamento %s)", (n, e) => {
    for (let i = 1; i < FREQ.length; i += 1) {
      expect(riscoDe(FREQ[i]!, n, e)).toBeGreaterThanOrEqual(riscoDe(FREQ[i - 1]!, n, e));
    }
  });

  it.each(
    FREQ.flatMap((f) => ENG.map((e) => [f, e] as const))
  )("piorar as notas nunca reduz o risco (frequência %s, engajamento %s)", (f, e) => {
    for (let i = 1; i < NOTA.length; i += 1) {
      expect(riscoDe(f, NOTA[i]!, e)).toBeGreaterThanOrEqual(riscoDe(f, NOTA[i - 1]!, e));
    }
  });

  it.each(
    FREQ.flatMap((f) => NOTA.map((n) => [f, n] as const))
  )("piorar o engajamento nunca reduz o risco (frequência %s, notas %s)", (f, n) => {
    for (let i = 1; i < ENG.length; i += 1) {
      expect(riscoDe(f, n, ENG[i]!)).toBeGreaterThanOrEqual(riscoDe(f, n, ENG[i - 1]!));
    }
  });

  it("o melhor cenário possível é risco baixo", () => {
    expect(riscoDe("alta", "alta", "alto")).toBe(ORDEM_RISCO.baixo);
  });

  it("o pior cenário possível é risco crítico", () => {
    expect(riscoDe("baixa", "baixa", "baixo")).toBe(ORDEM_RISCO.critico);
  });
});

describe("regras exigidas na especificação do trabalho", () => {
  function regra(f: string, n: string, e: string) {
    return BASE_DE_REGRAS.find(
      (r) => r.se.frequencia === f && r.se.notas === n && r.se.engajamento === e
    );
  }

  it("frequência baixa com notas baixas leva a risco crítico, em qualquer engajamento", () => {
    for (const e of ["baixo", "medio", "alto"]) {
      expect(regra("baixa", "baixa", e)?.entao).toBe("critico");
    }
  });

  it("frequência baixa com engajamento baixo leva a risco alto mesmo com notas boas", () => {
    // Esta é a regra central do projeto: é o caso que um critério baseado só
    // na média classificaria como aluno tranquilo.
    expect(regra("baixa", "alta", "baixo")?.entao).toBe("alto");
  });

  it("tudo alto leva a risco baixo", () => {
    expect(regra("alta", "alta", "alto")?.entao).toBe("baixo");
  });

  it("tudo mediano leva a risco médio", () => {
    expect(regra("media", "media", "medio")?.entao).toBe("medio");
  });

  it("as quatro regras da especificação estão marcadas como destaque", () => {
    const destaques = regrasEmDestaque();
    expect(destaques).toHaveLength(4);
    expect(destaques.map((r) => r.id).sort((a, b) => a - b)).toEqual([1, 7, 14, 27]);
  });

  it.each(regrasEmDestaque())("a regra em destaque $id tem justificativa mais longa", (regra) => {
    // As regras de destaque são as que aparecem na apresentação; a explicação
    // delas precisa se sustentar sozinha.
    expect(regra.porque.length).toBeGreaterThan(60);
  });
});

describe("distribuição das saídas", () => {
  it("nenhum termo de saída domina a base inteira", () => {
    const contagem: Record<string, number> = {};
    for (const r of BASE_DE_REGRAS) contagem[r.entao] = (contagem[r.entao] ?? 0) + 1;
    for (const total of Object.values(contagem)) {
      expect(total).toBeLessThan(BASE_DE_REGRAS.length / 2);
    }
  });

  it.each(["baixo", "medio", "alto", "critico"])("o termo %s aparece em pelo menos três regras", (t) => {
    expect(BASE_DE_REGRAS.filter((r) => r.entao === t).length).toBeGreaterThanOrEqual(3);
  });
});
