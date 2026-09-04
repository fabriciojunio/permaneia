// Que versão está no ar.
//
// Existe por causa de uma pergunta que o fluxo de publicação não sabia
// responder: depois de disparar o deploy, quem responde é a versão nova ou a
// antiga? Esperar por HTTP 200 não prova nada, porque a versão antiga continua
// atendendo o tempo inteiro enquanto a nova constrói, e o passo do CI ficaria
// verde em segundos sem ter conferido coisa alguma.
//
// O que prova é uma marca que muda a cada construção. Aqui são duas: o commit
// que gerou o pacote e o instante em que ele foi construído.
//
// Sobre expor isso numa rota pública: o repositório é público, então o
// identificador do commit não conta nada que não esteja no GitHub. O que ficaria
// de fora é o inverso, uma versão de biblioteca ou o host do banco, e nada disso
// aparece aqui.

/** Sete caracteres bastam para achar o commit e não poluem o log. */
function curto(sha: string | undefined): string {
  return sha ? sha.slice(0, 7) : "desconhecido";
}

export type Versao = {
  readonly commit: string;
  readonly ramo: string;
  readonly construidoEm: string;
  readonly ambiente: string;
};

/**
 * A Vercel publica o commit e o ramo no ambiente da função. Fora dela, quem
 * preenche é o build da imagem (ver Dockerfile), e sem ninguém preencher fica
 * "desconhecido", que é o caso de rodar em desenvolvimento.
 */
export function versaoAtual(): Versao {
  return {
    commit: curto(process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_COMMIT),
    ramo: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.APP_RAMO ?? "desconhecido",
    // Definido em next.config.mjs no momento do build, e por isso constante
    // durante toda a vida do pacote publicado. É esta a marca que o fluxo de
    // publicação compara para saber se a versão nova entrou no ar.
    construidoEm: process.env.APP_CONSTRUIDO_EM ?? "desconhecido",
    ambiente: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "desconhecido",
  };
}
