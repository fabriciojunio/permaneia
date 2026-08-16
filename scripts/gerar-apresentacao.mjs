// Gera a apresentação da defesa em .pptx.
//
// A apresentação é gerada por script, e não montada à mão, por um motivo
// prático: os números vêm do código e da avaliação, e um slide feito à mão
// desatualiza no primeiro ajuste de calibração. Rodando o script de novo, os
// números continuam batendo com o relatório.
//
// Uso: node scripts/gerar-apresentacao.mjs [arquivo.pptx]

import pptxgen from "pptxgenjs";

// Paleta do produto: painel institucional escuro, verde de permanência.
const FUNDO = "0B1018";
const PAINEL = "141B26";
const BORDA = "2B3849";
const BRANCO = "FFFFFF";
const TEXTO = "E6EAEF";
const SUAVE = "9FADBE";
const FRACO = "71829A";
const VERDE = "22A06E";
const VERDE_CLARO = "45BD8A";
const AMBAR = "D9A015";
const LARANJA = "E2703A";
const VERMELHO = "D0473F";

const FONTE = "Verdana";

const p = new pptxgen();
p.defineLayout({ name: "LARGA", width: 13.333, height: 7.5 });
p.layout = "LARGA";
p.author = "Grupo PermaneIA";
p.company = "Unisagrado";
p.subject = "Projeto Prático de IA Generativa";
p.title = "PermaneIA";

const L = 13.333;
const A = 7.5;

let numero = 0;

function slide(cor = FUNDO) {
  const s = p.addSlide();
  s.background = { color: cor };
  numero += 1;
  return s;
}

function rodape(s) {
  s.addText("PermaneIA · Inteligência Artificial · 2026-2", {
    x: 0.6, y: A - 0.5, w: 8, h: 0.3, fontSize: 9, color: FRACO, fontFace: FONTE,
  });
  s.addText(String(numero), {
    x: L - 1.1, y: A - 0.5, w: 0.5, h: 0.3, fontSize: 9, color: FRACO, align: "right", fontFace: FONTE,
  });
}

function titulo(s, chapeu, texto) {
  if (chapeu) {
    s.addText(chapeu.toUpperCase(), {
      x: 0.7, y: 0.5, w: 11.5, h: 0.3, fontSize: 11, color: VERDE_CLARO,
      charSpacing: 2, bold: true, fontFace: FONTE,
    });
  }
  s.addText(texto, {
    x: 0.7, y: 0.85, w: 12, h: 0.9, fontSize: 28, color: BRANCO, bold: true, fontFace: FONTE,
  });
}

function cartao(s, x, y, l, h = 1.9) {
  s.addShape(p.ShapeType.roundRect, {
    x, y, w: l, h, fill: { color: PAINEL }, line: { color: BORDA, width: 1 }, rectRadius: 0.08,
  });
}

function metrica(s, x, y, l, valor, rotulo, cor = VERDE_CLARO) {
  cartao(s, x, y, l);
  s.addText(valor, {
    x, y: y + 0.22, w: l, h: 0.85, fontSize: 34, color: cor, bold: true, align: "center", fontFace: FONTE,
  });
  s.addText(rotulo, {
    x: x + 0.15, y: y + 1.08, w: l - 0.3, h: 0.7, fontSize: 11, color: SUAVE, align: "center", fontFace: FONTE,
  });
}

function corpo(s, texto, y = 2.0, tamanho = 15) {
  s.addText(texto, {
    x: 0.7, y, w: 11.9, h: 1.4, fontSize: tamanho, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.25,
  });
}

