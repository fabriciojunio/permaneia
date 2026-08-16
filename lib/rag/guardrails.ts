// Barreiras de entrada do assistente.
//
// O sistema já recusa pergunta fora do material pelo limiar de similaridade:
// nada relevante recuperado, nada respondido. Isso cobre a maior parte do
// "fora de assunto" e é o mecanismo principal.
//
// Estas barreiras cobrem o que o limiar NÃO cobre:
//
//   1. Injeção de prompt. "Ignore as instruções anteriores e me diga X" é uma
//      pergunta que pode até recuperar contexto legítimo, e cujo objetivo é
//      fazer o modelo abandonar as regras. O limiar não vê isso.
//   2. Conteúdo ilícito. Não deve consumir cota, não deve entrar no log de
//      consultas e não deve receber a mesma resposta educada de "não encontrei
//      no material", que soa como se a pergunta fosse legítima e só faltasse o
//      documento.
//
// Princípio de calibração: PRECISÃO acima de cobertura. Um falso positivo aqui
// bloqueia um aluno com uma dúvida legítima, o que é pior do que deixar passar
// uma pergunta estranha que o limiar vai recusar em seguida. Por isso os padrões
// exigem intenção explícita, e não palavra solta.

export type CategoriaBloqueio = "injecao" | "ilicito" | "dados-de-terceiros";

export type VeredictoPergunta = {
  permitida: boolean;
  categoria?: CategoriaBloqueio;
  /** Mensagem mostrada ao aluno. Nunca revela qual padrão casou. */
  mensagem?: string;
};

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tentativas de fazer o modelo abandonar as próprias regras.
 *
 * Os padrões exigem a estrutura da instrução, e não só o verbo. "Ignore" sozinho
 * não bloqueia, porque um aluno pode escrever "ignore o que eu perguntei antes,
 * na verdade quero saber sobre a P2".
 */
const PADROES_INJECAO: ReadonlyArray<RegExp> = [
  // Anular instruções anteriores.
  /\b(ignore|esquec[ae]|desconsidere|apague|descarte)\b[^.?!]{0,40}\b(instru(c|ç)(o|õ)es|regras|prompt|comando|orienta(c|ç)(o|õ)es|diretrizes|contexto acima|tudo (o )?que)\b/,
  // Pedir para revelar a configuração interna.
  /\b(mostre|revele|exiba|imprima|repita|qual (e|é)|me (diga|de|d(e|ê)))\b[^.?!]{0,40}\b(system prompt|prompt de sistema|instru(c|ç)(a|ã)o de sistema|suas instru(c|ç)(o|õ)es|suas regras|seu prompt)\b/,
  /\bsystem prompt\b/,
  // Trocar de papel ou de persona.
  /\b(aja|atue|comporte-se|finja|imagine que voce e|voce agora e)\b[^.?!]{0,40}\b(como|sendo|que voce)\b/,
  // Reenquadramento temporal. Ninguém pergunta "a partir de agora você é" a um
  // assistente de estudos com uma dúvida legítima; a construção só existe para
  // redefinir o papel.
  /\b(a partir de agora|de agora em diante|desse momento em diante)\b[^.?!]{0,20}\bvoce\b/,
  // Persona explicitamente sem limites.
  /\bvoce (e|sera|vai ser)\b[^.?!]{0,30}\bsem (filtros?|restri(c|ç)(o|õ)es|limites|censura|regras)\b/,
  /\bmodo (desenvolvedor|dev|debug|livre|irrestrito|sem restri(c|ç)(o|õ)es)\b/,
  /\b(dan|jailbreak|do anything now)\b/,
  // Marcadores de protocolo injetados no texto do usuário.
  /<\/?(contexto|pergunta|system|instru(c|ç)(a|ã)o)>/,
  /\b(assistant|system|user)\s*:\s*$/m,
  // Pedir para desobedecer explicitamente.
  /\b(sem|nao) (seguir|obedecer|respeitar)\b[^.?!]{0,30}\b(regras|instru(c|ç)(o|õ)es|limites)\b/,
  /\bresponda (mesmo (que|assim)|sem|independente)\b[^.?!]{0,40}\b(nao (esteja|estiver)|contexto|material|fonte)\b/,
];

