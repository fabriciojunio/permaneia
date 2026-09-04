import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ArmazenamentoEmDisco,
  ArmazenamentoEmS3,
  chaveDoDocumento,
  destinoConfigurado,
  escolherArmazenamento,
  tipoDoArquivo,
} from "@/lib/armazenamento";

describe("chave do documento", () => {
  it("organiza por disciplina, para apagar tudo dela por prefixo", () => {
    expect(chaveDoDocumento("disc1", "doc9", "cronograma.pdf")).toBe(
      "disciplinas/disc1/doc9/cronograma.pdf"
    );
  });

  it("tira o acento do nome, que vira escape em toda listagem", () => {
    expect(chaveDoDocumento("d", "x", "Avaliação Prática.pdf")).toBe(
      "disciplinas/d/x/avaliacao-pratica.pdf"
    );
  });

  it("não deixa o nome enviado escapar da pasta prevista", () => {
    const chave = chaveDoDocumento("d", "x", "../../etc/passwd");
    expect(chave).not.toContain("..");
    expect(chave.startsWith("disciplinas/d/x/")).toBe(true);
  });

  it("troca barra e espaço por hífen, para a chave continuar legível", () => {
    expect(chaveDoDocumento("d", "x", "aula 03/parte 2.md")).toBe("disciplinas/d/x/aula-03-parte-2.md");
  });

  it("dá um nome quando não sobra nada do original", () => {
    expect(chaveDoDocumento("d", "x", "###")).toBe("disciplinas/d/x/sem-nome");
  });
});

describe("tipo do arquivo", () => {
  it.each([
    ["cronograma.pdf", "application/pdf"],
    ["ementa.MD", "text/markdown; charset=utf-8"],
    ["notas.txt", "text/plain; charset=utf-8"],
    ["planilha.xlsx", "application/octet-stream"],
    ["sem-extensao", "application/octet-stream"],
  ])("reconhece %s", (nome, esperado) => {
    expect(tipoDoArquivo(nome)).toBe(esperado);
  });
});

describe("armazenamento em disco", () => {
  let raiz: string;
  let armazenamento: ArmazenamentoEmDisco;

  beforeEach(async () => {
    raiz = await mkdtemp(path.join(tmpdir(), "permaneia-doc-"));
    armazenamento = new ArmazenamentoEmDisco(raiz);
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  it("grava e lê o mesmo conteúdo, byte a byte", async () => {
    const conteudo = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

    const guardado = await armazenamento.guardar("disciplinas/d/x/a.pdf", conteudo, "application/pdf");
    expect(guardado).toEqual({ chave: "disciplinas/d/x/a.pdf", bytes: 5, tipo: "application/pdf" });
    expect(await armazenamento.ler("disciplinas/d/x/a.pdf")).toEqual(conteudo);
  });

  it("cria as pastas do caminho sozinho", async () => {
    await armazenamento.guardar("disciplinas/nova/doc/a.txt", new Uint8Array([1]), "text/plain");
    expect(await readFile(path.join(raiz, "disciplinas", "nova", "doc", "a.txt"))).toHaveLength(1);
  });

  it("devolve nulo para o que não existe, porque ausência é resposta normal", async () => {
    expect(await armazenamento.ler("disciplinas/d/x/nao-existe.pdf")).toBeNull();
    expect(await armazenamento.existe("disciplinas/d/x/nao-existe.pdf")).toBe(false);
  });

  it("remove, e remover de novo não é erro", async () => {
    await armazenamento.guardar("d/x/a.txt", new Uint8Array([1]), "text/plain");
    await armazenamento.remover("d/x/a.txt");

    expect(await armazenamento.existe("d/x/a.txt")).toBe(false);
    await expect(armazenamento.remover("d/x/a.txt")).resolves.toBeUndefined();
  });

  it("recusa chave que sai da raiz, mesmo que alguém a construa à mão", async () => {
    await expect(
      armazenamento.guardar("../fora.txt", new Uint8Array([1]), "text/plain")
    ).rejects.toThrow(/fora da raiz/);
  });
});

describe("escolha do destino", () => {
  it("vai para o S3 quando o bucket está configurado", () => {
    const escolhido = escolherArmazenamento({ bucket: "permaneia-documentos", regiao: "sa-east-1" });
    expect(escolhido).toBeInstanceOf(ArmazenamentoEmS3);
    expect(escolhido.nome).toBe("s3");
  });

  it("vai para o disco fora da Vercel, sem exigir conta na AWS de ninguém", () => {
    const escolhido = escolherArmazenamento({ raizEmDisco: tmpdir() });
    expect(escolhido).toBeInstanceOf(ArmazenamentoEmDisco);
  });

  it("aceita endereço alternativo, que é como o LocalStack entra", () => {
    const escolhido = escolherArmazenamento({
      bucket: "permaneia-documentos",
      endereco: "http://localhost:4566",
    });
    expect(escolhido.nome).toBe("s3");
  });

  it("falha na hora na Vercel sem bucket, em vez de perder o documento depois", () => {
    // O disco da função é só de leitura, tirando /tmp, que some entre
    // invocações: gravar lá daria certo e o arquivo sumiria sem erro nenhum.
    expect(() => escolherArmazenamento({ discoEfemero: true })).toThrow(/S3_BUCKET/);
  });

  it("diz o destino sem tentar gravar, para o health responder antes da primeira ingestão", () => {
    expect(destinoConfigurado({ bucket: "meu-bucket" })).toBe("s3:meu-bucket");
    expect(destinoConfigurado({})).toBe("disco");
    expect(destinoConfigurado({ discoEfemero: true })).toBe("nao-configurado");
  });
});
