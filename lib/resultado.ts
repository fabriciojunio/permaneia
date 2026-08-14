// Tipo Result para erros esperados.
//
// Exceção fica reservada ao que é defeito de programação ou falha de
// infraestrutura. O que é resultado legítimo de uma regra de negócio ("esse
// e-mail já existe", "essa disciplina não existe") volta pelo tipo de retorno,
// onde o compilador obriga quem chama a tratar.

export type Ok<T> = { ok: true; valor: T };
export type Falha<E = ErroApp> = { ok: false; erro: E };
export type Resultado<T, E = ErroApp> = Ok<T> | Falha<E>;

export function ok<T>(valor: T): Ok<T> {
  return { ok: true, valor };
}

export function falha<E = ErroApp>(erro: E): Falha<E> {
  return { ok: false, erro };
}

export type CodigoErro =
  | "NAO_ENCONTRADO"
  | "VALIDACAO"
  | "CONFLITO"
  | "NAO_AUTORIZADO"
  | "PROIBIDO"
  | "LIMITE_EXCEDIDO"
  | "INDISPONIVEL"
  | "INTERNO";

export type ErroApp = {
  codigo: CodigoErro;
  mensagem: string;
  /** Detalhe por campo, para o formulário destacar o erro no lugar certo. */
  campos?: Record<string, string>;
};

export function erro(codigo: CodigoErro, mensagem: string, campos?: Record<string, string>): ErroApp {
  return { codigo, mensagem, ...(campos ? { campos } : {}) };
}

export function statusHttp(codigo: CodigoErro): number {
  switch (codigo) {
    case "NAO_ENCONTRADO":
      return 404;
    case "VALIDACAO":
      return 422;
    case "CONFLITO":
      return 409;
    case "NAO_AUTORIZADO":
      return 401;
    case "PROIBIDO":
      return 403;
    case "LIMITE_EXCEDIDO":
      return 429;
    case "INDISPONIVEL":
      return 503;
    case "INTERNO":
      return 500;
  }
}
