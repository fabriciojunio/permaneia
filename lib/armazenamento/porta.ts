// O contrato de guardar o arquivo original de um documento.
//
// ## Por que isto existe
//
// A ingestão extraía o texto do PDF, gravava os trechos com os vetores e
// jogava o arquivo fora. Enquanto o provedor de embedding não muda, ninguém
// sente falta. Quando muda, e mudou, a reindexação só tem o texto já
// fatiado: sobreposição, quebra de página e tabela já viraram o que viraram, e
// refazer com outro tamanho de trecho é impossível sem o original.
//
// Guardar o binário no Postgres foi descartado: o banco da camada gratuita tem
// 500 MB, os PDFs da disciplina passam de 30 MB somados, e é espaço que a
// busca vetorial vai querer.
//
// ## Por que uma porta, e não uma chamada direta ao S3
//
// A publicação de verdade é na Vercel, cujo sistema de arquivos é só de
// leitura; o desenvolvimento é numa máquina com disco; e quem for reproduzir o
// trabalho não deveria precisar de uma conta na AWS para ver o sistema
// funcionando. Três destinos, um contrato.

export type DocumentoGuardado = {
  /** Onde o arquivo ficou, no formato do destino que o guardou. */
  readonly chave: string;
  readonly bytes: number;
  readonly tipo: string;
};

export interface ArmazenamentoDeDocumentos {
  /** O nome do destino, para o log e para /api/health dizerem onde está sendo gravado. */
  readonly nome: string;

  guardar(chave: string, conteudo: Uint8Array, tipo: string): Promise<DocumentoGuardado>;

  /** Nulo quando não existe, e não exceção: ausência é resposta normal aqui. */
  ler(chave: string): Promise<Uint8Array | null>;

  existe(chave: string): Promise<boolean>;

  remover(chave: string): Promise<void>;
}

/** Os tipos que a ingestão sabe ler (ver scripts/ingerir-documentos.ts). */
const TIPOS: Record<string, string> = {
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export function tipoDoArquivo(nome: string): string {
  const ponto = nome.lastIndexOf(".");
  const extensao = ponto === -1 ? "" : nome.slice(ponto).toLowerCase();
  return TIPOS[extensao] ?? "application/octet-stream";
}

/**
 * A chave de um documento: disciplina, identificador e nome saneado.
 *
 * Organizar por disciplina não é enfeite: é o que permite apagar tudo de uma
 * disciplina com um prefixo quando ela sair, que é uma exigência de retenção
 * (ver LGPD.md), em vez de varrer a listagem inteira procurando o que é dela.
 *
 * O nome original entra saneado e no fim, para a chave continuar legível na
 * listagem sem que um nome de arquivo com barra, acento ou espaço vire outro
 * caminho ou um objeto que só dá para acessar com escape.
 */
export function chaveDoDocumento(disciplinaId: string, documentoId: string, nomeOriginal: string): string {
  return `disciplinas/${sanear(disciplinaId)}/${sanear(documentoId)}/${sanear(nomeOriginal)}`;
}

function sanear(texto: string): string {
  // Os escapes, e nunca as marcas combinantes literais: com elas escritas
  // direto, a classe funciona no código-fonte e falha no pacote publicado,
  // defeito que este projeto já teve nas barreiras do assistente.
  const semAcento = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const limpo = semAcento
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    // Ponto-ponto vira caminho para cima em qualquer sistema de arquivos, e é
    // como um nome de arquivo escolhido por quem envia sai da pasta prevista.
    .replace(/\.{2,}/g, ".")
    .replace(/^[-.]+|[-.]+$/g, "");
  return limpo || "sem-nome";
}
