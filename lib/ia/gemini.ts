// Provedor Google Gemini, via API REST do Google AI Studio (tier gratuito).
//
// Não usamos o SDK oficial de propósito: a superfície que precisamos são duas
// chamadas HTTP, e uma dependência a menos significa uma dependência a menos
// para auditar e para o Dependabot atualizar. A chave nunca sai do servidor;
// a CSP do app bloqueia qualquer conexão do navegador para fora da origem.

import {
  DIMENSAO_EMBEDDING,
  ErroProvedorIA,
  validarEmbedding,
  type OpcoesGeracao,
  type ProvedorIA,
  type RespostaGeracao,
} from "./provedor";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TEMPO_LIMITE_MS = 20_000;

function modeloTexto(): string {
  return process.env.GEMINI_MODELO_TEXTO || "gemini-2.0-flash";
}

function modeloEmbedding(): string {
  return process.env.GEMINI_MODELO_EMBEDDING || "text-embedding-004";
}

/** Executa a chamada com tempo limite. Sem isso, uma API lenta prende a rota até o timeout da plataforma. */
async function requisitar(url: string, corpo: unknown, chave: string): Promise<unknown> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(url, {
      method: "POST",
      signal: controle.signal,
      headers: {
        "Content-Type": "application/json",
        // Em header, e não na query string: chave em URL vaza em log de proxy.
        "x-goog-api-key": chave,
      },
      body: JSON.stringify(corpo),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      // 429 e 5xx são transitórios e valem fallback; 400 e 403 indicam chave ou
      // requisição inválida, e insistir só queima cota.
      const recuperavel = resposta.status === 429 || resposta.status >= 500;
      throw new ErroProvedorIA(
        "gemini",
        `Gemini respondeu ${resposta.status}. ${detalhe.slice(0, 200)}`,
        recuperavel
      );
    }
    return await resposta.json();
  } catch (e) {
    if (e instanceof ErroProvedorIA) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErroProvedorIA("gemini", `Gemini não respondeu em ${TEMPO_LIMITE_MS} ms.`);
    }
    throw new ErroProvedorIA("gemini", `Falha de rede ao chamar o Gemini: ${(e as Error).message}`);
  } finally {
    clearTimeout(relogio);
  }
}

type RespostaTexto = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

type RespostaEmbedding = { embedding?: { values?: number[] } };
type RespostaEmbeddingLote = { embeddings?: Array<{ values?: number[] }> };

export class ProvedorGemini implements ProvedorIA {
  readonly nome = "gemini" as const;
  private readonly chave: string;

  constructor(chave = process.env.GEMINI_API_KEY ?? "") {
    this.chave = chave;
  }

  disponivel(): boolean {
    return this.chave.length > 0 && process.env.IA_EXTERNA !== "off";
  }

  async gerarTexto(prompt: string, opcoes: OpcoesGeracao = {}): Promise<RespostaGeracao> {
    if (!this.disponivel()) {
      throw new ErroProvedorIA("gemini", "GEMINI_API_KEY ausente ou integração desligada.");
    }

    const corpo = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(opcoes.sistema ? { systemInstruction: { parts: [{ text: opcoes.sistema }] } } : {}),
      generationConfig: {
        // Temperatura baixa porque o objetivo é fidelidade ao documento, não
        // variedade de redação. Este é o parâmetro que mais afeta alucinação.
        temperature: opcoes.temperatura ?? 0.15,
        maxOutputTokens: opcoes.maxTokens ?? 800,
        topP: 0.9,
      },
    };

    const dados = (await requisitar(
      `${BASE}/models/${encodeURIComponent(modeloTexto())}:generateContent`,
      corpo,
      this.chave
    )) as RespostaTexto;

    const partes = dados.candidates?.[0]?.content?.parts ?? [];
    const texto = partes.map((p) => p.text ?? "").join("").trim();
    if (!texto) {
      const motivo = dados.candidates?.[0]?.finishReason ?? "resposta vazia";
      throw new ErroProvedorIA("gemini", `Gemini não devolveu texto (${motivo}).`);
    }
    return { texto, origem: "gemini" };
  }

  async gerarEmbedding(texto: string): Promise<number[]> {
    if (!this.disponivel()) {
      throw new ErroProvedorIA("gemini", "GEMINI_API_KEY ausente ou integração desligada.");
    }

    const dados = (await requisitar(
      `${BASE}/models/${encodeURIComponent(modeloEmbedding())}:embedContent`,
      {
        model: `models/${modeloEmbedding()}`,
        content: { parts: [{ text: texto }] },
        outputDimensionality: DIMENSAO_EMBEDDING,
      },
      this.chave
    )) as RespostaEmbedding;

    const valores = dados.embedding?.values;
    if (!valores) throw new ErroProvedorIA("gemini", "Gemini não devolveu o vetor do embedding.");
    return validarEmbedding(valores, "gemini");
  }

  async gerarEmbeddings(textos: string[]): Promise<number[][]> {
    if (textos.length === 0) return [];
    if (!this.disponivel()) {
      throw new ErroProvedorIA("gemini", "GEMINI_API_KEY ausente ou integração desligada.");
    }

    // O endpoint em lote aceita até 100 pedidos por chamada. Ingerir um PDF de
    // cronograma inteiro em uma requisição, em vez de uma por trecho, é a
    // diferença entre caber e não caber na cota diária do tier gratuito.
    const TAMANHO_LOTE = 100;
    const saida: number[][] = [];

    for (let i = 0; i < textos.length; i += TAMANHO_LOTE) {
      const fatia = textos.slice(i, i + TAMANHO_LOTE);
      const dados = (await requisitar(
        `${BASE}/models/${encodeURIComponent(modeloEmbedding())}:batchEmbedContents`,
        {
          requests: fatia.map((texto) => ({
            model: `models/${modeloEmbedding()}`,
            content: { parts: [{ text: texto }] },
            outputDimensionality: DIMENSAO_EMBEDDING,
          })),
        },
        this.chave
      )) as RespostaEmbeddingLote;

      const vetores = dados.embeddings;
      if (!vetores || vetores.length !== fatia.length) {
        throw new ErroProvedorIA(
          "gemini",
          `Lote de embeddings incompleto: pedidos ${fatia.length}, recebidos ${vetores?.length ?? 0}.`
        );
      }
      for (const v of vetores) {
        saida.push(validarEmbedding(v.values ?? [], "gemini"));
      }
    }

    return saida;
  }
}
