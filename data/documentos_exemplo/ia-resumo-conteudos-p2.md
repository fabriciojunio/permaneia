# Resumo de estudo dos conteúdos de Inteligência Artificial, parte 2: depois da Prova P1, 2026-2

Resumo de estudo elaborado pelo Grupo 1 a partir dos temas do cronograma da disciplina do professor Patrick Pedreira Silva. Não substitui os slides, os ebooks e as listas do professor; serve para revisar os conceitos de cada aula. Esta parte cobre os temas dados depois da P1: algoritmos genéticos, aprendizado de máquina, lógica fuzzy e IA generativa.

## Algoritmos genéticos (aula de 01/10)

Algoritmos genéticos são uma técnica de busca e otimização inspirada na evolução natural. Cada solução candidata é um indivíduo, codificado num cromossomo (por exemplo, uma cadeia de bits). Uma população de indivíduos evolui por gerações.

O ciclo de um algoritmo genético: gerar a população inicial; avaliar cada indivíduo pela função de aptidão (fitness); selecionar os pais, com mais chance para os mais aptos (roleta ou torneio); fazer o cruzamento (crossover), que combina partes de dois pais; aplicar mutação, que altera genes com baixa probabilidade para manter a diversidade; e repetir até um critério de parada, como número de gerações ou aptidão suficiente.

Elitismo copia os melhores indivíduos direto para a próxima geração, para não perder a melhor solução. Taxa de mutação alta demais vira busca aleatória; baixa demais causa convergência prematura num ótimo local. Os simuladores de carros, andadores e gatos genéticos do rednuht.org mostram essa evolução ao vivo.

## Aprendizado de máquina e árvores de decisão (aula de 08/10)

Aprendizado de máquina é a área em que o sistema aprende padrões a partir de dados em vez de regras escritas à mão. Aprendizado supervisionado usa exemplos rotulados, para classificação (classe) ou regressão (valor numérico). Aprendizado não supervisionado acha estrutura em dados sem rótulo, como agrupamento e regras de associação. Mineração de dados é o processo de extrair conhecimento útil de bases de dados.

Para avaliar um modelo os dados são separados em treino e teste. Métricas de classificação: acurácia, precisão, revocação (recall) e matriz de confusão. Sobreajuste (overfitting) é o modelo decorar o treino e errar dados novos.

Árvore de decisão classifica fazendo perguntas sobre atributos, do nó raiz até uma folha com a classe. O algoritmo escolhe para cada nó o atributo que mais separa as classes, medido por ganho de informação (redução da entropia, como no ID3 e no C4.5) ou pelo índice de Gini (como no CART). A poda reduz o sobreajuste. A vantagem é a interpretabilidade: as regras podem ser lidas.

A entropia de um conjunto é H = −Σ p·log2(p), onde p é a proporção de cada classe. Conjunto puro tem entropia 0; duas classes meio a meio têm entropia 1. O ganho de informação de um atributo é a entropia antes da divisão menos a média ponderada da entropia dos subconjuntos depois dela.

O Dtree é a ferramenta usada em aula para montar árvores de decisão visualmente, nas atividades Censo em Jogos, Carro autônomo e Classificador de e-mails.

## Classificador linear, K-NN e classificador bayesiano (aula de 15/10)

Classificador linear separa as classes com uma reta (ou hiperplano), calculando uma soma ponderada dos atributos mais um viés e decidindo pelo sinal do resultado. O perceptron é o exemplo clássico. Só resolve bem problemas linearmente separáveis. Regressão linear usa a mesma ideia para prever um valor numérico, ajustando a reta que minimiza o erro quadrático.

K-NN, k vizinhos mais próximos, classifica um exemplo novo pela classe da maioria dos k exemplos de treino mais próximos, geralmente pela distância euclidiana. Não tem fase de treino (é aprendizado preguiçoso). K pequeno é sensível a ruído; K grande suaviza demais. É importante normalizar os atributos, senão o de maior escala domina a distância. Usar K ímpar evita empate entre duas classes.

Classificador bayesiano ingênuo (Naive Bayes) aplica o teorema de Bayes, P(classe | dados) = P(dados | classe) · P(classe) / P(dados), supondo que os atributos são independentes entre si dada a classe. Escolhe a classe com maior probabilidade a posteriori. É rápido e funciona bem em classificação de texto, como filtro de spam. Para não zerar a probabilidade quando um valor nunca apareceu no treino, usa-se a suavização de Laplace.