// ---------------------------------------------------------------- SLIDE 1
let s = slide();
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: L, h: 0.14, fill: { color: VERDE } });
s.addText("PermaneIA", {
  x: 0.7, y: 2.3, w: 12, h: 1.1, fontSize: 54, color: BRANCO, bold: true, fontFace: FONTE,
});
s.addText("Assistente de estudo e alerta de risco de evasão", {
  x: 0.7, y: 3.5, w: 11.5, h: 0.5, fontSize: 20, color: VERDE_CLARO, fontFace: FONTE,
});
s.addText("IA generativa com RAG e lógica fuzzy contra a evasão no ensino superior", {
  x: 0.7, y: 4.1, w: 11, h: 0.5, fontSize: 14, color: SUAVE, fontFace: FONTE,
});
s.addText("Camila Pereira Raimundo · Fabrício Júnio Almeida Dias · Kauã Limão Nunes · Luan Padilha Miranda", {
  x: 0.7, y: A - 1.35, w: 12, h: 0.4, fontSize: 13, color: SUAVE, fontFace: FONTE,
});
s.addText("Projeto Prático de IA Generativa · Prof. Patrick Pedreira Silva · 19 de novembro de 2026", {
  x: 0.7, y: A - 0.9, w: 11, h: 0.4, fontSize: 12, color: FRACO, fontFace: FONTE,
});

// ---------------------------------------------------------------- SLIDE 2
s = slide();
titulo(s, "O ponto de partida", "Mais da metade não termina o que começou");
corpo(s, "A evasão no ensino superior brasileiro não é um risco distante: é o desfecho mais provável para boa parte de quem entra. E o abandono não começa quando a nota cai. Começa quando o aluno para de aparecer.");
metrica(s, 0.7, 3.5, 2.8, "57,2%", "de evasão no ensino superior brasileiro", VERMELHO);
metrica(s, 3.75, 3.5, 2.8, "~61%", "na rede privada, 64% no ensino a distância", LARANJA);
metrica(s, 6.8, 3.5, 2.8, "1 em 4", "jovens conclui a graduação que iniciou", AMBAR);
metrica(s, 9.85, 3.5, 2.8, "semanas", "de antecedência entre sumir e a nota cair", VERDE_CLARO);
s.addText("Fontes: Mapa do Ensino Superior 2024 e 2026, Instituto Semesp; OCDE, Education at a Glance 2025.", {
  x: 0.7, y: 5.75, w: 12, h: 0.4, fontSize: 10, color: FRACO, italic: true, fontFace: FONTE,
});
rodape(s);

// ---------------------------------------------------------------- SLIDE 3
s = slide();
titulo(s, "O que o sistema faz", "Duas frentes, duas técnicas de IA");

cartao(s, 0.7, 2.0, 5.8, 3.3);
s.addText("TÉCNICA 1", { x: 1.0, y: 2.25, w: 5, h: 0.3, fontSize: 10, color: FRACO, charSpacing: 1.5, bold: true, fontFace: FONTE });
s.addText("IA generativa com RAG", { x: 1.0, y: 2.6, w: 5.2, h: 0.4, fontSize: 19, color: BRANCO, bold: true, fontFace: FONTE });
s.addText(
  "O aluno pergunta e o sistema busca a resposta nos documentos oficiais da disciplina antes de acionar o modelo.\n\nA resposta cita a fonte. Quando a informação não está no material, o sistema diz que não sabe em vez de inventar uma data de prova.",
  { x: 1.0, y: 3.1, w: 5.2, h: 2.0, fontSize: 12.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.2 }
);

cartao(s, 6.85, 2.0, 5.8, 3.3);
s.addText("TÉCNICA 2", { x: 7.15, y: 2.25, w: 5, h: 0.3, fontSize: 10, color: FRACO, charSpacing: 1.5, bold: true, fontFace: FONTE });
s.addText("Lógica fuzzy", { x: 7.15, y: 2.6, w: 5.2, h: 0.4, fontSize: 19, color: BRANCO, bold: true, fontFace: FONTE });
s.addText(
  "Frequência, desempenho e engajamento entram num sistema Mamdani de 27 regras e saem como um score contínuo de risco.\n\nA coordenação recebe a turma ordenada de quem precisa de contato primeiro, com a explicação de cada score.",
  { x: 7.15, y: 3.1, w: 5.2, h: 2.0, fontSize: 12.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.2 }
);
rodape(s);

