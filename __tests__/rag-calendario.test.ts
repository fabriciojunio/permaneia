import { describe, expect, it } from "vitest";
import {
  calendarioDaDisciplina,
  dataUtc,
  diasEntre,
  extrairEventosDoTexto,
  hojeEmBrasilia,
  indiceDoMes,
  porExtenso,
  resumirAgenda,
  segundaDaSemana,
  type TrechoDatado,
} from "@/lib/rag/calendario";

function trecho(texto: string, documentoId = "cronograma"): TrechoDatado {
  return { documentoId, titulo: "Cronograma de aulas", texto };
}

const AULAS = [
  "06 de agosto de 2026, quinta-feira. Aula normal. Apresentação da disciplina e Introdução à IA.",
  "13 de agosto de 2026, quinta-feira. Aula normal. Agentes inteligentes e busca cega.",
  "20 de agosto de 2026, quinta-feira. Aula normal. Busca heurística.",
  "27 de agosto de 2026, quinta-feira. Aula normal. Busca online e busca competitiva.",
  "24 de setembro de 2026, quinta-feira. Avaliação. Prova P1.",
  "19 de novembro de 2026, quinta-feira. Entrega de trabalho. Entrega do Trabalho da Disciplina.",
].map((t) => trecho(t));

/** Sábado, dois dias depois da aula de 20 de agosto. */
const SABADO = dataUtc(2026, 7, 22);

describe("leitura de datas", () => {
  it("reconhece o mês por extenso", () => {
    expect(indiceDoMes("setembro")).toBe(8);
  });

  it("reconhece o mês escrito sem acento", () => {
    expect(indiceDoMes("marco")).toBe(indiceDoMes("março"));
  });

  it("devolve -1 para nome que não é mês", () => {
    expect(indiceDoMes("quinta")).toBe(-1);
  });

  it("extrai a data e a descrição de uma entrada", () => {
    const [evento] = extrairEventosDoTexto(trecho("24 de setembro de 2026, quinta-feira. Avaliação. Prova P1."));
    expect(evento!.data).toEqual(dataUtc(2026, 8, 24));
    expect(evento!.descricao).toBe("Avaliação. Prova P1.");
  });

  it("tira o dia da semana da descrição, porque a data já o tem", () => {
    const [evento] = extrairEventosDoTexto(trecho("06 de agosto de 2026, quinta-feira. Aula normal."));
    expect(evento!.descricao).not.toMatch(/quinta/i);
  });

  it("separa duas entradas que caíram no mesmo parágrafo", () => {
    const eventos = extrairEventosDoTexto(
      trecho(
        "10 de dezembro de 2026, quinta-feira. Avaliação. Prova Substitutiva. 17 de dezembro de 2026, quinta-feira. Avaliação. Exame Final."
      )
    );
    expect(eventos).toHaveLength(2);
    expect(eventos[0]!.descricao).toContain("Substitutiva");
    expect(eventos[1]!.descricao).toContain("Exame Final");
  });

  it("ignora texto sem data", () => {
    expect(extrairEventosDoTexto(trecho("O total de faltas não deve extrapolar os 25%."))).toEqual([]);
  });

  it("ignora dia impossível", () => {
    expect(extrairEventosDoTexto(trecho("40 de agosto de 2026. Aula."))).toEqual([]);
  });
});

describe("escolha do calendário", () => {
  it("devolve os eventos em ordem de data", () => {
    const eventos = calendarioDaDisciplina(AULAS);
    const datas = eventos.map((e) => e.data.getTime());
    expect(datas).toEqual([...datas].sort((a, b) => a - b));
  });

  it("prefere o documento com mais dias distintos", () => {
    const outro = trecho("19 de novembro de 2026. Entrega do trabalho.", "projeto");
    const eventos = calendarioDaDisciplina([...AULAS, outro]);
    expect(eventos.every((e) => e.documentoId === "cronograma")).toBe(true);
  });

  it("não trata uma data solta como calendário", () => {
    expect(calendarioDaDisciplina([trecho("Entrega em 19 de novembro de 2026.", "projeto")])).toEqual([]);
  });

  it("devolve vazio quando não há documento algum", () => {
    expect(calendarioDaDisciplina([])).toEqual([]);
  });
});

