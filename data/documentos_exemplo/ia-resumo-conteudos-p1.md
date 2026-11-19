# Resumo de estudo dos conteúdos de Inteligência Artificial, parte 1: até a Prova P1, 2026-2

Resumo de estudo elaborado pelo Grupo 1 a partir dos temas do cronograma da disciplina do professor Patrick Pedreira Silva. Não substitui os slides, os ebooks e as listas do professor; serve para revisar os conceitos de cada aula. Esta parte cobre os temas da P1: introdução à IA, agentes inteligentes, busca cega, busca heurística, busca online, busca competitiva e PSR.

## Introdução à Inteligência Artificial (aula de 06/08)

Inteligência Artificial é a área da computação que constrói sistemas capazes de realizar tarefas que exigiriam inteligência se feitas por pessoas: perceber, raciocinar, aprender, planejar e decidir. As quatro abordagens clássicas de definição são: pensar como humano, agir como humano (o Teste de Turing), pensar racionalmente (lógica) e agir racionalmente (o agente racional, que é a abordagem adotada nos livros-texto atuais).

IA fraca ou estreita resolve uma tarefa específica, como recomendar filmes ou filtrar spam. IA forte ou geral seria uma inteligência de propósito amplo, equivalente à humana, e ainda não existe. Toda IA em uso hoje é estreita, inclusive os modelos de linguagem.

Para dizer se um sistema é inteligente é preciso definir o critério: o que ele percebe, como representa o conhecimento, qual paradigma usa (regras simbólicas, busca, aprendizado a partir de dados, lógica fuzzy) e quais são seus limites. Essa é a pergunta do desafio "O que torna este sistema inteligente?".

## Agentes inteligentes (aula de 13/08)

Um agente é tudo o que percebe o ambiente por meio de sensores e age sobre ele por meio de atuadores. A função do agente mapeia a sequência de percepções em ações. Um agente racional escolhe a ação que maximiza a medida de desempenho esperada, dado o que percebeu e o que sabe.

PEAS é a forma de especificar o problema de um agente: Performance (medida de desempenho), Environment (ambiente), Actuators (atuadores) e Sensors (sensores). Exemplo do aspirador de pó: desempenho é a limpeza e a economia de movimentos; ambiente são as salas A e B com ou sem sujeira; atuadores são mover para a esquerda, para a direita e aspirar; sensores são a posição e a presença de sujeira.

Propriedades do ambiente: completamente ou parcialmente observável; determinístico ou estocástico; episódico ou sequencial; estático ou dinâmico; discreto ou contínuo; um agente ou multiagente. Xadrez é completamente observável, determinístico, sequencial, discreto e multiagente. Dirigir um carro é parcialmente observável, estocástico, dinâmico e contínuo.

Tipos de agente: agente reativo simples (age só pela percepção atual, com regras condição-ação); agente reativo baseado em modelo (mantém um estado interno do mundo); agente baseado em objetivos (escolhe ações que levam a um objetivo); agente baseado em utilidade (escolhe pela utilidade, comparando o quão bom é cada estado); e agente com aprendizado (melhora o próprio desempenho com a experiência).

Modelos de linguagem como ChatGPT, Claude e Gemini podem ser vistos como agentes de conversação: a percepção é o texto do usuário, a ação é o texto gerado. A atividade prática de 13/08 avaliou esses agentes conversando com eles e observando acertos, erros e alucinações.

## Busca como estratégia e busca cega (aula de 13/08)

Formular um problema de busca exige: estado inicial, ações possíveis, modelo de transição (o resultado de cada ação), teste de objetivo e custo de caminho. O conjunto de estados alcançáveis forma o espaço de estados, e a busca constrói uma árvore a partir do estado inicial. A borda (fronteira) guarda os nós ainda não expandidos.

Critérios para comparar estratégias de busca: completude (acha solução se existir?), otimalidade (acha a de menor custo?), complexidade de tempo e complexidade de espaço, medidas pelo fator de ramificação b, pela profundidade da solução mais rasa d e pela profundidade máxima m.

Busca cega, ou busca sem informação, não sabe o quão perto um estado está do objetivo; só distingue estado objetivo de não objetivo. As principais são: busca em largura, busca de custo uniforme, busca em profundidade, busca em profundidade limitada, busca de aprofundamento iterativo e busca bidirecional.

Busca em largura (BFS) expande primeiro os nós mais rasos, usando fila FIFO. É completa e é ótima quando todos os passos têm o mesmo custo. Tempo e memória O(b^d); o problema dela é a memória.

Busca de custo uniforme expande o nó de menor custo de caminho g(n), usando fila de prioridade. É completa e ótima com custos positivos. É o algoritmo de Dijkstra visto como busca.

Busca em profundidade (DFS) expande o nó mais profundo primeiro, usando pilha LIFO. Gasta pouca memória, O(b·m), mas não é ótima e não é completa em espaço infinito ou com ciclos. A busca em profundidade limitada corta num limite l; o aprofundamento iterativo repete a profundidade limitada com l = 0, 1, 2, ... e junta a memória pequena da DFS com a completude e a otimalidade da BFS para custo uniforme.

