import { describe, expect, it } from "vitest";
import { perguntaAbrangente } from "@/lib/rag/abrangencia";

const ABRANGENTES = [
  "Quais são os temas do semestre?",
  "Quais assuntos a disciplina cobre?",
  "quais conteudos serao dados",
  "Liste o conteúdo das aulas",
  "Listar os tópicos da disciplina",
  "Me dá a lista dos temas",
  "Relacione os assuntos do semestre",
  "Enumere as atividades avaliativas",
  "Todas as aulas da disciplina",
  "todos os temas do curso",
  "Quero todas as datas de entrega",
  "Qual é o conteúdo programático?",
  "qual o conteudo programatico da disciplina",
  "Qual o conteúdo das aulas?",
  "Qual é o conteúdo do semestre?",
  "O que vai ser estudado na disciplina?",
  "O que será visto ao longo do semestre?",
  "o que vamos ver na disciplina",
  "O que vai ser dado nas aulas?",
  "Me mostra o cronograma completo",
  "Quero o cronograma inteiro",
  "cronograma todo da disciplina",
  "Qual é a ementa?",
  "Me dá um resumo do cronograma",
  "Como é a avaliação da disciplina?",
  "Quantas aulas tem a disciplina?",
  "Quantas provas vão ter?",
  "Quantas atividades são no semestre?",
  "Quais matérias entram na disciplina?",
  "Quais tópicos caem?",
];

const PONTUAIS = [
  "Quando é a Prova P1?",
  "Que dia é a P2?",
  "Qual é o limite de faltas da disciplina?",
  "Quanto vale o quiz na nota?",
  "Que conteúdo cai na aula de lógica fuzzy?",
  "Em que aula o professor vai dar lógica fuzzy?",
  "Que horas começa a aula?",
  "Qual é a nota mínima para passar?",
  "Quais são os critérios da Prova P1?",
  "Qual o peso da P3?",
  "Onde entrego o trabalho?",
  "O professor aceita entrega atrasada?",
  "Preciso de quantos pontos na P2?",
  "Qual o percentual mínimo de presença?",
  "Tem prova substitutiva?",
];

describe("perguntaAbrangente", () => {
  it.each(ABRANGENTES)("reconhece %s como pedido de enumeração", (pergunta) => {
    expect(perguntaAbrangente(pergunta)).toBe(true);
  });

  it.each(PONTUAIS)("trata %s como pergunta pontual", (pergunta) => {
    expect(perguntaAbrangente(pergunta)).toBe(false);
  });

  it("é indiferente a caixa alta", () => {
    expect(perguntaAbrangente("QUAIS SÃO OS TEMAS?")).toBe(true);
    expect(perguntaAbrangente("quais são os temas?")).toBe(true);
  });

  it("o marcador pontual vence o abrangente na mesma frase", () => {
    // "Quais" pediria a lista, mas o aluno já disse de qual parte do material
    // está falando, e devolver o cronograma inteiro seria pior do que o trecho.
    expect(perguntaAbrangente("Quais são os critérios da Prova P1?")).toBe(false);
    expect(perguntaAbrangente("Quais temas caem na aula de 24 de setembro?")).toBe(false);
  });

  it("não reage a texto vazio nem a pergunta curta demais", () => {
    expect(perguntaAbrangente("")).toBe(false);
    expect(perguntaAbrangente("oi")).toBe(false);
    expect(perguntaAbrangente("???")).toBe(false);
  });

  it("é função pura e não altera a entrada", () => {
    const pergunta = "Quais são os temas?";
    perguntaAbrangente(pergunta);
    expect(pergunta).toBe("Quais são os temas?");
  });
});
