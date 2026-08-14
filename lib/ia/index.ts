// Seleção do provedor de IA e política de degradação.
//
// Regra do sistema: o Gemini é usado quando está configurado e responde; em
// qualquer falha o provedor local assume e a aplicação continua respondendo.
// A resposta sempre declara a origem, e a interface mostra isso ao usuário: uma
// resposta gerada e uma resposta extraída do documento têm garantias
// diferentes, e esconder qual das duas o aluno está lendo seria desonesto.

import { ProvedorGemini } from "./gemini";
import { ProvedorLocal } from "./local";
import { ErroProvedorIA, type OpcoesGeracao, type OrigemResposta, type ProvedorIA } from "./provedor";

export type { ProvedorIA, OrigemResposta } from "./provedor";
export { DIMENSAO_EMBEDDING, ErroProvedorIA } from "./provedor";

const local = new ProvedorLocal();

/** Instancia o provedor externo a cada chamada para que uma mudança de env em runtime seja respeitada. */
function externo(): ProvedorGemini {
  return new ProvedorGemini();
}

export type ResultadoComFallback<T> = {
  valor: T;
  origem: OrigemResposta;
  /** Preenchido quando o provedor externo falhou e o local assumiu. */
  motivoFallback?: string;
};

/**
 * Gera texto pelo provedor externo, caindo no local se ele não estiver
 * disponível ou falhar. Erros marcados como não recuperáveis (chave inválida,
 * requisição malformada) também caem no local: do ponto de vista do aluno na
 * frente da tela, uma resposta extraída do documento é sempre melhor do que
 * uma tela de erro.
 */
export async function gerarTextoComFallback(
  prompt: string,
  opcoes?: OpcoesGeracao
): Promise<ResultadoComFallback<string>> {
  const provedor = externo();
  if (provedor.disponivel()) {
    try {
      const r = await provedor.gerarTexto(prompt, opcoes);
      return { valor: r.texto, origem: r.origem };
    } catch (e) {
      const motivo = e instanceof ErroProvedorIA ? e.message : (e as Error).message;
      const r = await local.gerarTexto(prompt, opcoes);
      return { valor: r.texto, origem: "local", motivoFallback: motivo };
    }
  }
  const r = await local.gerarTexto(prompt, opcoes);
  return { valor: r.texto, origem: "local", motivoFallback: "Provedor externo não configurado." };
}

/**
 * Gera embeddings em lote com a mesma política.
 *
 * Um detalhe importante: a origem devolvida aqui precisa ser gravada junto com
 * os vetores. Vetor do Gemini e vetor do provedor local vivem em espaços
 * completamente diferentes, e comparar um com o outro produz similaridade sem
 * significado. A busca sempre filtra por `origem_embedding`.
 */
export async function gerarEmbeddingsComFallback(
  textos: string[]
): Promise<ResultadoComFallback<number[][]>> {
  if (textos.length === 0) return { valor: [], origem: origemAtual() };

  const provedor = externo();
  if (provedor.disponivel()) {
    try {
      const vetores = await provedor.gerarEmbeddings(textos);
      return { valor: vetores, origem: "gemini" };
    } catch (e) {
      const motivo = e instanceof ErroProvedorIA ? e.message : (e as Error).message;
      return { valor: await local.gerarEmbeddings(textos), origem: "local", motivoFallback: motivo };
    }
  }
  return {
    valor: await local.gerarEmbeddings(textos),
    origem: "local",
    motivoFallback: "Provedor externo não configurado.",
  };
}

/** Gera o vetor de um texto único, com a mesma política de fallback. */
export async function gerarEmbeddingComFallback(
  texto: string
): Promise<ResultadoComFallback<number[]>> {
  const r = await gerarEmbeddingsComFallback([texto]);
  const vetor = r.valor[0];
  if (!vetor) {
    // Só acontece se um provedor devolver lote vazio para entrada não vazia.
    const local0 = await local.gerarEmbedding(texto);
    return { valor: local0, origem: "local", motivoFallback: "Lote de embeddings vazio." };
  }
  return { valor: vetor, origem: r.origem, motivoFallback: r.motivoFallback };
}

/** Origem que o sistema usaria agora, sem executar chamada. Serve ao /api/health e à tela de status. */
export function origemAtual(): OrigemResposta {
  return externo().disponivel() ? "gemini" : "local";
}

/** Exposto para os testes e para os scripts injetarem um provedor controlado. */
export function provedorLocal(): ProvedorIA {
  return local;
}
