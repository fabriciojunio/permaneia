// Indexa um documento numa disciplina, pela linha de comando.
//
// Serve para carga inicial e para reindexar depois de trocar de provedor de
// embedding, quando a interface de upload seria trabalho manual demais.
//
// Uso:
//   npx tsx scripts/ingerir-documentos.ts <arquivo> --disciplina "<nome>" \
//        [--titulo "<titulo>"] [--referencia "<data ou versao>"] \
//        [--alvo 320] [--sobreposicao 60]
//
// O arquivo pode ser .pdf, .md ou .txt.

import "./_carregar-env";
import { readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { prisma } from "../lib/prisma";
import { ingerir } from "../lib/rag/ingestao";
import { extrairTextoDePdf } from "../lib/rag/pdf";
import { chaveDoDocumento, escolherArmazenamento, tipoDoArquivo } from "../lib/armazenamento";

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function lerConteudo(caminho: string): Promise<string> {
  if (extname(caminho).toLowerCase() === ".pdf") {
    const extraido = await extrairTextoDePdf(readFileSync(caminho));
    console.log(`PDF lido: ${extraido.paginas} página(s).`);
    return extraido.texto;
  }
  return readFileSync(caminho, "utf8");
}

async function main(): Promise<void> {
  const arquivo = process.argv[2];
  const nomeDisciplina = argumento("disciplina");

  if (!arquivo || arquivo.startsWith("--") || !nomeDisciplina) {
    console.error(
      "Uso: npx tsx scripts/ingerir-documentos.ts <arquivo> --disciplina \"<nome>\" [--titulo T] [--referencia R]"
    );
    process.exitCode = 1;
    return;
  }

  const disciplina = await prisma.disciplina.findFirst({
    where: { nome: { contains: nomeDisciplina, mode: "insensitive" } },
    select: { id: true, nome: true },
  });
  if (!disciplina) {
    console.error(`Disciplina contendo "${nomeDisciplina}" não encontrada.`);
    process.exitCode = 1;
    return;
  }

  const caminho = resolve(process.cwd(), arquivo);
  const original = readFileSync(caminho);
  const conteudo = await lerConteudo(caminho);

  const resultado = await ingerir({
    disciplinaId: disciplina.id,
    titulo: argumento("titulo") ?? basename(caminho, extname(caminho)),
    referencia: argumento("referencia"),
    conteudo,
    origem: "upload",
    tamanhoAlvo: argumento("alvo") ? Number(argumento("alvo")) : undefined,
    sobreposicao: argumento("sobreposicao") ? Number(argumento("sobreposicao")) : undefined,
  });

  // O original vai para o armazenamento DEPOIS da indexação, e não antes: só
  // aqui existe o identificador do documento, e guardar o arquivo de algo que
  // não chegou a ser indexado deixaria lixo órfão a cada tentativa que falha.
  //
  // A falha aqui não desfaz a indexação. O sistema continua respondendo sobre o
  // documento; o que se perde é poder refatiar o material sem ter o arquivo em
  // mãos de novo, e isso não justifica jogar fora um trabalho que já deu certo.
  const armazenamento = escolherArmazenamento();
  const chave = chaveDoDocumento(disciplina.id, resultado.documentoId, basename(caminho));
  let guardadoEm: string | null = null;
  try {
    await armazenamento.guardar(chave, new Uint8Array(original), tipoDoArquivo(caminho));
    guardadoEm = `${armazenamento.nome}:${chave}`;
  } catch (e) {
    console.warn(`  Aviso: o original não foi guardado (${(e as Error).message}).`);
  }

  console.log(`\nIndexado em "${disciplina.nome}":`);
  console.log(`  Título:   ${resultado.titulo}`);
  console.log(`  Trechos:  ${resultado.trechos}`);
  console.log(`  Provedor: ${resultado.origemEmbedding}`);
  if (guardadoEm) console.log(`  Original: ${guardadoEm}`);
  if (resultado.motivoFallback) {
    console.log(`  Atenção:  caiu no provedor local porque ${resultado.motivoFallback}`);
  }

  // Lembrete que evita o pior erro operacional deste sistema: um documento
  // desatualizado responde com autoridade e cita a fonte, e está errado.
  if (!argumento("referencia")) {
    console.log(
      "\n  Aviso: documento indexado SEM referência de data ou versão.\n" +
        "  A citação na resposta não vai permitir ao aluno perceber se o material está velho."
    );
  }
}

main()
  .catch((e) => {
    console.error("Ingestão falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
