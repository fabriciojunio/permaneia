// Guarda em disco, para desenvolvimento, para o docker-compose e para os
// testes de integração.
//
// Não serve na Vercel: lá o sistema de arquivos da função é só de leitura, com
// exceção de /tmp, que some entre invocações. Quem escolhe o destino é
// lib/armazenamento/index.ts, e é ele que impede esta implementação de ser
// usada onde ela não funciona.

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArmazenamentoDeDocumentos, DocumentoGuardado } from "./porta";

export class ArmazenamentoEmDisco implements ArmazenamentoDeDocumentos {
  readonly nome = "disco";

  constructor(private readonly raiz: string) {}

  private caminho(chave: string): string {
    const destino = path.resolve(this.raiz, chave);
    // A chave já vem saneada, mas quem chama pode ser código futuro que
    // esqueceu disso. Escrever fora da raiz é grave o bastante para conferir
    // duas vezes, e barato o bastante para não haver desculpa.
    const raiz = path.resolve(this.raiz);
    if (destino !== raiz && !destino.startsWith(raiz + path.sep)) {
      throw new Error(`Chave fora da raiz do armazenamento: ${chave}`);
    }
    return destino;
  }

  async guardar(chave: string, conteudo: Uint8Array, tipo: string): Promise<DocumentoGuardado> {
    const destino = this.caminho(chave);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);
    return { chave, bytes: conteudo.byteLength, tipo };
  }

  async ler(chave: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.caminho(chave)));
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw erro;
    }
  }

  async existe(chave: string): Promise<boolean> {
    try {
      await stat(this.caminho(chave));
      return true;
    } catch {
      return false;
    }
  }

  async remover(chave: string): Promise<void> {
    // `force` para apagar o que não existe não ser erro: quem manda remover
    // quer o arquivo fora, e ele já estar fora é o resultado pedido.
    await rm(this.caminho(chave), { force: true });
  }
}
