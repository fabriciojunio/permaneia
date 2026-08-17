// Seed de dados sintéticos e documentos de exemplo.
//
// TODOS os alunos, notas, frequências e acessos deste arquivo são gerados por
// script. Nenhum corresponde a uma pessoa real, e nenhum dado de colega de
// turma foi usado. Essa restrição é da LGPD e está documentada em LGPD.md.
//
// Os documentos indexados, ao contrário, são reais: cronograma, contrato
// didático e enunciado do projeto da disciplina de Inteligência Artificial. São
// documentos públicos, divulgados pelo professor, e usá-los é o que torna a
// demonstração verificável ao vivo: dá para perguntar "quando é a Prova P1" e
// conferir a resposta contra o calendário na hora.
//
// Uso: npm run db:seed

import "../scripts/_carregar-env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { gerarHash } from "../lib/senha";
import { calcularRiscoEvasao } from "../lib/fuzzy/risco";
import { ingerir } from "../lib/rag/ingestao";

const prisma = new PrismaClient();

/**
 * Gerador pseudoaleatório com semente fixa.
 *
 * Determinismo é requisito, e não conveniência: a demonstração precisa mostrar
 * sempre os mesmos alunos nas mesmas posições do painel, e o teste de
 * integração precisa poder afirmar quantos alunos caem em cada faixa. Um
 * Math.random tornaria as duas coisas impossíveis.
 */
function geradorComSemente(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    // Xorshift de 32 bits: curto, sem dependência e suficiente para dado de demonstração.
    estado ^= estado << 13;
    estado >>>= 0;
    estado ^= estado >> 17;
    estado ^= estado << 5;
    estado >>>= 0;
    return estado / 0x100000000;
  };
}

const aleatorio = geradorComSemente(20261119);

