// Avaliação da qualidade do RAG.
//
// Roda um conjunto de perguntas contra o material realmente indexado e mede
// duas coisas que puxam em direções opostas:
//
//   cobertura   entre as perguntas que o material RESPONDE, quantas o sistema
//               respondeu de fato, citando fonte;
//   recusa      entre as perguntas que o material NÃO responde, quantas o
//               sistema recusou em vez de inventar.
//
// As duas juntas são o que mede um RAG. Só a cobertura premia um sistema que
// responde qualquer coisa; só a recusa premia um sistema que nunca responde.
// O limiar de similaridade é o botão que troca uma pela outra, e é por isso que
// este script aceita variá-lo: é assim que o valor em produção foi escolhido.
//
// Uso: npx tsx scripts/avaliar-rag.ts [limiar]

import "./_carregar-env";
import { prisma } from "../lib/prisma";
import { responder } from "../lib/rag/consulta";
import { LIMIAR_RELEVANCIA } from "../lib/rag/similaridade";

type Caso = {
  pergunta: string;
  /** Espera-se que o material responda? */
  respondivel: boolean;
  /** Trecho que precisa aparecer na resposta, quando ela é esperada. */
  esperado?: string;
};

const CASOS: Caso[] = [
  // Respondíveis pelo cronograma.
  { pergunta: "Quando é a Prova P1?", respondivel: true, esperado: "24 de setembro" },
  { pergunta: "Qual a data da Avaliação P2?", respondivel: true, esperado: "26 de novembro" },
  { pergunta: "Quando é a entrega do trabalho da disciplina?", respondivel: true, esperado: "19 de novembro" },
  { pergunta: "Em que aula o professor vai dar lógica fuzzy?", respondivel: true, esperado: "29 de outubro" },
  { pergunta: "Quando é o exame final?", respondivel: true, esperado: "17 de dezembro" },
  { pergunta: "Que dia tem prova substitutiva?", respondivel: true, esperado: "10 de dezembro" },
  { pergunta: "O que cai na aula de 13 de agosto?", respondivel: true, esperado: "busca cega" },
  { pergunta: "Quando começam os conteúdos de aprendizado de máquina?", respondivel: true, esperado: "outubro" },
  { pergunta: "Quantos encontros tem o cronograma da disciplina?", respondivel: true, esperado: "20" },

  // Enumeração. O trecho esperado é sempre o ÚLTIMO item do documento: uma
  // resposta que para na metade acerta o começo e falha aqui, que é exatamente
  // o defeito que a expansão para o documento inteiro corrige.
  { pergunta: "Quais são os temas de todas as aulas da disciplina?", respondivel: true, esperado: "17 de dezembro" },
  { pergunta: "Liste o conteúdo das aulas do semestre", respondivel: true, esperado: "Exame Final" },
  { pergunta: "O que vai ser estudado na disciplina?", respondivel: true, esperado: "dezembro" },
  { pergunta: "Quais são as datas de avaliação?", respondivel: true, esperado: "26 de novembro" },
  { pergunta: "Quais assuntos entram em aprendizado de máquina?", respondivel: true, esperado: "agrupamento" },

  // Respondíveis pelo contrato didático.
  { pergunta: "Qual é o limite de faltas da disciplina?", respondivel: true, esperado: "25" },
  { pergunta: "Quanto vale o quiz na nota?", respondivel: true, esperado: "20" },
  { pergunta: "Tem atividade extra para arredondar a nota?", respondivel: true, esperado: "extra" },
  { pergunta: "Qual é o e-mail do professor?", respondivel: true, esperado: "patrick" },
  { pergunta: "Onde eu vejo o plano de aula?", respondivel: true, esperado: "Connect" },

  // Respondíveis pelo enunciado do projeto.
  { pergunta: "Quantas pessoas podem formar o grupo do projeto?", respondivel: true, esperado: "6" },
  { pergunta: "Quanto tempo deve ter o vídeo tutorial da parte 2?", respondivel: true, esperado: "10" },
  { pergunta: "Que estrutura o relatório do projeto precisa ter?", respondivel: true, esperado: "crítica" },
  { pergunta: "Preciso descrever o uso de IA na escrita do relatório?", respondivel: true, esperado: "descrit" },

  // Perguntas curtas e genéricas, do jeito que aluno digita. Foram elas que
  // expuseram o defeito da recuperação só vetorial: o vetor de "quando vai ser
  // a prova" é pouco discriminante e o trecho da P1 não subia sozinho.
  { pergunta: "quando vai ser a prova", respondivel: true, esperado: "setembro" },
  { pergunta: "tem prova em dezembro?", respondivel: true, esperado: "dezembro" },
  { pergunta: "qual é a próxima aula", respondivel: true, esperado: "de 2026" },

  // Respondíveis pelas atividades propostas em aula.
  { pergunta: "Que ferramenta a atividade sobre LLMs usa?", respondivel: true, esperado: "lmarena" },
  { pergunta: "No problema do robô, o que ele precisa pegar antes?", respondivel: true, esperado: "kit" },
  { pergunta: "Qual é o custo do deslocamento de A para C?", respondivel: true, esperado: "1" },
  { pergunta: "Como desempatar os sucessores na busca em largura?", respondivel: true, esperado: "alfabética" },
  { pergunta: "Quais sistemas posso escolher no desafio da primeira aula?", respondivel: true, esperado: "spam" },
  { pergunta: "Quais são as perspectivas de inteligência do desafio?", respondivel: true, esperado: "racionalmente" },

  // Respondíveis pela lista de materiais e pelas informações gerais.
  { pergunta: "Onde fica o repositório de materiais do professor?", respondivel: true, esperado: "repositorio" },
  { pergunta: "Qual é o site pessoal do professor?", respondivel: true, esperado: "patrickpedreira" },
  { pergunta: "Onde está o simulador do mundo do aspirador de pó?", respondivel: true, esperado: "aspirador" },
  { pergunta: "Onde encontro a Lista 3 de exercícios?", respondivel: true, esperado: "drive.google.com" },
  { pergunta: "Quantas turmas o professor tem neste semestre?", respondivel: true, esperado: "cinco" },

  // NÃO respondíveis: informação que não está em nenhum documento indexado.
  { pergunta: "Qual é a nota mínima para passar direto sem exame?", respondivel: false },
  { pergunta: "Qual a sala e o horário exato da aula?", respondivel: false },
  { pergunta: "Quantos créditos vale a disciplina?", respondivel: false },
  { pergunta: "Qual é o valor da mensalidade do curso?", respondivel: false },
  { pergunta: "Quem é o coordenador do curso de Ciência da Computação?", respondivel: false },
  { pergunta: "Como faço para trancar a matrícula?", respondivel: false },
  { pergunta: "Qual é a bibliografia obrigatória da ementa?", respondivel: false },
  { pergunta: "Qual foi a média da turma na P1 do semestre passado?", respondivel: false },
];