// ---------------------------------------------------------------- SLIDE 4
s = slide();
titulo(s, "O caso que justifica o projeto", "O aluno que o critério da secretaria não enxerga");

s.addTable(
  [
    [
      { text: "Perfil", options: { bold: true, color: BRANCO } },
      { text: "Frequência", options: { bold: true, color: BRANCO, align: "center" } },
      { text: "Média", options: { bold: true, color: BRANCO, align: "center" } },
      { text: "Acessos", options: { bold: true, color: BRANCO, align: "center" } },
      { text: "Score fuzzy", options: { bold: true, color: BRANCO, align: "center" } },
      { text: "Critério por nota", options: { bold: true, color: BRANCO, align: "center" } },
    ],
    ["Abandono já em curso", "18%", "2,1", "1", "0,901  crítico", "em risco"],
    [
      { text: "Notas boas, desengajando", options: { color: BRANCO, bold: true } },
      { text: "34%", options: { align: "center", color: BRANCO, bold: true } },
      { text: "8,6", options: { align: "center", color: BRANCO, bold: true } },
      { text: "2", options: { align: "center", color: BRANCO, bold: true } },
      { text: "0,675  alto", options: { align: "center", color: LARANJA, bold: true } },
      { text: "SEM RISCO", options: { align: "center", color: VERMELHO, bold: true } },
    ],
    ["Trajetória saudável", "96%", "9,1", "34", "0,108  baixo", "sem risco"],
  ],
  {
    x: 0.7, y: 2.1, w: 11.9, colW: [3.3, 1.7, 1.4, 1.5, 2.2, 1.8],
    fontSize: 12.5, fontFace: FONTE, color: SUAVE,
    fill: { color: PAINEL }, border: { pt: 1, color: BORDA },
    rowH: 0.55, valign: "middle",
  }
);

s.addText(
  "A linha do meio é o projeto inteiro. Um critério baseado na média de notas classifica esse aluno como tranquilo. O sistema fuzzy o coloca em risco alto, e a regra 8 explica por quê: bom desempenho não anula a ausência sistemática das aulas, o histórico apenas atrasa o efeito na média.",
  { x: 0.7, y: 4.7, w: 11.9, h: 1.2, fontSize: 14, color: TEXTO, fontFace: FONTE, lineSpacingMultiple: 1.25 }
);
rodape(s);

// ---------------------------------------------------------------- SLIDE 5
s = slide();
titulo(s, "Lógica fuzzy", "As quatro etapas do método de Mamdani, escritas do zero");

const etapas = [
  ["1. Fuzzificação", "O valor nítido vira grau de pertinência em cada termo. Frequência de 34% pertence a \"baixa\" com grau 1,0."],
  ["2. Inferência", "Cada regra dispara com força igual ao mínimo dos seus antecedentes, que é a norma T de Mamdani."],
  ["3. Agregação", "O consequente de cada regra é recortado pela força dela, e a união sai pelo máximo."],
  ["4. Defuzzificação", "O centroide da área agregada vira o score de 0 a 1. Leva em conta a área inteira, que é o que produz a gradação."],
];

let y = 2.05;
for (const [nome, texto] of etapas) {
  cartao(s, 0.7, y, 11.9, 1.05);
  s.addText(nome, { x: 1.0, y: y + 0.12, w: 2.9, h: 0.35, fontSize: 14, color: VERDE_CLARO, bold: true, fontFace: FONTE });
  s.addText(texto, { x: 4.0, y: y + 0.14, w: 8.4, h: 0.75, fontSize: 12, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.1 });
  y += 1.2;
}

s.addText("Base fatorial completa: 3 x 3 x 3 = 27 regras. Nenhuma entrada cai num vazio da base.", {
  x: 0.7, y: 6.85, w: 12, h: 0.35, fontSize: 12, color: TEXTO, fontFace: FONTE,
});
rodape(s);

// ---------------------------------------------------------------- SLIDE 6
s = slide();
titulo(s, "RAG", "Três barreiras contra alucinação, e por que precisam ser três");

