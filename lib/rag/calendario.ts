// Agenda da disciplina, calculada a partir do cronograma indexado.
//
// Por que isto existe, e não é só mais uma instrução no prompt: perguntas como
// "quando é a próxima aula" ou "o que vai ter na semana que vem" dependem de
// duas coisas que o modelo não tem. A primeira é a data de hoje, e essa já vai
// no prompt. A segunda é aritmética de calendário sobre vinte datas, e essa é
// exatamente o tipo de tarefa em que um modelo de linguagem erra em silêncio.
//
// O registro de consultas mostrou as duas perguntas sendo recusadas mesmo com
// seis trechos do cronograma no contexto: o modelo recebia aulas soltas, sem
// saber quais já passaram, e a recusa era a resposta honesta que sobrava.
//
// A divisão de trabalho aqui é a que o projeto usa em todo lugar: quem calcula
// é o domínio, quem redige é o modelo. As datas que aparecem na resposta são
// escolhidas por este arquivo, com data e diferença de dias já resolvidas, e o
// modelo só transforma isso em frase, citando o cronograma.

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const DIA_MS = 24 * 60 * 60 * 1000;

export type EventoCalendario = {
  /** Meio-dia UTC do dia do encontro. A hora existe só para não cruzar fuso. */
  data: Date;
  descricao: string;
  documentoId: string;
  titulo: string;
};

export type TrechoDatado = {
  documentoId: string;
  titulo: string;
  texto: string;
};

/**
 * Os escapes das marcas combinantes são obrigatórios, e não estilo: a classe
 * escrita com os caracteres literais funciona no fonte e falha no pacote
 * publicado. Já aconteceu neste projeto, nas barreiras de entrada.
 */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Número do mês, de 0 a 11, ou -1 para nome desconhecido. */
export function indiceDoMes(nome: string): number {
  const alvo = semAcento(nome.toLowerCase());
  return MESES.findIndex((m) => semAcento(m) === alvo);
}

/**
 * Meio-dia UTC do dia informado.
 *
 * O horário no meio do dia é deliberado: com meia-noite, qualquer conversão de
 * fuso joga a data para o dia anterior ou seguinte, e uma aula de quinta vira
 * quarta na conta de dias restantes.
 */
export function dataUtc(ano: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes, dia, 12, 0, 0));
}

