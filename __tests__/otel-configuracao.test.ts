import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configurado } from "@/lib/otel";

/**
 * Este arquivo nasceu de um incidente, e o teste é o que impede a repetição.
 *
 * As chaves do Langfuse foram gravadas na plataforma por uma ferramenta que
 * escreve UTF-8 com marca de ordem de byte. O valor chegou à aplicação com um
 * caractere invisível na frente, o construtor de URL recusou o endereço, a
 * exceção subiu pelo gancho de instrumentação do Next e **toda** requisição
 * passou a responder 500, inclusive a rota de saúde.
 *
 * Duas lições viraram código: limpar o valor antes de usar, e nunca deixar
 * telemetria lançar para fora.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("configuração do rastro", () => {
  it("fica desligado sem as duas chaves", () => {
    expect(configurado()).toBe(false);
    process.env.LANGFUSE_PUBLIC_KEY = "pk-exemplo";
    expect(configurado()).toBe(false);
  });

  it("liga com as duas chaves", () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-exemplo";
    process.env.LANGFUSE_SECRET_KEY = "sk-exemplo";
    expect(configurado()).toBe(true);
  });

  it("valor só com espaço ou quebra de linha conta como ausente", () => {
    // Variável criada vazia na plataforma chega como string em branco, e tratar
    // isso como configurado faria o SDK subir sem credencial e falhar a cada
    // consulta.
    process.env.LANGFUSE_PUBLIC_KEY = "   ";
    process.env.LANGFUSE_SECRET_KEY = "\n";
    expect(configurado()).toBe(false);
  });

  it("marca de ordem de byte no começo não impede o reconhecimento", () => {
    // O caso do incidente. Antes da limpeza, o valor era aceito como presente e
    // ia inteiro, com o caractere invisível, para dentro do endereço.
    process.env.LANGFUSE_PUBLIC_KEY = "﻿pk-exemplo";
    process.env.LANGFUSE_SECRET_KEY = "﻿sk-exemplo\n";
    expect(configurado()).toBe(true);
  });
});