async function main(): Promise<void> {
  // Sem argumento, o limiar NÃO é fixado aqui: cada consulta usa o do provedor
  // que gerou o vetor. Fixar um número só era um defeito desta ferramenta, e
  // dos silenciosos: a bateria rodava o modo generativo com o limiar do modo
  // local (0,15), que deixa passar contexto irrelevante e derruba a recusa para
  // perto de zero. A tabela de calibração continua válida porque foi levantada
  // varrendo o limiar explicitamente, argumento por argumento.
  const argumento = process.argv[2];
  const limiar = argumento === undefined ? undefined : Number(argumento);

  const disciplina = await prisma.disciplina.findFirst({
    where: { nome: { contains: "Inteligência Artificial" } },
    select: { id: true, nome: true },
  });
  if (!disciplina) throw new Error("Disciplina de Inteligência Artificial não encontrada. Rode o seed antes.");

  console.log(`Disciplina: ${disciplina.nome}`);
  console.log(
    `Limiar de relevância: ${limiar ?? `automático por provedor (local ${LIMIAR_RELEVANCIA})`}\n`
  );

  let respondiveisAcertadas = 0;
  let respondiveisTotal = 0;
  let recusasCorretas = 0;
  let naoRespondiveisTotal = 0;
  const falhas: string[] = [];

  // Pausa entre as perguntas.
  //
  // A cota gratuita do provedor é por minuto. Sem a pausa, a bateria dispara
  // quarenta e cinco chamadas seguidas, o provedor recusa da décima em diante e
  // a avaliação mede o modo de degradação em vez do sistema: a cobertura despenca
  // e a culpa parece ser da recuperação.
  const PAUSA_MS = 4_000;
  let respostasDegradadas = 0;

  for (const caso of CASOS) {
    await new Promise((resolve) => setTimeout(resolve, PAUSA_MS));
    const r = await responder({
      disciplinaId: disciplina.id,
      pergunta: caso.pergunta,
      registrar: false,
      limiar,
    });

    if (r.origemIa === "local") respostasDegradadas += 1;

    if (caso.respondivel) {
      respondiveisTotal += 1;
      const contemEsperado = caso.esperado
        ? r.resposta.toLowerCase().includes(caso.esperado.toLowerCase())
        : !r.admitiuNaoSaber;
      const acertou = !r.admitiuNaoSaber && contemEsperado;
      if (acertou) respondiveisAcertadas += 1;
      else falhas.push(`  [cobertura] "${caso.pergunta}" esperava "${caso.esperado}" (sim=${r.similaridadeMaxima})`);
      console.log(
        `${acertou ? "ok  " : "FALHA"} ${caso.pergunta.padEnd(58)} sim=${r.similaridadeMaxima.toFixed(3)} fontes=${r.fontes.length}`
      );
    } else {
      naoRespondiveisTotal += 1;
      const recusou = r.admitiuNaoSaber;
      if (recusou) recusasCorretas += 1;
      else falhas.push(`  [recusa] "${caso.pergunta}" deveria recusar (sim=${r.similaridadeMaxima})`);
      console.log(
        `${recusou ? "ok  " : "FALHA"} ${caso.pergunta.padEnd(58)} sim=${r.similaridadeMaxima.toFixed(3)} recusou=${recusou}`
      );
    }
  }

  const cobertura = (respondiveisAcertadas / respondiveisTotal) * 100;
  const recusa = (recusasCorretas / naoRespondiveisTotal) * 100;

  console.log("\nResultado");
  console.log(`  Cobertura: ${respondiveisAcertadas}/${respondiveisTotal} (${cobertura.toFixed(1)}%)`);
  console.log(`  Recusa correta: ${recusasCorretas}/${naoRespondiveisTotal} (${recusa.toFixed(1)}%)`);

  if (respostasDegradadas > 0) {
    console.log(
      `
  Atenção: ${respostasDegradadas} resposta(s) vieram do modo local. O provedor externo recusou chamadas, provavelmente por limite por minuto, e estes números medem o modo de degradação.`
    );
  }

  if (falhas.length > 0) {
    console.log("\nCasos que falharam:");
    for (const f of falhas) console.log(f);
  }
}

main()
  .catch((e) => {
    console.error("Avaliação falhou:", (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