const PADRAO_DATA = /(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/gi;

/**
 * Lê as datas por extenso de um trecho e o texto que vem depois de cada uma.
 *
 * O formato é o do cronograma do professor: "24 de setembro de 2026,
 * quinta-feira. Avaliação. Prova P1." A descrição de um evento vai até a
 * próxima data do mesmo trecho, porque a divisão por unidade às vezes junta
 * duas aulas curtas no mesmo parágrafo.
 */
export function extrairEventosDoTexto(trecho: TrechoDatado): EventoCalendario[] {
  const eventos: EventoCalendario[] = [];
  const encontrados = [...trecho.texto.matchAll(PADRAO_DATA)];

  for (let i = 0; i < encontrados.length; i += 1) {
    const atual = encontrados[i]!;
    const mes = indiceDoMes(atual[2]!);
    if (mes === -1) continue;

    const dia = Number(atual[1]);
    const ano = Number(atual[3]);
    if (!Number.isFinite(dia) || dia < 1 || dia > 31) continue;

    const inicio = (atual.index ?? 0) + atual[0].length;
    const fim = encontrados[i + 1]?.index ?? trecho.texto.length;

    const descricao = trecho.texto
      .slice(inicio, fim)
      // O dia da semana já está na data; repeti-lo só ocupa espaço no prompt.
      .replace(/^\s*,?\s*(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?\s*\.?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[.,;:]\s*/, "");

    if (descricao.length === 0) continue;
    eventos.push({ data: dataUtc(ano, mes, dia), descricao, documentoId: trecho.documentoId, titulo: trecho.titulo });
  }

  return eventos;
}

/**
 * Os eventos do documento que mais parece um calendário.
 *
 * "Mais parece" é medido, e não decidido por título: o documento que produz o
 * maior número de datas distintas é o cronograma. Amarrar isso ao título faria
 * a agenda sumir no dia em que a coordenação subisse o mesmo calendário com
 * outro nome, que é justamente quando ninguém iria procurar aqui.
 */
export function calendarioDaDisciplina(trechos: TrechoDatado[]): EventoCalendario[] {
  const porDocumento = new Map<string, EventoCalendario[]>();

  for (const trecho of trechos) {
    for (const evento of extrairEventosDoTexto(trecho)) {
      const lista = porDocumento.get(evento.documentoId) ?? [];
      lista.push(evento);
      porDocumento.set(evento.documentoId, lista);
    }
  }

  let escolhido: EventoCalendario[] = [];
  let maiorNumeroDeDias = 0;

  for (const eventos of porDocumento.values()) {
    const dias = new Set(eventos.map((e) => e.data.getTime())).size;
    if (dias > maiorNumeroDeDias) {
      maiorNumeroDeDias = dias;
      escolhido = eventos;
    }
  }

  // Um documento com uma data solta não é calendário: é uma menção de data.
  if (maiorNumeroDeDias < 3) return [];

  return [...escolhido].sort((a, b) => a.data.getTime() - b.data.getTime());
}

/** O dia de hoje em Brasília, como meio-dia UTC, para comparar com os eventos. */
export function hojeEmBrasilia(agora = new Date()): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [ano, mes, dia] = partes.split("-").map(Number);
  return dataUtc(ano!, mes! - 1, dia!);
}

export function diasEntre(de: Date, ate: Date): number {
  return Math.round((ate.getTime() - de.getTime()) / DIA_MS);
}

/** Segunda-feira da semana do dia informado. */
export function segundaDaSemana(dia: Date): Date {
  const diaDaSemana = dia.getUTCDay(); // 0 é domingo
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  return new Date(dia.getTime() - recuo * DIA_MS);
}

export function porExtenso(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(data);
}

/** Descrição curta: o prompt não precisa da lista de materiais de cada aula. */
function resumir(descricao: string, maximo = 140): string {
  if (descricao.length <= maximo) return descricao;
  return `${descricao.slice(0, maximo).trimEnd()}…`;
}

function emDias(dias: number): string {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${Math.abs(dias)} dias`;
}

/** Palavras que marcam um encontro de avaliação dentro da descrição. */
const MARCAS_DE_AVALIACAO = /(avalia|prova|exame|substitutiva|entrega\s+de\s+trabalho|entrega\s+do\s+trabalho)/i;

/**
 * O bloco de agenda que vai para o prompt.
 *
 * Devolve `null` quando não há calendário reconhecível na disciplina: nesse
 * caso o assistente segue sem agenda, e responder "não encontrei" continua
 * sendo o certo.
 */
export function resumirAgenda(eventos: EventoCalendario[], hoje = hojeEmBrasilia()): string | null {
  if (eventos.length === 0) return null;

  const linhas: string[] = [`Hoje é ${porExtenso(hoje)}.`];

  const passados = eventos.filter((e) => diasEntre(hoje, e.data) < 0);
  const futuros = eventos.filter((e) => diasEntre(hoje, e.data) >= 0);

  const ultimo = passados[passados.length - 1];
  if (ultimo) {
    linhas.push(
      `Último encontro já realizado: ${porExtenso(ultimo.data)} (${emDias(diasEntre(hoje, ultimo.data))}). ${resumir(ultimo.descricao)}`
    );
  }

  const proximo = futuros[0];
  if (proximo) {
    linhas.push(
      `Próximo encontro: ${porExtenso(proximo.data)} (${emDias(diasEntre(hoje, proximo.data))}). ${resumir(proximo.descricao)}`
    );
  } else {
    linhas.push("Não há mais encontros futuros no cronograma desta disciplina.");
  }

  // Semana que vem: de segunda a domingo da semana seguinte à de hoje.
  const inicioDaProximaSemana = new Date(segundaDaSemana(hoje).getTime() + 7 * DIA_MS);
  const fimDaProximaSemana = new Date(inicioDaProximaSemana.getTime() + 6 * DIA_MS);
  const naProximaSemana = eventos.filter(
    (e) => e.data >= inicioDaProximaSemana && e.data <= fimDaProximaSemana
  );

  const janela = `${porExtenso(inicioDaProximaSemana)} a ${porExtenso(fimDaProximaSemana)}`;
  linhas.push(
    naProximaSemana.length > 0
      ? `Semana que vem (${janela}): ${naProximaSemana.map((e) => `${porExtenso(e.data)}. ${resumir(e.descricao)}`).join(" | ")}`
      : `Semana que vem (${janela}): nenhum encontro previsto no cronograma.`
  );

  const proximaAvaliacao = futuros.find((e) => MARCAS_DE_AVALIACAO.test(e.descricao));
  if (proximaAvaliacao) {
    linhas.push(
      `Próxima avaliação ou entrega: ${porExtenso(proximaAvaliacao.data)} (${emDias(diasEntre(hoje, proximaAvaliacao.data))}). ${resumir(proximaAvaliacao.descricao)}`
    );
  }

  return linhas.join("\n");
}