describe("aritmética de dias", () => {
  it("conta os dias entre duas datas", () => {
    expect(diasEntre(dataUtc(2026, 7, 22), dataUtc(2026, 7, 27))).toBe(5);
  });

  it("conta para trás com sinal negativo", () => {
    expect(diasEntre(dataUtc(2026, 7, 22), dataUtc(2026, 7, 20))).toBe(-2);
  });

  it("a segunda-feira da semana de um sábado é a segunda anterior", () => {
    expect(segundaDaSemana(dataUtc(2026, 7, 22))).toEqual(dataUtc(2026, 7, 17));
  });

  it("a segunda-feira da semana de um domingo é a segunda anterior, e não a seguinte", () => {
    // O domingo fecha a semana no calendário brasileiro de agenda escolar.
    expect(segundaDaSemana(dataUtc(2026, 7, 23))).toEqual(dataUtc(2026, 7, 17));
  });

  it("escreve a data por extenso em português", () => {
    expect(porExtenso(dataUtc(2026, 8, 24))).toContain("setembro");
    expect(porExtenso(dataUtc(2026, 8, 24))).toContain("2026");
  });

  it("hoje em Brasília não vira o dia por causa do fuso do servidor", () => {
    // 02h UTC do dia 23 ainda é dia 22 em Bauru.
    expect(hojeEmBrasilia(new Date("2026-08-23T02:00:00Z"))).toEqual(dataUtc(2026, 7, 22));
  });
});

describe("resumo da agenda", () => {
  const eventos = calendarioDaDisciplina(AULAS);

  it("devolve nulo sem calendário", () => {
    expect(resumirAgenda([], SABADO)).toBeNull();
  });

  it("diz que dia é hoje", () => {
    expect(resumirAgenda(eventos, SABADO)).toContain("22 de agosto de 2026");
  });

  it("aponta o próximo encontro, e não um qualquer", () => {
    const agenda = resumirAgenda(eventos, SABADO)!;
    expect(agenda).toMatch(/Próximo encontro: quinta-feira, 27 de agosto de 2026/);
  });

  it("conta quantos dias faltam para o próximo encontro", () => {
    expect(resumirAgenda(eventos, SABADO)).toContain("em 5 dias");
  });

  it("aponta o último encontro já realizado", () => {
    const agenda = resumirAgenda(eventos, SABADO)!;
    expect(agenda).toMatch(/Último encontro já realizado: quinta-feira, 20 de agosto de 2026/);
  });

  it("responde a semana que vem com o encontro que cai nela", () => {
    const agenda = resumirAgenda(eventos, SABADO)!;
    expect(agenda).toMatch(/Semana que vem[^\n]*27 de agosto de 2026/);
  });

  it("diz explicitamente quando a semana que vem não tem encontro", () => {
    // Semana de 31 de agosto a 6 de setembro: o cronograma de exemplo não tem
    // aula nela, e "nenhum encontro previsto" é resposta, não é recusa.
    const agenda = resumirAgenda(eventos, dataUtc(2026, 7, 27))!;
    expect(agenda).toMatch(/Semana que vem[^\n]*nenhum encontro previsto/);
  });

  it("aponta a próxima avaliação separadamente da próxima aula", () => {
    const agenda = resumirAgenda(eventos, SABADO)!;
    expect(agenda).toMatch(/Próxima avaliação ou entrega:[^\n]*24 de setembro de 2026/);
  });

  it("no dia do encontro, ele é o próximo e não o último", () => {
    const agenda = resumirAgenda(eventos, dataUtc(2026, 7, 20))!;
    expect(agenda).toMatch(/Próximo encontro: quinta-feira, 20 de agosto de 2026 \(hoje\)/);
  });

  it("avisa quando o semestre acabou, em vez de apontar encontro que não existe", () => {
    const agenda = resumirAgenda(eventos, dataUtc(2026, 11, 30))!;
    expect(agenda).toContain("Não há mais encontros futuros");
  });
});
