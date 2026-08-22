import { describe, expect, it } from "vitest";
import { escopoDaPergunta } from "@/lib/rag/escopo";
import { perguntaTemporal } from "@/lib/rag/abrangencia";

describe("escopo da resposta fora do material", () => {
  const institucionais = [
    "Como funciona o trancamento de matrícula no Unisagrado?",
    "A faculdade tem biblioteca aberta no fim de semana?",
    "o que é o enade",
    "Como faço para pedir dependência de uma disciplina?",
    "quanto custa a mensalidade",
    "onde vejo minha grade curricular",
    "como funciona o estágio obrigatório",
    "o que é o portal do aluno",
  ];

  for (const pergunta of institucionais) {
    it(`trata como assunto institucional: ${pergunta}`, () => {
      expect(escopoDaPergunta(pergunta)).toBe("instituicao");
    });
  }

  const deConteudo = [
    "O que é uma heurística admissível?",
    "explica busca em largura pra mim",
    "qual a diferença entre KNN e classificador bayesiano",
    "como funciona a lógica fuzzy",
    "o que é um algoritmo genético",
    "o que significa espaço de estados",
    "o que é um grafo",
    "como funciona um modelo de linguagem",
  ];

  for (const pergunta of deConteudo) {
    it(`trata como conteúdo da disciplina: ${pergunta}`, () => {
      expect(escopoDaPergunta(pergunta)).toBe("conteudo");
    });
  }

  const foraDeEscopo = [
    "Quem ganhou a Copa do Mundo de 2022?",
    "Me ensine a fazer um bolo de chocolate",
    "qual o melhor time de futebol",
    "escreva um poema sobre o mar",
    "qual a previsão do tempo para amanhã",
  ];

  for (const pergunta of foraDeEscopo) {
    it(`fica fora de escopo, e a recusa continua: ${pergunta}`, () => {
      expect(escopoDaPergunta(pergunta)).toBeNull();
    });
  }

  it("o conteúdo da disciplina tem precedência sobre o institucional", () => {
    // "Disciplina" casa com o padrão institucional, mas a pergunta é técnica.
    expect(escopoDaPergunta("o que é busca heurística na disciplina")).toBe("conteudo");
  });
});

describe("pergunta temporal", () => {
  const temporais = [
    "Quando é a proxima aula",
    "qual é a próxima aula?",
    "na materia da semana que vem vai ter o que?",
    "o que teve na semana passada",
    "quantos dias faltam para a P1",
    "quanto tempo falta para a prova",
    "tem aula hoje?",
    "tem aula amanhã?",
    "o que vem a seguir no cronograma",
    "qual é a próxima prova",
  ];

  for (const pergunta of temporais) {
    it(`reconhece: ${pergunta}`, () => {
      expect(perguntaTemporal(pergunta)).toBe(true);
    });
  }

  const atemporais = [
    "Quando é a Prova P1?",
    "Qual é o limite de faltas da disciplina?",
    "Quais são os temas de todas as aulas?",
    "Quanto vale o quiz na nota?",
    "Em que aula entra lógica fuzzy?",
  ];

  for (const pergunta of atemporais) {
    it(`não confunde com pergunta de data fixa: ${pergunta}`, () => {
      expect(perguntaTemporal(pergunta)).toBe(false);
    });
  }
});