## Regras de associação e agrupamento (aula de 22/10)

Regras de associação descobrem itens que aparecem juntos, como na análise de cesta de compras: {pão, manteiga} → {leite}. Suporte é a fração de transações que contêm todos os itens da regra. Confiança é, entre as transações com o antecedente, a fração que também tem o consequente. Lift é a confiança dividida pelo suporte do consequente; lift maior que 1 indica associação positiva. O algoritmo Apriori gera os conjuntos frequentes usando a propriedade de que todo subconjunto de um conjunto frequente também é frequente.

Agrupamento (clustering) é aprendizado não supervisionado que junta exemplos parecidos em grupos sem rótulo prévio. O K-Means escolhe k centróides, atribui cada ponto ao centróide mais próximo, recalcula cada centróide como a média dos pontos do grupo e repete até os grupos pararem de mudar. O valor de k é escolhido antes, por exemplo pelo método do cotovelo. O resultado depende dos centróides iniciais.

## Lógica fuzzy (aula de 29/10)

Lógica fuzzy, ou lógica nebulosa, trabalha com graus de pertinência entre 0 e 1, em vez de verdadeiro ou falso. Uma temperatura de 28 graus pode ser 0,6 "quente" e 0,4 "morna" ao mesmo tempo. Foi proposta por Lotfi Zadeh em 1965 e serve para modelar conhecimento vago, como "frequência baixa" ou "nota alta".

Variável linguística é uma variável cujos valores são termos, como frequência com os termos baixa, média e alta. Cada termo tem uma função de pertinência, geralmente triangular ou trapezoidal, que diz o grau de cada valor numérico naquele termo.

Um sistema de inferência fuzzy tem quatro etapas: fuzzificação (transformar a entrada numérica em graus de pertinência); aplicação das regras SE-ENTÃO, com E calculado pelo mínimo e OU pelo máximo; agregação das saídas de todas as regras; e defuzzificação, que transforma o conjunto fuzzy de saída num número, sendo o método do centroide o mais comum.

Defuzzificação é a última etapa do sistema fuzzy: converte o conjunto fuzzy de saída, resultado da agregação das regras, em um único número que pode ser usado na decisão. O método mais usado é o centroide (centro de gravidade da área); outros são a média dos máximos e o bissetor. No PermaneIA a defuzzificação por centroide gera o score de risco de evasão entre 0 e 1.

No modelo de Mamdani a saída de cada regra é um conjunto fuzzy, cortado no grau de ativação da regra; no modelo de Sugeno a saída é uma função ou constante, e a defuzzificação é uma média ponderada. O PermaneIA usa Mamdani com 27 regras (três entradas, cada uma com três termos: 3 × 3 × 3 = 27) e centroide. O Infuzzy e o simulador da corrida são as ferramentas usadas em aula para montar sistemas fuzzy.

## IA generativa e modelos de linguagem (Projeto Prático)

IA generativa cria conteúdo novo, como texto, imagem, código, áudio ou vídeo, a partir de padrões aprendidos. Modelos grandes de linguagem (LLMs), como ChatGPT, Claude e Gemini, são redes neurais do tipo transformer treinadas para prever o próximo token de um texto. Ferramentas citadas no enunciado do projeto: ChatGPT, Claude, Gemini, Veo (vídeo), Cursor (programação), Dify e Flowise (montagem de fluxos e agentes com LLM).

Alucinação é quando o modelo gera uma resposta plausível, mas falsa. RAG, geração aumentada por recuperação, reduz esse risco: antes de responder, o sistema busca trechos relevantes nos documentos, coloca esses trechos no prompt e pede que o modelo responda só a partir deles, citando a fonte. Embeddings são vetores numéricos que representam o significado de um texto; textos de sentido parecido ficam próximos no espaço vetorial.

Engenharia de prompt é escrever as instruções ao modelo de forma clara: papel, contexto, tarefa, formato de saída e exemplos. Limitações das ferramentas generativas: alucinação, conhecimento com data de corte, custo e cota de uso, viés dos dados de treino e privacidade dos dados enviados. Por isso o enunciado exige descrever todo uso de IA no relatório e na apresentação.
