// O que o assistente pode responder quando o material não responde.
//
// Até aqui havia dois desfechos: a pergunta era coberta pelos documentos e
// virava resposta com fonte, ou não era e virava recusa. Isso é o certo para
// "quando é a P1", porque uma data inventada é o pior resultado possível deste
// sistema. Mas produzia recusa em perguntas que qualquer pessoa espera que um
// assistente de estudos responda: como funciona o trancamento, o que é a
// biblioteca da instituição, o que significa busca heurística.
//
// A terceira saída é responder com o conhecimento geral do modelo, dizendo com
// todas as letras que aquilo NÃO saiu do material da disciplina. O que a torna
// aceitável é o recorte: ela só existe para dois assuntos, e nenhum deles
// admite que o modelo invente número, data ou prazo.
//
// O recorte é deliberadamente conservador. Fora dele, a recusa continua sendo a
// resposta, e é isso que mantém "quem ganhou a Copa de 2022" fora do assunto.

/** Vida acadêmica e a instituição: o que um aluno pergunta na secretaria. */
const ASSUNTO_INSTITUCIONAL: RegExp[] = [
  /\bunisagrado\b/,
  /\b(faculdade|universidade|institui[çc][ãa]o|campus)\b/,
  /\b(biblioteca|secretaria|coordena[çc][ãa]o\s+do\s+curso|tesouraria|protocolo)\b/,
  /\b(matr[íi]cula|rematr[íi]cula|trancamento|trancar|transfer[êe]ncia|jubila)/,
  /\b(est[áa]gio|tcc|monografia|trabalho\s+de\s+conclus[ãa]o|col[ao]ç[ãa]o|diploma)\b/,
  /\b(bolsa|prouni|fies|financiamento|mensalidade|desconto)\b/,
  /\b(enade|mec|reconhecimento\s+do\s+curso|avalia[çc][ãa]o\s+do\s+mec)\b/,
  /\b(grade|matriz\s+curricular|cr[ée]ditos?|carga\s+hor[áa]ria|semestre|per[íi]odo\s+letivo)\b/,
  /\b(depend[êe]ncia|dp|reprova|aprova[çc][ãa]o|m[ée]dia\s+para\s+passar|exame\s+final)\b/,
  /\b(atestado|abono|falta\s+justificada|justificar\s+falta)\b/,
  /\b(portal\s+do\s+aluno|connect|ambiente\s+virtual|ava)\b/,
  /\b(curso|gradua[çc][ãa]o|bacharelado|licenciatura)\b/,
];

/** O conteúdo das disciplinas do professor: é para isso que o aluno estuda. */
const ASSUNTO_DE_CONTEUDO: RegExp[] = [
  /\b(intelig[êe]ncia\s+artificial|\bia\b)\b/,
  /\b(agente|agentes)\s+(inteligente|racional|reativo|de\s+software)/,
  /\b(busca)\s+(cega|em\s+largura|em\s+profundidade|heur[íi]stica|de\s+custo|online|competitiva|informada|n[ãa]o\s+informada)/,
  /\b(heur[íi]stica|admiss[íi]vel|a\s*\*|espa[çc]o\s+de\s+estados|fronteira|lista\s+fechada)\b/,
  /\b(psr|satisfa[çc][ãa]o\s+de\s+restri[çc][õo]es|backtracking)\b/,
  /\b(l[óo]gica\s+fuzzy|fuzzifica|pertin[êe]ncia|mamdani|centroide)\b/,
  /\b(aprendizado\s+de\s+m[áa]quina|machine\s+learning|knn|bayesiano|classificador|agrupamento|clusteriza|regress[ãa]o)\b/,
  /\b(algoritmos?\s+gen[ée]ticos?|muta[çc][ãa]o|crossover|popula[çc][ãa]o\s+inicial)\b/,
  /\b(rede\s+neural|redes\s+neurais|perceptron|deep\s+learning|transformer)\b/,
  /\b(llm|modelo\s+de\s+linguagem|ia\s+generativa|prompt|rag|embedding)\b/,
  /\b(grafo|grafos|v[ée]rtice|aresta|[áa]rvore\s+geradora|caminho\s+m[íi]nimo|dijkstra|kruskal|prim)\b/,
  /\b(complexidade|np[- ]completo|big\s*o)\b/,
  /\b(minimax|poda\s+alfa|jogo\s+de\s+soma\s+zero)\b/,
];

export type EscopoGeral = "instituicao" | "conteudo";

/**
 * Diz se a pergunta pode ser respondida com conhecimento geral, e de que tipo.
 *
 * Devolve `null` para tudo que não for um dos dois assuntos, e é esse `null`
 * que preserva a recusa em pergunta fora de contexto.
 */
export function escopoDaPergunta(pergunta: string): EscopoGeral | null {
  const texto = pergunta.toLowerCase();
  if (ASSUNTO_DE_CONTEUDO.some((p) => p.test(texto))) return "conteudo";
  if (ASSUNTO_INSTITUCIONAL.some((p) => p.test(texto))) return "instituicao";
  return null;
}
