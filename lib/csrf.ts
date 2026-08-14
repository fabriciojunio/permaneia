// Defesa contra CSRF por verificação de origem.
//
// O cookie de sessão é SameSite=Lax, o que já bloqueia o envio em requisição
// cruzada de método não seguro. Esta camada é a segunda linha: navegador antigo,
// extensão que reescreve o cabeçalho, ou um futuro em que alguém precise
// afrouxar o SameSite. Custa uma comparação de string por requisição.

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

export type VeredictoCsrf = {
  permitido: boolean;
  motivo?: string;
  status: number;
};

/** Extrai o host de uma URL de Origin ou Referer, ignorando porta e esquema. */
export function hostDe(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Decide se a requisição pode prosseguir.
 *
 * Só vale para escrita na API. Navegação de página é GET e não altera estado;
 * exigir Origin nela quebraria o acesso por link direto sem ganho de segurança.
 */
export function validarOrigem(
  metodo: string,
  ehApi: boolean,
  origin: string | null,
  referer: string | null,
  host: string | null
): VeredictoCsrf {
  if (METODOS_SEGUROS.has(metodo.toUpperCase())) return { permitido: true, status: 200 };
  if (!ehApi) return { permitido: true, status: 200 };

  if (!host) {
    return { permitido: false, motivo: "Host da requisição ausente.", status: 400 };
  }

  const origemDeclarada = hostDe(origin) ?? hostDe(referer);
  if (!origemDeclarada) {
    // Nenhum navegador envia escrita sem Origin nem Referer. Requisição assim
    // vem de cliente automatizado, e a API não é feita para consumo externo.
    return { permitido: false, motivo: "Origem da requisição não identificada.", status: 403 };
  }

  if (origemDeclarada !== host) {
    return { permitido: false, motivo: "Origem da requisição não confere com o destino.", status: 403 };
  }

  return { permitido: true, status: 200 };
}