function entre(minimo: number, maximo: number, casas = 0): number {
  const valor = minimo + aleatorio() * (maximo - minimo);
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function escolher<T>(lista: readonly T[]): T {
  return lista[Math.floor(aleatorio() * lista.length)]!;
}

const PRENOMES = [
  "Ana", "Bruno", "Camila", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique",
  "Isabela", "João", "Karina", "Lucas", "Mariana", "Nathan", "Olívia", "Pedro",
  "Queila", "Rafael", "Sofia", "Thiago", "Ursula", "Vinícius", "Willian", "Yasmin",
  "Alice", "Caio", "Débora", "Enzo", "Fernanda", "Gustavo",
];

const SOBRENOMES = [
  "Almeida", "Barbosa", "Cardoso", "Duarte", "Esteves", "Ferreira", "Gonçalves",
  "Henriques", "Ibrahim", "Jardim", "Klein", "Lima", "Machado", "Nogueira",
  "Oliveira", "Pacheco", "Quintana", "Ribeiro", "Santana", "Teixeira",
];

const CURSOS = [
  "Ciência da Computação",
  "Sistemas de Informação",
  "Engenharia de Software",
  "Análise e Desenvolvimento de Sistemas",
];

/**
 * Perfis plantados de propósito.
 *
 * São os casos que a apresentação precisa ter à mão. O terceiro é o mais
 * importante do projeto inteiro: nota alta com presença e engajamento em queda,
 * exatamente o aluno que um critério baseado só em média classificaria como
 * tranquilo.
 */
const PERFIS_PLANTADOS = [
  { nome: "Abandono já em curso", frequencia: 18, media: 2.1, acessos: 1 },
  { nome: "Reprovação por nota se aproximando", frequencia: 88, media: 3.2, acessos: 26 },
  { nome: "Notas boas, mas desengajando", frequencia: 34, media: 8.6, acessos: 2 },
  { nome: "Notas boas, presença apertada", frequencia: 62, media: 8.9, acessos: 3 },
  { nome: "Mediano em tudo", frequencia: 68, media: 5.6, acessos: 11 },
  { nome: "Trajetória saudável", frequencia: 96, media: 9.1, acessos: 34 },
] as const;

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

async function limpar(): Promise<void> {
  // A ordem respeita as chaves estrangeiras que não têm cascata declarada.
  await prisma.consultaRag.deleteMany();
  await prisma.registroAuditoria.deleteMany();
  await prisma.documentoChunk.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.matricula.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.aluno.deleteMany();
  await prisma.disciplina.deleteMany();
}

async function main(): Promise<void> {
  console.log("Limpando a base…");
  await limpar();

  console.log("Criando disciplinas…");
  const ia = await prisma.disciplina.create({
    data: {
      nome: "Inteligência Artificial - Quinta-feira",
      professor: "Patrick Pedreira Silva",
      periodo: "2026-2",
    },
  });
  const grafos = await prisma.disciplina.create({
    data: { nome: "Teoria dos Grafos - Terça-feira", professor: "Patrick Pedreira Silva", periodo: "2026-2" },
  });
  const engenharia = await prisma.disciplina.create({
    data: { nome: "Engenharia de Software II", professor: "Corpo docente", periodo: "2026-2" },
  });
  const disciplinas = [ia, grafos, engenharia];

  console.log("Indexando documentos da disciplina de Inteligência Artificial…");
  const documentos = [
    {
      arquivo: "ia-cronograma-2026-2.md",
      titulo: "Cronograma de aulas",
      referencia: "Inteligência Artificial, quinta-feira, 2026-2",
    },
    {
      arquivo: "ia-contrato-didatico-2026-2.md",
      titulo: "Contrato didático",
      referencia: "Inteligência Artificial, quinta-feira, 2026-2",
    },
    {
      arquivo: "ia-projeto-pratico-2026-2.md",
      titulo: "Enunciado do Projeto Prático de IA Generativa",
      referencia: "entrega em 19/11/2026",
    },
  ];

  for (const doc of documentos) {
    const conteudo = readFileSync(resolve(process.cwd(), "data/documentos_exemplo", doc.arquivo), "utf8");
    const resultado = await ingerir({
      disciplinaId: ia.id,
      titulo: doc.titulo,
      referencia: doc.referencia,
      conteudo,
      origem: "seed",
      // Trechos bem menores que o padrão, e isso é uma decisão sobre o formato
      // do documento, não uma configuração arbitrária.
      //
      // O padrão de 2000 caracteres serve a texto corrido, em que o parágrafo
      // vizinho ajuda a entender o assunto. Estes três documentos são listas de
      // fatos independentes: cada aula do cronograma tem sua data e seu
      // conteúdo, e nada do que vem antes ou depois ajuda a respondê-la.
      //
      // Empacotar quatro aulas no mesmo trecho tem um efeito direto e medido:
      // o vetor do trecho passa a representar quatro assuntos ao mesmo tempo, a
      // similaridade com uma pergunta específica despenca, e a pergunta sobre a
      // Prova P1 recupera meio semestre. Com cerca de uma aula por trecho, a
      // similaridade do par relevante mais que dobra. Ver docs/AVALIACAO-RAG.md.
      tamanhoAlvo: 320,
      sobreposicao: 60,
    });
    console.log(`  ${resultado.titulo}: ${resultado.trechos} trecho(s), embeddings do provedor ${resultado.origemEmbedding}`);
  }

  console.log("Gerando alunos sintéticos…");
  const usados = new Set<string>();
  const alunos: Array<{ id: string; nome: string }> = [];

  for (let i = 0; i < 30; i += 1) {
    let nome = `${escolher(PRENOMES)} ${escolher(SOBRENOMES)}`;
    let tentativas = 0;
    while (usados.has(nome) && tentativas < 50) {
      nome = `${escolher(PRENOMES)} ${escolher(SOBRENOMES)} ${escolher(SOBRENOMES)}`;
      tentativas += 1;
    }
    usados.add(nome);

    const aluno = await prisma.aluno.create({
      data: {
        nome,
        // O domínio .exemplo é reservado pela RFC 2606 e nunca será registrado,
        // então nenhum destes endereços pode existir de verdade.
        email: `${semAcento(nome).toLowerCase().replace(/\s+/g, ".")}.${i}@aluno.permaneia.exemplo`,
        curso: escolher(CURSOS),
      },
      select: { id: true, nome: true },
    });
    alunos.push(aluno);
  }

  console.log("Criando matrículas e calculando o risco…");
  const porFaixa: Record<string, number> = { baixo: 0, medio: 0, alto: 0, critico: 0 };
  let criadas = 0;

  for (let i = 0; i < alunos.length; i += 1) {
    const aluno = alunos[i]!;
    // Cada aluno cursa de duas a três disciplinas.
    const quantas = 2 + (i % 2);

    for (let d = 0; d < quantas; d += 1) {
      const disciplina = disciplinas[(i + d) % disciplinas.length]!;

      // Os seis primeiros alunos recebem os perfis plantados na disciplina de
      // Inteligência Artificial, que é a usada na demonstração.
      const plantado = d === 0 && i < PERFIS_PLANTADOS.length && disciplina.id === ia.id
        ? PERFIS_PLANTADOS[i]
        : undefined;

      const sinais = plantado
        ? {
            frequenciaPercentual: plantado.frequencia,
            mediaNotas: plantado.media,
            acessosPlataforma: plantado.acessos,
          }
        : {
            frequenciaPercentual: entre(15, 100, 1),
            mediaNotas: entre(0, 10, 1),
            acessosPlataforma: Math.round(entre(0, 40)),
          };

      const risco = calcularRiscoEvasao(sinais);
      porFaixa[risco.faixa] = (porFaixa[risco.faixa] ?? 0) + 1;

      await prisma.matricula.create({
        data: {
          alunoId: aluno.id,
          disciplinaId: disciplina.id,
          frequenciaPercentual: new Prisma.Decimal(sinais.frequenciaPercentual),
          mediaNotas: new Prisma.Decimal(sinais.mediaNotas),
          acessosPlataforma: sinais.acessosPlataforma,
          scoreRisco: new Prisma.Decimal(risco.score),
          faixaRisco: risco.faixa,
          scoreDetalhes: risco as unknown as Prisma.InputJsonValue,
          calculadoEm: new Date(),
        },
      });
      criadas += 1;
    }
  }

  console.log("Criando contas de acesso…");
  // Senhas da demonstração. São públicas de propósito e a base é sintética;
  // ainda assim passam pela mesma política e pelo mesmo bcrypt de custo 12 de
  // qualquer outra conta, porque um caminho de exceção no hash é exatamente o
  // tipo de atalho que sobrevive até a produção.
  const senhaDemo = await gerarHash("permanencia2026");

  const alunoDemo = alunos[2]!; // O perfil "notas boas, mas desengajando".

  await prisma.usuario.createMany({
    data: [
      {
        nome: "Regina Sartori",
        email: "coordenacao@permaneia.exemplo",
        senhaHash: senhaDemo,
        papel: "coordenacao",
      },
      {
        nome: "Otávio Bettencourt",
        email: "admin@permaneia.exemplo",
        senhaHash: senhaDemo,
        papel: "admin",
      },
    ],
  });

  await prisma.usuario.create({
    data: {
      nome: alunoDemo.nome,
      email: "aluno@permaneia.exemplo",
      senhaHash: senhaDemo,
      papel: "aluno",
      alunoId: alunoDemo.id,
    },
  });

  console.log("\nSeed concluído.");
  console.log(`  Alunos sintéticos: ${alunos.length}`);
  console.log(`  Matrículas: ${criadas}`);
  console.log(`  Distribuição de risco: ${JSON.stringify(porFaixa)}`);
  console.log("\nContas de acesso (senha: permanencia2026)");
  console.log("  coordenacao@permaneia.exemplo  painel de risco");
  console.log("  aluno@permaneia.exemplo        assistente de estudos");
  console.log("  admin@permaneia.exemplo        administração");
}

main()
  .catch((e) => {
    console.error("Seed falhou:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
