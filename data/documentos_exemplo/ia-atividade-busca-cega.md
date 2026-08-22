# Atividade de 20 de agosto — Modelagem de Problemas e Algoritmos de Busca Cega

Disciplina: Inteligência Artificial, turma de quinta-feira, período 2026-2
Professor: Patrick Pedreira Silva
Proposta na aula de 20 de agosto de 2026, junto com busca heurística.

## Objetivo

Modelar uma situação-problema como um espaço de estados e aplicar manualmente os algoritmos de Busca em Largura, Busca em Profundidade e Busca de Custo Uniforme.

## Situação-problema: robô de manutenção

Uma empresa utiliza um robô autônomo para realizar manutenções em diferentes setores de sua instalação. O robô inicia sua operação na Base, o local A, e precisa chegar à Sala de Servidores, o local F, para realizar uma manutenção.

Para que a manutenção possa ser concluída, o robô precisa antes passar pelo Almoxarifado, o local D, e retirar um kit de manutenção. O robô pode chegar à Sala de Servidores sem o kit, mas essa situação não representa o objetivo do problema. A missão somente estará concluída quando o robô estiver na Sala de Servidores possuindo o kit.

Locais da instalação: A é a Base; B é a Recepção; C é o Corredor Técnico; D é o Almoxarifado; E é o Elevador; F é a Sala de Servidores.

Deslocamentos e custos. Todas as ligações são bidirecionais. O custo representa uma combinação entre tempo de deslocamento e consumo de energia, então um caminho com menos deslocamentos não é necessariamente o caminho de menor custo. A para B custa 4. A para C custa 1. B para D custa 2. C para D custa 6. C para E custa 2. D para E custa 1. D para F custa 7. E para F custa 3.

Ação especial. Quando estiver no Almoxarifado, o local D, o robô pode executar a ação Retirar kit de manutenção, com custo 1. Depois de retirado, o kit permanece com o robô.

## Parte 1: modelagem do problema

Antes de aplicar qualquer algoritmo, modele formalmente a situação como um problema de busca.

Estados. Determine quais informações precisam ser conhecidas para representar corretamente uma situação do problema. Apenas saber onde o robô está é suficiente? Justifique e defina uma representação para um estado.

Estado inicial. Determine o estado inicial completo do problema.

Estado objetivo. Determine a condição que deverá ser satisfeita para que um estado seja considerado objetivo.

Operadores. Identifique os operadores existentes. Para cada um, indique suas pré-condições, o estado resultante e o custo.

Espaço de estados. Construa o grafo de estados alcançáveis a partir do estado inicial. Cada vértice representa um estado completo, e não apenas uma localização física. As arestas representam os operadores, com seus respectivos custos. Identifique claramente o estado inicial, identifique claramente o estado objetivo, indique o custo de cada transição e não crie novamente um vértice quando o mesmo estado já estiver representado no grafo.

Atenção: o mapa físico da instalação não é, necessariamente, o grafo de estados. A modelagem deve preservar toda informação relevante para decidir se um estado é ou não equivalente a outro.

## Parte 2: Busca em Largura

Aplique manualmente a Busca em Largura sobre o grafo de estados construído. A fronteira começa contendo apenas o estado inicial, o objetivo é testado quando o estado é retirado da fronteira e os sucessores são inseridos no final da fronteira. Quando houver mais de um sucessor, use a ordem alfabética dos rótulos para desempate. Use uma Lista Fechada para evitar expansão repetida de estados. Um estado já presente na fronteira não deve ser inserido novamente.

## Parte 3: Busca em Profundidade

Reinicie o problema e aplique manualmente a Busca em Profundidade. Os sucessores devem ser inseridos no início da fronteira. Quando houver mais de um sucessor, use a ordem alfabética dos rótulos para desempate. Use uma Lista Fechada para evitar expansão repetida de estados. Um estado já presente na fronteira não deve ser inserido novamente.

## Parte 4: Busca de Custo Uniforme

Reinicie o problema e aplique manualmente a Busca de Custo Uniforme. Para cada estado da fronteira, registre o custo acumulado g(n). A fronteira permanece ordenada do menor para o maior valor de g(n). Represente cada entrada no formato Estado[g(n)], por exemplo C0[3]. O objetivo é testado quando o estado é retirado da fronteira. Em caso de empate de custo, use a ordem alfabética dos rótulos. Se um estado ainda presente na fronteira for encontrado por um caminho de custo menor, atualize seu custo e o caminho correspondente. Estados já fechados não devem ser novamente expandidos.

## Parte 5: comparação dos algoritmos

As questões de análise da atividade são as seguintes.

Os três algoritmos encontraram o mesmo caminho? Explique o resultado observado.

Qual algoritmo encontrou uma solução com menor número de ações? Esse resultado era esperado? Justifique.

Qual algoritmo encontrou a solução de menor custo? Explique por que.

Uma solução com menos ações é necessariamente uma solução de menor custo? Use os resultados da atividade para justificar.

Por que a Busca de Custo Uniforme precisa considerar g(n), enquanto a Busca em Largura não utiliza esse valor para escolher o próximo estado?

Se todos os operadores do problema tivessem custo igual a 1, qual seria a relação entre a Busca em Largura e a Busca de Custo Uniforme?

Mostre um exemplo em que dois estados possuam a mesma localização física, mas não representem a mesma situação do problema. Por que isso é importante para a modelagem?