corpo(s, "Uma instrução de prompt é um pedido, não uma garantia. O modelo pode desobedecer. As barreiras que valem são as que rodam antes e depois dele.");

const barreiras = [
  ["Antes", "Limiar de similaridade", "Contexto irrelevante nunca chega ao modelo. A decisão de admitir ignorância mora no código."],
  ["Durante", "Instrução de sistema", "Obriga a citar a origem e a admitir quando a resposta não está no contexto."],
  ["Depois", "Verificação de citação", "Com a resposta pronta, confere se ela realmente aponta um dos documentos fornecidos."],
];

let x = 0.7;
for (const [quando, nome, texto] of barreiras) {
  cartao(s, x, 3.3, 3.85, 2.4);
  s.addText(quando.toUpperCase(), { x: x + 0.25, y: 3.5, w: 3.3, h: 0.3, fontSize: 10, color: FRACO, charSpacing: 1.5, bold: true, fontFace: FONTE });
  s.addText(nome, { x: x + 0.25, y: 3.82, w: 3.4, h: 0.6, fontSize: 15, color: BRANCO, bold: true, fontFace: FONTE });
  s.addText(texto, { x: x + 0.25, y: 4.5, w: 3.4, h: 1.1, fontSize: 11.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.15 });
  x += 4.05;
}

s.addText("O sistema também funciona sem chave de API: nesse modo ele transcreve o documento em vez de redigir, o que é ainda mais estrito quanto a não inventar.", {
  x: 0.7, y: 6.1, w: 11.9, h: 0.5, fontSize: 12, color: TEXTO, fontFace: FONTE,
});
rodape(s);

// ---------------------------------------------------------------- SLIDE 7
s = slide();
titulo(s, "Visão crítica", "Três defeitos que só a medição revelou");

const defeitos = [
  ["Trigramas afogando o sinal", "Cobertura 0%", "Indexar trigramas de caracteres multiplicava por cinco as unidades. Em 768 dimensões, a colisão dominou: perguntas fora do material pontuavam MAIS que as respondíveis."],
  ["Interrogativos sem IDF", "Recusa arruinada", "\"Quando\", \"qual\", \"como\" casavam com qualquer trecho. Uma pergunta sem resposta no material marcava 0,210; virou 0,069 ao tratá-los como palavras vazias."],
  ["Recorte abaixo da unidade", "Cobertura 44% → 89%", "A resposta escolhia FRASES. \"24 de setembro\" e \"Prova P1\" são frases separadas: o sistema devolvia a confirmação da prova, sem a data."],
];

y = 2.0;
for (const [nome, impacto, texto] of defeitos) {
  cartao(s, 0.7, y, 11.9, 1.5);
  s.addText(nome, { x: 1.0, y: y + 0.15, w: 4.6, h: 0.35, fontSize: 14, color: BRANCO, bold: true, fontFace: FONTE });
  s.addText(impacto, { x: 1.0, y: y + 0.58, w: 4.6, h: 0.35, fontSize: 12, color: LARANJA, bold: true, fontFace: FONTE });
  s.addText(texto, { x: 5.8, y: y + 0.18, w: 6.6, h: 1.1, fontSize: 11.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.15 });
  y += 1.62;
}

s.addText("Nenhum destes seria visível testando à mão com meia dúzia de perguntas. Todos pareciam código correto.", {
  x: 0.7, y: 6.85, w: 12, h: 0.35, fontSize: 12, color: TEXTO, bold: true, fontFace: FONTE,
});
rodape(s);

// ---------------------------------------------------------------- SLIDE 8
s = slide();
titulo(s, "Visão crítica", "O que medimos, e o que não conseguimos resolver");

metrica(s, 0.7, 1.95, 2.8, "83,3%", "das perguntas respondíveis foram respondidas", VERDE_CLARO);
metrica(s, 3.75, 1.95, 2.8, "75,0%", "das perguntas fora do material foram recusadas", VERDE_CLARO);
metrica(s, 6.8, 1.95, 2.8, "0", "inversões de faixa em 26.460 comparações", VERDE_CLARO);
metrica(s, 9.85, 1.95, 2.8, "21/21", "casos da bateria adversarial de barreiras", VERDE_CLARO);

