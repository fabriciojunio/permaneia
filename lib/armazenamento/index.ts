// Escolhe onde os documentos originais ficam guardados.
//
// A regra é uma só, e é sobre onde o código está rodando:
//
// - com S3_BUCKET configurado, vai para o armazenamento de objetos;
// - sem ele, vai para o disco;
// - **na Vercel sem S3_BUCKET, não vai para lugar nenhum**, e a chamada falha
//   com uma mensagem que diz o que configurar.
//
// O terceiro caso é o que importa. O sistema de arquivos da função serverless é
// só de leitura, tirando /tmp, que some entre invocações. Cair no disco lá
// daria certo na primeira gravação, daria certo na leitura logo em seguida, e
// perderia o arquivo em algum momento depois, sem erro nenhum. Falhar na hora,
// dizendo o que falta, é melhor que perder documento em silêncio.

import path from "node:path";
import { ArmazenamentoEmDisco } from "./disco";
import { ArmazenamentoEmS3 } from "./s3";
import type { ArmazenamentoDeDocumentos } from "./porta";

export * from "./porta";
export { ArmazenamentoEmDisco } from "./disco";
export { ArmazenamentoEmS3 } from "./s3";

export type AmbienteDeArmazenamento = {
  readonly bucket?: string | undefined;
  readonly regiao?: string | undefined;
  readonly endereco?: string | undefined;
  readonly raizEmDisco?: string | undefined;
  /** Verdadeiro quando o sistema de arquivos não é de escrita, como na Vercel. */
  readonly discoEfemero?: boolean | undefined;
};

export function lerAmbiente(env: NodeJS.ProcessEnv = process.env): AmbienteDeArmazenamento {
  return {
    bucket: env.S3_BUCKET,
    regiao: env.AWS_REGION ?? env.AWS_DEFAULT_REGION,
    // Presente só quando o destino não é a AWS de verdade: LocalStack no
    // compose, ou um serviço compatível.
    endereco: env.S3_ENDERECO,
    raizEmDisco: env.DOCUMENTOS_RAIZ,
    discoEfemero: env.VERCEL === "1",
  };
}

export function escolherArmazenamento(
  ambiente: AmbienteDeArmazenamento = lerAmbiente()
): ArmazenamentoDeDocumentos {
  if (ambiente.bucket) {
    return new ArmazenamentoEmS3({
      bucket: ambiente.bucket,
      // A região do projeto é sa-east-1, e é o padrão aqui porque deixar o SDK
      // procurar sozinho, quando não acha, falha com erro de credencial em vez
      // de erro de região, e a investigação vai para o lado errado.
      regiao: ambiente.regiao ?? "sa-east-1",
      ...(ambiente.endereco ? { endereco: ambiente.endereco } : {}),
    });
  }

  if (ambiente.discoEfemero) {
    throw new Error(
      "Sem S3_BUCKET não há onde guardar o documento original: o sistema de " +
        "arquivos da função é só de leitura e /tmp some entre invocações. " +
        "Configure S3_BUCKET e AWS_REGION, ou use o armazenamento em disco fora da Vercel."
    );
  }

  return new ArmazenamentoEmDisco(ambiente.raizEmDisco ?? path.resolve(process.cwd(), "data", "documentos"));
}

/**
 * Onde o sistema guardaria agora, sem tentar guardar nada.
 *
 * Serve para /api/health responder a pergunta antes de alguém descobrir na
 * primeira ingestão que a configuração estava errada.
 */
export function destinoConfigurado(ambiente: AmbienteDeArmazenamento = lerAmbiente()): string {
  if (ambiente.bucket) return `s3:${ambiente.bucket}`;
  if (ambiente.discoEfemero) return "nao-configurado";
  return "disco";
}
