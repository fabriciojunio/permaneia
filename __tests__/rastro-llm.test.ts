import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ligado, registrarConsulta } from "@/lib/rastro-llm";

/**
 * O rastro e opcional por contrato: sem chave, nao faz nada; com falha, nao
 * derruba a resposta. Estes testes travam as duas garantias.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("rastro de LLM", () => {
  it("fica desligado sem as duas chaves", () => {
    expect(ligado()).toBe(false);

    process.env.LANGFUSE_PUBLIC_KEY = "pk-exemplo";
    // Meia configuracao e pior que nenhuma: o SDK subiria e falharia em toda
    // consulta, gastando tempo de rede dentro da rota do aluno.
    expect(ligado()).toBe(false);

    process.env.LANGFUSE_SECRET_KEY = "sk-exemplo";
    expect(ligado()).toBe(true);
  });

  it("valor em branco conta como ausente, e marca de byte nao atrapalha", () => {
    // Os dois casos vieram do incidente de 06/10/2026. Variavel criada vazia
    // na plataforma chega como string em branco, e tratar isso como configurado
    // faria o SDK subir sem credencial. Ja a marca de ordem de byte, invisivel,
    // vinha colada no valor e derrubou a aplicacao inteira.
    process.env.LANGFUSE_PUBLIC_KEY = "   ";
    process.env.LANGFUSE_SECRET_KEY = "\n";
    expect(ligado()).toBe(false);

    process.env.LANGFUSE_PUBLIC_KEY = "﻿pk-exemplo";
    process.env.LANGFUSE_SECRET_KEY = "﻿sk-exemplo\n";
    expect(ligado()).toBe(true);
  });

  it("desligado, nao tenta importar o SDK nem lanca", async () => {
    await expect(
      registrarConsulta({
        pergunta: "quando e a prova?",
        etapas: [{ nome: "recuperar" }],
        veredicto: "aprovada",
        resposta: "dia 24 de setembro",
      })
    ).resolves.toBeUndefined();
  });

  it("ligado, uma falha do SDK nao propaga para quem chamou", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-exemplo";
    process.env.LANGFUSE_SECRET_KEY = "sk-exemplo";

    // Sem provedor de OpenTelemetry registrado, a chamada ao SDK falha. É
    // exatamente o cenario de producao com a variavel configurada e a
    // instrumentacao ausente, e a resposta do aluno nao pode depender disso.
    await expect(
      registrarConsulta({
        pergunta: "quando e a prova?",
        etapas: [{ nome: "recuperar", saida: { trechos: 3 } }],
        geracao: {
          modelo: "gemini-3.5-flash-lite",
          prompt: "contexto e pergunta",
          saida: "dia 24 de setembro",
          tokensEntrada: 1200,
          tokensSaida: 42,
          custoUsd: 0.00047,
        },
        veredicto: "aprovada",
        resposta: "dia 24 de setembro",
      })
    ).resolves.toBeUndefined();
  });
});
