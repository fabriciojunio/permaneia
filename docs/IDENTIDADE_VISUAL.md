# Identidade visual

Documento de referência para quem for mexer nas telas. Nada aqui é gosto: cada
escolha responde a alguma coisa do problema.

## A ideia

**Documento acadêmico impresso.** Papel levemente creme, tinta quase preta,
réguas finas separando blocos, um vermelho institucional usado com parcimônia.
A tela parece uma folha da secretaria, não um painel de startup.

A razão é o público. O painel de risco vai ser lido por quem trabalha com
matrícula, ata e diário de classe, e a linguagem visual desse trabalho é o
documento. Uma interface de aplicativo de banco, com cartões flutuantes e
gradiente colorido, comunicaria "isto é um produto" quando o que se quer
comunicar é "isto é um registro".

## A paleta

Os vermelhos vêm do manual da marca do UNISAGRADO (CMYK 15/100/90/10,
0/90/85/0 e 0/80/95/0), convertidos para tela com a saturação reduzida. Ficam
mais escuros que no impresso de propósito: o vermelho puro numa tela iluminada
vibra e cansa a leitura de uma tabela com trinta linhas.

**Nenhum ativo da marca é usado. Só a paleta.** Não há logotipo, brasão nem
tipografia oficial da instituição no sistema, e isso é deliberado: um trabalho
de aluno não fala em nome da faculdade.

| Família | Papel |
|---|---|
| `papel` | Fundos. O creme, e não o branco puro, que estoura o contraste na leitura longa |
| `tinta` | Texto, em cinco pesos, do título ao rodapé |
| `regua` | As linhas que separam blocos, no lugar de sombra e borda arredondada |
| `sagrado` | O vermelho institucional, para ação primária e destaque |
| `risco` | A única escala além do vermelho, para as quatro faixas de risco |

## A cor nunca é o único canal

A etiqueta de risco **sempre traz o texto junto**: "alto", "crítico". Ninguém
precisa distinguir laranja de vermelho para ler o painel, o que importa porque
a deficiência de visão de cores mais comum é exatamente essa, e porque a tabela
costuma ser impressa em preto e branco antes da reunião.

A mesma regra vale para o resto: o braço de busca que encontrou um trecho vem
escrito, o modo de degradação vem escrito, o estado de um documento vem escrito.

## Tipografia

Três famílias, cada uma com um trabalho:

- **display**, com serifa robusta, para título e carimbo. É o que dá o ar de
  documento.
- **sans** para o corpo, porque tabela e formulário se leem melhor sem serifa
  em tela.
- **mono** para número, identificador e trecho citado, onde o alinhamento
  vertical dos dígitos importa.

O espaçamento `carimbo`, bem aberto, é reservado a rótulo em caixa alta, que é
o elemento mais "documento" do conjunto.

## Diagramação

Grade com marginália, não coluna única centralizada. O conteúdo principal fica
numa coluna larga e as notas, fontes e explicações ficam na margem, como num
documento anotado. Foi uma troca deliberada: a coluna única centralizada é o
padrão de qualquer página gerada, e não dizia nada sobre este sistema.

Toda página fecha na altura da janela, com o rodapé encostado embaixo. Página
que termina no meio da tela, com um vão branco embaixo, parece quebrada.

## Celular

Não é adaptação, é requisito: o aluno abre o assistente no celular, na aula.

- Alvo de toque de 44 pixels no mínimo.
- No formulário, o campo vem antes do texto que explica a tela: quem abre no
  celular quer preencher, não ler.
- Na tabela do painel, o celular mostra aluno e risco, e o resto sai. Tabela de
  seis colunas em 390 pixels de largura não é tabela, é rolagem horizontal.
- Há teste de ponta a ponta em 390 por 844, que é o que impede isso de
  apodrecer.

## O que evitar

- Sombra grande e canto muito arredondado. Aqui o que separa blocos é a régua.
- Gradiente. Nenhum.
- Cor como único portador de informação.
- Ícone sozinho, sem rótulo, em ação destrutiva.
- Vermelho institucional em área grande: ele é acento, não fundo.
