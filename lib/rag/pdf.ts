// Extração de texto de PDF.
//
// A dependência é carregada por import dinâmico, e não no topo do arquivo, por
// dois motivos concretos: ela é CommonJS e executa trabalho no momento do
// import, o que atrapalha o empacotamento do Next; e ela só é necessária na
// rota de upload, então carregá-la sempre pesaria em toda função serverless que
// por acaso importe algo deste módulo.

export type TextoExtraido = {
  texto: string;
  paginas: number;
};

/** Teto de tamanho do arquivo aceito no upload, em bytes. */
export const TAMANHO_MAXIMO_PDF = 10 * 1024 * 1024;

/** Assinatura de um PDF válido. Confiar no content-type enviado pelo cliente não serve como verificação. */
export function pareceSerPdf(dados: Uint8Array): boolean {
  return (
    dados.length > 4 &&
    dados[0] === 0x25 && // %
    dados[1] === 0x50 && // P
    dados[2] === 0x44 && // D
    dados[3] === 0x46 && // F
    dados[4] === 0x2d //  -
  );
}

export async function extrairTextoDePdf(dados: Buffer): Promise<TextoExtraido> {
  if (dados.byteLength > TAMANHO_MAXIMO_PDF) {
    throw new Error(
      `O arquivo tem ${(dados.byteLength / 1024 / 1024).toFixed(1)} MB e o limite é ${TAMANHO_MAXIMO_PDF / 1024 / 1024} MB.`
    );
  }
  if (!pareceSerPdf(dados)) {
    throw new Error("O arquivo enviado não é um PDF válido.");
  }

  // O pacote não traz tipagem própria; a superfície usada é uma função só.
  const modulo = (await import("pdf-parse")) as unknown as {
    default: (b: Buffer) => Promise<{ text: string; numpages: number }>;
  };
  const analisado = await modulo.default(dados);

  const texto = analisado.text?.trim() ?? "";
  if (texto.length < 50) {
    // PDF de imagem escaneada cai aqui. Sem OCR, indexar não adianta, e é
    // melhor dizer isso do que gravar um documento vazio que nunca responde.
    throw new Error(
      "Não foi possível extrair texto deste PDF. Se ele for um documento escaneado, é preciso passar por OCR antes de enviar."
    );
  }

  return { texto, paginas: analisado.numpages ?? 0 };
}
