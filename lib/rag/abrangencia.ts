// Perguntas abrangentes: as que pedem o documento, e não um trecho dele.
//
// A busca vetorial devolve os pedaços mais parecidos com a pergunta, e isso
// funciona bem para "quando é a P1", que está numa linha só do cronograma. Para
// "qual é o conteúdo das aulas" funciona mal, e de um jeito que engana: a
// resposta sai correta, citada e completamente parcial, falando de uma aula
// porque foi essa que ficou no topo do ranking.
//
// Quando a pergunta é de enumeração, o contexto passa a ser o documento inteiro
// em ordem, e não os k trechos mais próximos.

/** Frases que pedem enumeração, e não um dado pontual. */
const PADROES_ABRANGENTES: RegExp[] = [
  /\bquais\b/,
  /\bquantas?\s+(aulas|provas|atividades|entregas|avaliações|avaliacoes)\b/,
  /\b(liste|listar|lista\s+d[aeo]s?|relacione|enumere)\b/,
  /\btod[oa]s?\s+(as?\s+)?(aulas|datas|provas|atividades|entregas|temas|assuntos|tópicos|topicos)\b/,
  /\bconte[úu]do\s+(program[áa]tico|d[aeo]s?\s+(aula|disciplina|curso|semestre))/,
  /\b(temas|assuntos|t[óo]picos|mat[ée]rias)\b/,
  /\bo\s+que\s+(vai\s+ser|ser[áa]|vamos|se)\s+(estudad|vist|dad|aprend|ver)/,
  /\bcronograma\s+(completo|inteiro|tod[oa])\b/,
  /\bementa\b/,
  /\bresumo\s+d[aeo]\b/,
  /\bcomo\s+(é|e|fica|funciona)\s+a\s+avaliação\b/,
];

/**
 * Marcadores de pergunta pontual. Vencem os padrões acima porque "quais os
 * critérios da Prova P1" pede um trecho específico, mesmo começando com
 * "quais": o aluno já disse de qual parte do material está falando.
 */
const PADROES_PONTUAIS: RegExp[] = [
  /\b(prova\s+)?p[123]\b/,
  /\bquando\b/,
  /\bque\s+dia\b/,
  /\bque\s+horas?\b/,
  /\bem\s+que\s+(aula|data|dia)\b/,
  /\bna\s+aula\s+de\b/,
];

export function perguntaAbrangente(pergunta: string): boolean {
  const texto = pergunta.toLowerCase();
  if (PADROES_PONTUAIS.some((p) => p.test(texto))) return false;
  return PADROES_ABRANGENTES.some((p) => p.test(texto));
}

/**
 * Perguntas que dependem de saber que dia é hoje.
 *
 * São uma classe à parte porque o contexto certo para elas não é o trecho mais
 * parecido, e sim o calendário inteiro mais a conta de dias já resolvida. O
 * registro de consultas mostrou "Quando é a proxima aula" e "na materia da
 * semana que vem vai ter o que?" sendo recusadas com seis trechos do cronograma
 * no contexto: o modelo tinha aulas soltas na mão, sem saber quais já passaram.
 */
const PADROES_TEMPORAIS: RegExp[] = [
  /\bpr[óo]xim[ao]s?\b/,
  /\bseguinte\b/,
  /\bhoje\b/,
  // Sem fronteira no fim: em "amanhã?" o \b do JavaScript não casa depois de
  // letra acentuada, que ele não considera caractere de palavra.
  /\bamanh[ãa]/,
  /\bontem\b/,
  /\bessa\s+semana\b/,
  /\b(semana|m[êe]s|aula|prova|avalia[çc][ãa]o|entrega)\s+que\s+vem\b/,
  /\bsemana\s+(passada|seguinte)\b/,
  /\bfalta[m]?\s+(quanto|quantos|quantas)\b/,
  /\bquanto\s+(tempo|falta)\b/,
  /\bquantos\s+dias\b/,
  /\bj[áa]\s+(passou|teve|aconteceu)\b/,
  /\bvem\s+(agora|a\s+seguir)\b/,
  /\ba\s+seguir\b/,
  /\bdepois\s+de\s+hoje\b/,
  /\best[áa]\s+atrasad/,
];

export function perguntaTemporal(pergunta: string): boolean {
  const texto = pergunta.toLowerCase();
  return PADROES_TEMPORAIS.some((p) => p.test(texto));
}
