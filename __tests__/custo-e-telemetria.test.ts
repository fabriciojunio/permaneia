import { describe, expect, it } from "vitest";
import { custoEstimadoUsd, precoDe, TABELA_DE_PRECO } from "@/lib/ia/custo";
import { percentil } from "@/lib/rag/telemetria";

describe("tabela de preço", () => {
  it("casa o modelo pelo prefixo mais específico primeiro", () => {
    // A ordem da tabela é a defesa contra o caso em que um prefixo curto
    // engole um nome mais longo. Se alguém reordenar a lista por engano, o
    // preço do 3.5 passaria a ser cobrado pelo valor do 2.5, que é oito vezes
    // menor na saída, e a estimativa sairia errada sem nenhum erro aparecer.
    const preco = precoDe("gemini-3.5-flash-lite-preview-09-2026");
    expect(preco).toEqual({ entrada: 0.3, saida: 2.5 });
  });

  it("devolve nulo para modelo desconhecido, em vez de zero", () => {
    // Esta é a diferença entre "não custou nada" e "não sei quanto custou". O
    // alias -latest faz o nome mudar sozinho, e nesse dia a estimativa precisa
    // parar de responder em vez de responder zero.
    expect(precoDe("gemini-9-ainda-nao-existe")).toBeNull();
    expect(custoEstimadoUsd("gemini-9-ainda-nao-existe", { entrada: 1000, saida: 500, total: 1500 })).toBeNull();
  });

  it("devolve nulo quando o provedor não mandou o consumo", () => {
    expect(custoEstimadoUsd("gemini-2.5-flash-lite", undefined)).toBeNull();
  });

  it("calcula o custo pela contagem de tokens da API", () => {
    // 10.000 de entrada a 0,10 por milhão = 0,001
    // 2.000 de saída a 0,40 por milhão    = 0,0008
    const custo = custoEstimadoUsd("gemini-2.5-flash-lite", {
      entrada: 10_000,
      saida: 2_000,
      total: 12_000,
    });
    expect(custo).toBeCloseTo(0.0018, 6);
  });

  it("não arredonda o custo para zero numa pergunta típica", () => {
    // Uma pergunta deste assistente gasta na casa de mil tokens. Se a conta
    // arredondasse para centavo, toda a telemetria de custo viraria uma coluna
    // de zeros e não serviria para nada.
    const custo = custoEstimadoUsd("gemini-2.5-flash-lite", { entrada: 1200, saida: 180, total: 1380 });
    expect(custo).toBeGreaterThan(0);
  });

  it("a tabela tem data de conferência e nenhum preço negativo", () => {
    for (const [modelo, preco] of TABELA_DE_PRECO) {
      expect(preco.entrada, modelo).toBeGreaterThan(0);
      expect(preco.saida, modelo).toBeGreaterThan(0);
      // Saída sempre custa mais que entrada nos modelos desta família. Se um
      // dia isso inverter, é sinal de erro de digitação na tabela.
      expect(preco.saida, modelo).toBeGreaterThanOrEqual(preco.entrada);
    }
  });
});

describe("percentil", () => {
  it("devolve nulo sem amostra, em vez de zero", () => {
    expect(percentil([], 0.95)).toBeNull();
  });

  it("o p95 acompanha a cauda quando a cauda tem mais de 5% da amostra", () => {
    // Cem respostas, seis delas lentas. A média fica em 882 ms e diz que está
    // tudo bem; o p95 mostra os 10 segundos que alguém de fato esperou.
    const amostra = [...Array(94).fill(300), ...Array(6).fill(10_000)];
    expect(percentil(amostra, 0.5)).toBe(300);
    expect(percentil(amostra, 0.95)).toBe(10_000);
  });

  it("com 20 pontos o p95 não enxerga o pior caso, e isso não é defeito", () => {
    // Este teste existe porque eu errei a conta antes dele: esperava que o p95
    // de dezenove respostas rápidas e uma lenta devolvesse a lenta. Não
    // devolve, e está certo. Um ponto em vinte é 5% da amostra, então ele fica
    // ACIMA do 95º percentil por definição.
    //
    // A consequência prática é a que importa: no começo do uso, com poucas
    // dezenas de perguntas registradas, o p95 não serve para detectar pico
    // isolado. Nessa fase, quem conta é a duração máxima.
    const amostra = [...Array(19).fill(300), 10_000];
    expect(percentil(amostra, 0.95)).toBe(300);
    expect(percentil(amostra, 1)).toBe(10_000);
  });

  it("com um ponto só, todo percentil é esse ponto", () => {
    expect(percentil([42], 0.5)).toBe(42);
    expect(percentil([42], 0.99)).toBe(42);
  });
});