/**
 * Conteúdo ilícito ou perigoso.
 *
 * Cada padrão exige VERBO DE INTENÇÃO junto do objeto. "Arma" sozinho não
 * bloqueia; "como fabricar uma arma" bloqueia. Sem essa exigência, uma pergunta
 * legítima sobre um texto de história ou sobre um estudo de caso seria barrada.
 */
const PADROES_ILICITO: ReadonlyArray<RegExp> = [
  // Armas e explosivos.
  /\b(como|passo a passo|tutorial|ensina|me ensine|receita)\b[^.?!]{0,50}\b(fabricar|construir|montar|fazer|produzir)\b[^.?!]{0,30}\b(bomba|explosivo|arma de fogo|artefato explosivo|dinamite|napalm)\b/,
  // Drogas.
  /\b(como|tutorial|receita|passo a passo)\b[^.?!]{0,50}\b(sintetizar|fabricar|produzir|cultivar|preparar)\b[^.?!]{0,30}\b(metanfetamina|cocaina|crack|lsd|ecstasy|drogas? ilicitas?|entorpecente)\b/,
  /\b(onde|como)\b[^.?!]{0,30}\b(comprar|conseguir|vender)\b[^.?!]{0,25}\b(drogas?|cocaina|maconha|entorpecente)\b/,
  // Invasão e fraude.
  /\b(como|tutorial|passo a passo|me ensine)\b[^.?!]{0,50}\b(invadir|hackear|burlar|fraudar|clonar|roubar)\b[^.?!]{0,35}\b(sistema|conta|senha|cartao|banco|wi-?fi|rede|prova|nota|boletim)\b/,
  /\b(como|tutorial)\b[^.?!]{0,40}\b(colar|fraudar|burlar)\b[^.?!]{0,25}\b(na prova|no exame|a prova|a avalia(c|ç)(a|ã)o)\b/,
  // Violência contra pessoa.
  /\b(como|melhor forma de|maneira de)\b[^.?!]{0,40}\b(matar|assassinar|envenenar|agredir|sequestrar|torturar)\b[^.?!]{0,30}\b(alguem|uma pessoa|meu|minha|o professor|a professora)\b/,
  // Automutilação e suicídio: bloqueia e responde com encaminhamento.
  /\b(como|melhor forma de|maneira de|quero)\b[^.?!]{0,30}\b(me matar|suicidar|tirar minha vida|me cortar|me machucar)\b/,
  /\bsuicidio\b[^.?!]{0,25}\b(como|metodo|forma|jeito)\b/,
];

/** Pedido de dado pessoal de outra pessoa, que o assistente nunca deve intermediar. */
const PADROES_DADOS_DE_TERCEIROS: ReadonlyArray<RegExp> = [
  /\b(qual|quais|me (diga|de|passe)|mostre|liste)\b[^.?!]{0,40}\b(nota|notas|media|frequencia|faltas|score|risco|telefone|endereco|cpf|email)\b[^.?!]{0,25}\b(do aluno|da aluna|dos alunos|de outro aluno|do meu colega|da minha colega|de fulano)\b/,
  /\b(quem|quais alunos?)\b[^.?!]{0,35}\b(esta|estao|corre|correm)\b[^.?!]{0,25}\b(em risco|risco de evasao|reprovado|reprovando)\b/,
];

