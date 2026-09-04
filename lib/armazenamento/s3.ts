// Guarda em armazenamento de objetos compatível com S3.
//
// Vale para a AWS de verdade, para o LocalStack do docker-compose e para
// qualquer serviço que fale o mesmo protocolo. O que muda entre eles é o
// endereço e a forma do caminho, e as duas coisas são configuração.
//
// Sobre credencial: nada é lido daqui a não ser do ambiente. Em execução na
// AWS, a cadeia padrão do SDK pega o papel da instância ou da tarefa, que é o
// caminho certo; chave gravada em variável de ambiente é o caminho de quem
// não tem papel, como o LocalStack, e continua funcionando por tabela.

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ArmazenamentoDeDocumentos, DocumentoGuardado } from "./porta";

export type ConfiguracaoS3 = {
  readonly bucket: string;
  readonly regiao: string;
  /** Endereço alternativo, para LocalStack ou serviço compatível. */
  readonly endereco?: string;
};

/**
 * O erro de "não existe" tem nome diferente conforme o serviço e a operação:
 * `NoSuchKey` na leitura, `NotFound` na conferência, e alguns compatíveis
 * respondem só o 404 sem nome nenhum. Tratar os três é o que faz ausência
 * continuar sendo resposta normal em vez de virar exceção.
 */
function ehAusencia(erro: unknown): boolean {
  const e = erro as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
}

export class ArmazenamentoEmS3 implements ArmazenamentoDeDocumentos {
  readonly nome = "s3";

  private readonly cliente: S3Client;

  constructor(private readonly configuracao: ConfiguracaoS3) {
    this.cliente = new S3Client({
      region: configuracao.regiao,
      ...(configuracao.endereco
        ? {
            endpoint: configuracao.endereco,
            // O LocalStack e a maioria dos compatíveis não resolvem o bucket
            // como subdomínio. Sem isto, o cliente monta um endereço que não
            // existe e o erro que aparece é de DNS, que não ajuda ninguém.
            forcePathStyle: true,
          }
        : {}),
    });
  }

  async guardar(chave: string, conteudo: Uint8Array, tipo: string): Promise<DocumentoGuardado> {
    await this.cliente.send(
      new PutObjectCommand({
        Bucket: this.configuracao.bucket,
        Key: chave,
        Body: conteudo,
        ContentType: tipo,
        // Criptografia em repouso pedida explicitamente: o padrão do bucket
        // pode mudar por fora, e o dado aqui é material de disciplina com nome
        // de quem enviou no caminho.
        ServerSideEncryption: "AES256",
      })
    );
    return { chave, bytes: conteudo.byteLength, tipo };
  }

  async ler(chave: string): Promise<Uint8Array | null> {
    try {
      const resposta = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.configuracao.bucket, Key: chave })
      );
      const corpo = await resposta.Body?.transformToByteArray();
      return corpo ?? null;
    } catch (erro) {
      if (ehAusencia(erro)) return null;
      throw erro;
    }
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await this.cliente.send(new HeadObjectCommand({ Bucket: this.configuracao.bucket, Key: chave }));
      return true;
    } catch (erro) {
      if (ehAusencia(erro)) return false;
      throw erro;
    }
  }

  async remover(chave: string): Promise<void> {
    // Apagar o que não existe já responde sucesso no protocolo, então não há
    // caso de ausência a tratar aqui.
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.configuracao.bucket, Key: chave }));
  }
}