cartao(s, 0.7, 4.2, 11.9, 2.1);
s.addText("O risco que não conseguimos eliminar", {
  x: 1.0, y: 4.4, w: 11, h: 0.4, fontSize: 16, color: BRANCO, bold: true, fontFace: FONTE,
});
s.addText(
  "O maior risco deste sistema não é inventar uma data. É repetir com confiança a data certa de uma ementa do semestre passado. O RAG resolve alucinação, não desatualização.\n\nA mitigação é parcial: todo documento carrega uma referência de data que aparece em toda citação. Uma solução real exigiria integração com o sistema acadêmico.",
  { x: 1.0, y: 4.85, w: 11.3, h: 1.3, fontSize: 12.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.2 }
);
rodape(s);

// ---------------------------------------------------------------- SLIDE 9
s = slide();
titulo(s, "Ferramentas de IA generativa", "O que cada uma resolveu, e onde falhou");

s.addTable(
  [
    [
      { text: "Ferramenta", options: { bold: true, color: BRANCO } },
      { text: "Uso no projeto", options: { bold: true, color: BRANCO } },
      { text: "Limitação observada", options: { bold: true, color: BRANCO } },
    ],
    ["ChatGPT", "Brainstorm de modelagem e critérios", "Sugere estruturas plausíveis, mas genéricas"],
    ["Claude", "Documentação técnica e código", "Escreve mais do que o necessário se não for contido"],
    ["Gemini", "Motor embarcado: texto e embeddings", "Cota da linha flash acaba; versões são aposentadas"],
    ["Grok", "Teste comparativo de respostas", "Sem API gratuita e sem endpoint de embeddings"],
    ["Cursor", "Desenvolvimento do código", "Erra em silêncio no que parece certo"],
    ["Dify", "Protótipo do RAG antes do código", "Não permite controlar o limiar de relevância"],
  ],
  {
    x: 0.7, y: 2.0, w: 11.9, colW: [2.2, 4.6, 5.1],
    fontSize: 12, fontFace: FONTE, color: SUAVE,
    fill: { color: PAINEL }, border: { pt: 1, color: BORDA },
    rowH: 0.52, valign: "middle",
  }
);

s.addText(
  "A limitação do Dify foi o que nos levou ao código próprio: o limiar é o parâmetro que decide entre responder e admitir ignorância, e é o mais importante do sistema para o nosso objetivo.",
  { x: 0.7, y: 5.85, w: 11.9, h: 0.7, fontSize: 12.5, color: TEXTO, fontFace: FONTE, lineSpacingMultiple: 1.2 }
);
rodape(s);

// ---------------------------------------------------------------- SLIDE 10
s = slide();
titulo(s, "Ética", "Sobre o uso de IA neste trabalho");

cartao(s, 0.7, 2.0, 5.8, 3.5);
s.addText("Feito com apoio de IA", { x: 1.0, y: 2.25, w: 5.2, h: 0.4, fontSize: 16, color: VERDE_CLARO, bold: true, fontFace: FONTE });
s.addText(
  "• Boa parte do código: rotas, validações, interface e testes de tabela\n\n• Estruturação da documentação\n\n• Revisão de ortografia e clareza",
  { x: 1.0, y: 2.8, w: 5.2, h: 2.4, fontSize: 12.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.2 }
);

cartao(s, 6.85, 2.0, 5.8, 3.5);
s.addText("Decisão do grupo", { x: 7.15, y: 2.25, w: 5.2, h: 0.4, fontSize: 16, color: VERDE_CLARO, bold: true, fontFace: FONTE });
s.addText(
  "• A arquitetura e os ADRs\n\n• A calibração dos conjuntos e das 27 regras\n\n• Escrever o motor Mamdani do zero\n\n• Não mostrar o score ao aluno\n\n• O conjunto de avaliação e a leitura dos resultados",
  { x: 7.15, y: 2.8, w: 5.2, h: 2.5, fontSize: 12.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.2 }
);