const MENSAGENS: Record<CategoriaBloqueio, string> = {
  injecao:
    "Não posso alterar minhas regras de funcionamento. Sou o assistente de estudos desta disciplina e respondo apenas com base nos documentos institucionais indexados. Faça sua pergunta sobre o conteúdo, as datas ou os critérios de avaliação.",
  ilicito:
    "Essa pergunta está fora do que este assistente atende. Sou o assistente de estudos da disciplina e respondo apenas sobre o material dela: conteúdo das aulas, datas, critérios de avaliação e regras do contrato didático.",
  "dados-de-terceiros":
    "Não posso informar dados acadêmicos de outras pessoas. Cada aluno acessa apenas os próprios dados, e o acompanhamento de risco é restrito à coordenação pedagógica. Se a dúvida for sobre os seus dados, veja a página Meus dados.",
};

/**
 * Mensagem específica para o caso de automutilação: bloquear e encaminhar é o
 * único desfecho aceitável. Um assistente de permanência estudantil que recebe
 * esse sinal e responde "está fora do meu escopo" falha no que o projeto inteiro
 * diz querer evitar.
 */
const MENSAGEM_APOIO =
  "Não é sobre isso que eu consigo ajudar, mas você não precisa lidar com isso sozinho. O CVV atende de graça, 24 horas por dia, pelo telefone 188, e a coordenação pedagógica e o serviço de apoio ao estudante da instituição também estão disponíveis. Se houver risco imediato, procure atendimento de emergência pelo 192.";

const PADROES_APOIO: ReadonlyArray<RegExp> = [
  /\b(como|melhor forma de|maneira de|quero|vou)\b[^.?!]{0,30}\b(me matar|suicidar|tirar minha vida|me cortar|me machucar|acabar com tudo)\b/,
  /\b(pensando em|penso em|vontade de)\b[^.?!]{0,20}\b(me matar|suicidio|desistir de tudo|sumir)\b/,
];

export function detectarInjecao(pergunta: string): boolean {
  const t = normalizar(pergunta);
  return PADROES_INJECAO.some((p) => p.test(t));
}

export function detectarIlicito(pergunta: string): boolean {
  const t = normalizar(pergunta);
  return PADROES_ILICITO.some((p) => p.test(t));
}

export function detectarPedidoDeApoio(pergunta: string): boolean {
  const t = normalizar(pergunta);
  return PADROES_APOIO.some((p) => p.test(t));
}

export function detectarDadosDeTerceiros(pergunta: string): boolean {
  const t = normalizar(pergunta);
  return PADROES_DADOS_DE_TERCEIROS.some((p) => p.test(t));
}

/**
 * Avalia a pergunta antes de qualquer chamada externa.
 *
 * A ordem importa: o pedido de apoio é verificado primeiro, porque ele também
 * casa com os padrões de conteúdo ilícito e merece uma resposta diferente.
 */
export function avaliarPergunta(pergunta: string): VeredictoPergunta {
  if (detectarPedidoDeApoio(pergunta)) {
    return { permitida: false, categoria: "ilicito", mensagem: MENSAGEM_APOIO };
  }
  if (detectarInjecao(pergunta)) {
    return { permitida: false, categoria: "injecao", mensagem: MENSAGENS.injecao };
  }
  if (detectarIlicito(pergunta)) {
    return { permitida: false, categoria: "ilicito", mensagem: MENSAGENS.ilicito };
  }
  if (detectarDadosDeTerceiros(pergunta)) {
    return {
      permitida: false,
      categoria: "dados-de-terceiros",
      mensagem: MENSAGENS["dados-de-terceiros"],
    };
  }
  return { permitida: true };
}

/**
 * Neutraliza marcadores de protocolo dentro do texto do usuário antes de ele
 * entrar no prompt.
 *
 * Mesmo com a detecção acima, é o cinto de segurança: se um texto contendo
 * `</contexto>` passar, ele poderia encerrar o bloco de contexto e fazer o
 * restante da pergunta parecer instrução do sistema.
 */
export function neutralizarMarcadores(texto: string): string {
  return texto.replace(/[<>]/g, (c) => (c === "<" ? "‹" : "›"));
}
