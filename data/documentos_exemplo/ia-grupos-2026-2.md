# Grupos de trabalho, Inteligência Artificial, Quinta-feira, 2026-2

Professor: Patrick Pedreira Silva
Fonte: página de grupos de trabalho do portal de disciplinas.

## Divisão da turma

A turma de quinta-feira está dividida em 9 grupos de trabalho para o Projeto Prático de IA Generativa, com 36 alunos no total. Tamanho de cada grupo: Grupo 1 com 6 membros, Grupo 2 com 5, Grupo 3 com 6, Grupo 4 com 3, Grupo 5 com 5, Grupo 6 com 2, Grupo 7 com 5, Grupo 8 com 3 e Grupo 9 com 1 membro.

## Grupo 1 e o projeto PermaneIA

O Grupo 1 tem 6 membros: Camila Pereira Raimundo, Fabrício Júnio Almeida Dias, Ian Felipe Amaral Oliveira Silva, Kauã Limão Nunes, Luan Padilha Miranda e Lucas Massamiti Tsuji.

O projeto do Grupo 1 é o PermaneIA, este sistema. O problema escolhido é a evasão no ensino superior. A solução junta duas técnicas de IA: um assistente de estudos com RAG (geração aumentada por recuperação), que responde sobre a disciplina a partir dos documentos dela e cita a fonte; e um painel de risco de evasão com lógica fuzzy no modelo de Mamdani, com 27 regras, que transforma frequência, desempenho e engajamento num score de 0 a 1 para a coordenação.

No PermaneIA, a IA generativa é o modelo Gemini, do Google: ele gera os vetores (embeddings) usados na busca e redige a resposta final a partir dos trechos recuperados. A busca é híbrida, vetorial mais BM25, fundida por Reciprocal Rank Fusion. A lógica fuzzy é o conteúdo da aula de 29 de outubro aplicado a um problema real, e a busca nos documentos é aplicação direta do conteúdo de busca e de aprendizado de máquina da disciplina.

O exemplo que resume o projeto: um aluno com nota 8,6 e presença de 34% sai como risco alto no fuzzy, porque frequência baixa pesa mesmo com nota boa, enquanto um critério só pela média de notas não daria alerta nenhum. Os alunos do painel são dados simulados.