Diferença entre busca em largura e busca em profundidade: a largura (BFS) usa fila e visita nível por nível, acha a solução mais rasa, é completa e ótima com custos iguais, mas gasta memória O(b^d); a profundidade (DFS) usa pilha e desce por um ramo até o fim antes de voltar, gasta só O(b·m) de memória, mas pode se perder num ramo infinito e não garante a solução mais curta.

Busca bidirecional roda uma busca a partir do início e outra a partir do objetivo, e para quando as duas se encontram; custa O(b^(d/2)) em vez de O(b^d).

## Busca heurística (aula de 20/08)

Busca heurística, ou busca informada, usa uma função heurística h(n) que estima o custo do nó n até o objetivo. Exemplos: distância em linha reta num mapa, distância de Manhattan ou número de peças fora do lugar no quebra-cabeça de 8 peças.

Busca gulosa pela melhor escolha expande o nó com menor h(n). É rápida, mas não é ótima nem completa, porque ignora quanto já custou chegar até ali.

Busca A* (A estrela) expande o nó com menor f(n) = g(n) + h(n), onde g(n) é o custo real do início até n e h(n) é a estimativa até o objetivo. A* é completa e ótima quando a heurística é admissível (nunca superestima o custo real) e, na busca em grafo, consistente (h(n) ≤ custo(n, n') + h(n')).

Quanto mais próxima do custo real for uma heurística admissível, menos nós a A* expande; diz-se que ela domina a outra. Heurísticas podem ser obtidas relaxando o problema, como permitir que a peça do quebra-cabeça se mova para qualquer casa.

Busca local trabalha com um estado só e o melhora, sem guardar caminho. Subida de encosta (hill climbing) vai sempre para o melhor vizinho e pode parar em máximo local, platô ou cume. Têmpera simulada (simulated annealing) aceita pioras com probabilidade que diminui com a temperatura, para escapar de máximos locais.

## Busca online (aula de 27/08)

Na busca offline o agente calcula o plano inteiro antes de agir, porque conhece o ambiente. Na busca online o agente não conhece o mapa: ele intercala ação e percepção, descobre os estados ao chegar neles e precisa decidir com informação parcial. O exemplo da aula é o labirinto misterioso.

Agentes de busca online costumam usar profundidade online (DFS online), que só funciona com ações reversíveis porque o agente precisa voltar fisicamente, e o LRTA* (Learning Real-Time A*), que guarda e atualiza a estimativa de custo H de cada estado visitado e escolhe o vizinho que parece mais barato, aprendendo o ambiente à medida que anda.

A qualidade de um agente online é medida pela razão competitiva: o custo do caminho que ele percorreu dividido pelo custo do caminho ótimo que seria seguido se o ambiente fosse conhecido. Becos sem saída e ações irreversíveis podem tornar essa razão infinita.

## Busca competitiva (aula de 27/08)

Busca competitiva trata jogos com adversário: dois jogadores, soma zero, alternando jogadas. O jogo é modelado por estado inicial, jogador da vez, ações, resultado, teste de término e função de utilidade dos estados finais.

Minimax supõe que o adversário joga de forma ótima. O jogador MAX escolhe a jogada de maior valor e o MIN, a de menor; os valores sobem das folhas até a raiz. É completo em árvore finita e ótimo contra adversário ótimo, mas custa O(b^m).

Poda alfa-beta dá o mesmo resultado do minimax sem visitar ramos que não podem mudar a decisão. Alfa é o melhor valor garantido para MAX até o momento, beta o melhor para MIN; quando alfa ≥ beta, o ramo é podado. Com boa ordenação dos movimentos, o custo cai para cerca de O(b^(m/2)).

Em jogos grandes como xadrez a busca é cortada numa profundidade e as posições são avaliadas por uma função de avaliação heurística, como a soma ponderada do material. Jogos com sorte usam expectiminimax, com nós de acaso que calculam o valor esperado.

## Problemas de satisfação de restrições, PSR (aula de 03/09)

Um PSR é definido por variáveis, domínios (os valores possíveis de cada variável) e restrições (combinações de valores permitidas). A solução é uma atribuição completa e consistente. Exemplos: colorir o mapa da Austrália com três cores sem regiões vizinhas iguais, sudoku, n-rainhas, montagem de grade horária.

Busca com retrocesso (backtracking) atribui uma variável por vez e volta quando uma restrição é violada. As heurísticas que melhoram o backtracking: MRV, mínimos restantes (escolher a variável de domínio menor); grau (escolher a variável envolvida em mais restrições); e menos restritivo primeiro (testar antes a opção que deixa mais escolhas para as variáveis vizinhas).

Verificação adiante (forward checking): logo após cada atribuição, corta do domínio das variáveis vizinhas as opções que ficaram incompatíveis. Consistência de arco (AC-3): garante que toda opção de uma variável tenha alguma opção compatível na variável vizinha, e propaga esses cortes pela rede de restrições.

A atividade integradora de 03/09 pediu reconhecer qual técnica serve para cada problema: busca cega quando não há informação sobre a distância ao objetivo; heurística quando há uma boa estimativa; online quando o ambiente é desconhecido; competitiva quando há adversário; PSR quando o problema é atribuir valores respeitando restrições.

