// Documentos da turma de Inteligência Artificial de quinta-feira.
//
// A lista mora aqui, e não dentro do seed, porque dois caminhos precisam dela:
// o seed, que monta a base do zero, e scripts/atualizar-acervo.ts, que troca o
// material na base que está no ar sem apagar alunos nem perguntas já feitas.
// Duas listas iguais em dois lugares divergiriam na primeira atualização.

export interface DocumentoDoAcervo {
  arquivo: string;
  titulo: string;
  referencia: string;
}

export const REFERENCIA_QUINTA = "Inteligência Artificial, quinta-feira, 2026-2";

export const DOCUMENTOS_IA_QUINTA: readonly DocumentoDoAcervo[] = [
  { arquivo: "ia-cronograma-2026-2.md", titulo: "Cronograma de aulas", referencia: REFERENCIA_QUINTA },
  { arquivo: "ia-contrato-didatico-2026-2.md", titulo: "Contrato didático", referencia: REFERENCIA_QUINTA },
  {
    arquivo: "ia-projeto-pratico-2026-2.md",
    titulo: "Enunciado do Projeto Prático de IA Generativa",
    referencia: "entrega em 19/11/2026",
  },
  {
    arquivo: "ia-desafio-sistema-inteligente.md",
    titulo: "Desafio: o que torna este sistema inteligente?",
    referencia: "aula de 06/08/2026",
  },
  {
    arquivo: "ia-atividade-llms.md",
    titulo: "Atividade prática: avaliando agentes de conversação",
    referencia: "aula de 13/08/2026",
  },
  {
    arquivo: "ia-atividade-busca-cega.md",
    titulo: "Atividade: modelagem de problemas e busca cega",
    referencia: "aula de 20/08/2026",
  },
  { arquivo: "ia-materiais-por-aula.md", titulo: "Materiais e links por aula", referencia: REFERENCIA_QUINTA },
  { arquivo: "ia-avaliacoes-2026-2.md", titulo: "Avaliações e composição da nota", referencia: REFERENCIA_QUINTA },
  { arquivo: "ia-grupos-2026-2.md", titulo: "Grupos de trabalho", referencia: "portal de disciplinas, 2026-2" },
  {
    arquivo: "ia-resumo-conteudos-p1.md",
    titulo: "Resumo de estudo, parte 1: conteúdos da P1",
    referencia: "resumo do Grupo 1 sobre os temas do cronograma, 2026-2",
  },
  {
    arquivo: "ia-resumo-conteudos-p2.md",
    titulo: "Resumo de estudo, parte 2: conteúdos depois da P1",
    referencia: "resumo do Grupo 1 sobre os temas do cronograma, 2026-2",
  },
];

/**
 * Títulos que já estiveram no acervo e saíram. O script de atualização remove
 * esses documentos da base no ar; sem isso, a versão antiga continuaria
 * respondendo ao lado da nova.
 */
export const TITULOS_RETIRADOS: readonly string[] = ["Resumo de estudo dos conteúdos (Grupo 1)"];

export const DOCUMENTO_INFORMACOES_GERAIS: DocumentoDoAcervo = {
  arquivo: "ia-informacoes-gerais.md",
  titulo: "Informações gerais da disciplina",
  referencia: "portal de disciplinas, 2026-2",
};