s.addText(
  "Todo número deste trabalho sai de um script executável do repositório. Nenhum foi estimado. Onde não medimos, dissemos que não medimos.",
  { x: 0.7, y: 5.8, w: 11.9, h: 0.7, fontSize: 13, color: TEXTO, bold: true, fontFace: FONTE }
);
rodape(s);

// ---------------------------------------------------------------- SLIDE 11
s = slide();
titulo(s, "Demonstração", "O que vamos mostrar agora, ao vivo");

const demo = [
  ["1", "Painel de risco", "A turma ordenada por score. Abrir o aluno do topo e mostrar as regras que produziram o número e a ação sugerida."],
  ["2", "O caso central", "Simular frequência 34% com média 8,6. Risco alto pelo fuzzy, sem risco pelo critério de nota."],
  ["3", "Assistente respondendo", "\"Quando é a Prova P1?\" Resposta com a data e a fonte citada, conferível contra o cronograma real."],
  ["4", "Assistente recusando", "\"Qual o valor da mensalidade?\" O sistema admite que não sabe."],
];

y = 2.05;
for (const [n, nome, texto] of demo) {
  cartao(s, 0.7, y, 11.9, 1.05);
  s.addText(n, { x: 1.0, y: y + 0.2, w: 0.5, h: 0.6, fontSize: 22, color: VERDE_CLARO, bold: true, fontFace: FONTE });
  s.addText(nome, { x: 1.7, y: y + 0.14, w: 3.2, h: 0.35, fontSize: 14, color: BRANCO, bold: true, fontFace: FONTE });
  s.addText(texto, { x: 4.9, y: y + 0.16, w: 7.5, h: 0.75, fontSize: 11.5, color: SUAVE, fontFace: FONTE, lineSpacingMultiple: 1.1 });
  y += 1.2;
}

s.addText("permaneia.vercel.app", {
  x: 0.7, y: 6.85, w: 12, h: 0.4, fontSize: 15, color: VERDE_CLARO, bold: true, fontFace: FONTE,
});
rodape(s);

// ---------------------------------------------------------------- SLIDE 12
s = slide();
s.addShape(p.ShapeType.rect, { x: 0, y: 0, w: L, h: 0.14, fill: { color: VERDE } });
s.addText("RAG não deixa a IA mais inteligente.", {
  x: 0.7, y: 2.6, w: 12, h: 0.8, fontSize: 34, color: BRANCO, bold: true, fontFace: FONTE,
});
s.addText("Deixa ela mais honesta.", {
  x: 0.7, y: 3.5, w: 12, h: 0.8, fontSize: 34, color: VERDE_CLARO, bold: true, fontFace: FONTE,
});
s.addText("E a lógica fuzzy não prevê o futuro. Ela só recusa a fingir que o risco é uma coisa ou outra.", {
  x: 0.7, y: 4.6, w: 11.5, h: 0.6, fontSize: 15, color: SUAVE, fontFace: FONTE,
});
s.addText("Obrigado. Perguntas?", {
  x: 0.7, y: 5.5, w: 11, h: 0.5, fontSize: 18, color: TEXTO, bold: true, fontFace: FONTE,
});
s.addText("Camila Pereira Raimundo · Fabrício Júnio Almeida Dias · Kauã Limão Nunes · Luan Padilha Miranda", {
  x: 0.7, y: A - 1.35, w: 12, h: 0.4, fontSize: 12.5, color: SUAVE, fontFace: FONTE,
});
s.addText("github.com/fabriciojunio/permaneia · permaneia.vercel.app", {
  x: 0.7, y: A - 0.9, w: 11, h: 0.4, fontSize: 12, color: FRACO, fontFace: FONTE,
});

const arquivo = process.argv[2] ?? "PermaneIA-Apresentacao.pptx";
await p.writeFile({ fileName: arquivo });
console.log(`Apresentação gerada: ${arquivo} (${numero + 2} slides)`);
