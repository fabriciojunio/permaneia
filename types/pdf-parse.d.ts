// O pacote pdf-parse não publica tipagem. Declaramos apenas a superfície que o
// projeto usa, em vez de instalar @types de terceiro: é uma função só, e assim
// não há uma definição externa para manter atualizada.

declare module "pdf-parse" {
  export type ResultadoPdf = {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  };

  export default function pdfParse(dados: Buffer | Uint8Array): Promise<ResultadoPdf>;
}
