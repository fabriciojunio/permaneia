# Roteiro falado da demonstração

Para ler por cima do vídeo `demonstracao/permaneia-demonstracao.mp4`, que tem
**4 minutos e 32 segundos**. O vídeo roda sozinho; ninguém precisa operar o
sistema na frente da turma.

Seis blocos, um por integrante. Os tempos são os do vídeo, e cada texto foi
escrito para caber no bloco com folga, a um ritmo normal de fala. Quem quiser
trocar de bloco com outro pode trocar, é só combinar antes.

Se o vídeo for regravado com `node scripts/gravar-demonstracao.mjs`, os tempos
mudam e o script imprime os novos marcos no final.

| Bloco | Tempo | Quem fala | Assunto |
|---|---|---|---|
| 1 | 00:00 a 00:49 | Camila Pereira Raimundo | O problema e o que o sistema é |
| 2 | 00:49 a 01:39 | Ian Felipe Amaral Oliveira Silva | O painel de risco |
| 3 | 01:39 a 02:17 | Lucas Massamiti Tsuji | As regras fuzzy por trás do número |
| 4 | 02:17 a 03:13 | Kauã Limão Nunes | O assistente respondendo com fonte |
| 5 | 03:13 a 03:53 | Luan Padilha Miranda | Quando a resposta não está no material |
| 6 | 03:53 a 04:32 | Fabrício Júnio Almeida Dias | Privacidade e fechamento |

---

## Bloco 1 — Camila (00:00 a 00:49)

**Na tela:** a página de abertura, com a explicação dos dois lados do sistema.

> A evasão no ensino superior brasileiro é de 57,2%, segundo o Mapa do Ensino
> Superior do Instituto Semesp. Na rede privada passa de 60%, e a OCDE calcula
> que só um em cada quatro jovens conclui a graduação que começou.
>
> A gente escolheu esse problema porque vive ele: somos alunos de uma
> instituição privada.
>
> E a literatura diz uma coisa que organizou o projeto inteiro: o abandono vem
> antes da nota cair. O aluno some da plataforma semanas antes de a média
> baixar. Quem olha só a nota chega tarde.
>
> O PermaneIA tem dois lados. Para o aluno, um assistente que responde só com
> base nos documentos da disciplina. Para a coordenação, um painel de risco
> calculado por lógica fuzzy.

---

## Bloco 2 — Ian Felipe (00:49 a 01:39)

**Na tela:** login da coordenação e o painel de risco carregando.

> Este é o lado da coordenação. A turma aparece ordenada do mais crítico para o
> menos, e em cima fica a distribuição: quinze alunos em risco crítico, catorze
> em alto, trinta e sete em médio e nove em baixo.
>
> Repare nas colunas. Frequência, média e número de acessos à plataforma. E
> repare nesta linha aqui: dezoito por cento de frequência, média 1,4, mas
> dezessete acessos. É um aluno que ainda entra no sistema e mesmo assim está
> em situação crítica.
>
> O risco não é um carimbo de sim ou não: é um score contínuo, de zero a um,
> dividido em quatro faixas. Quatro, e não três, porque a coordenação precisa
> separar "acompanhar" de "procurar hoje". A diferença muda a ação, não só o
> rótulo.

---

## Bloco 3 — Lucas (01:39 a 02:17)

**Na tela:** o detalhamento de um aluno, com a ação sugerida e as regras.

> Clicando na linha, o sistema abre o porquê daquele número. Ele não dá um
> score e manda confiar.
>
> Aqui está a ação sugerida, e abaixo as regras que mais pesaram. Esta, a regra
> três, disparou com força máxima: mesmo acessando bastante a plataforma, quem
> não vem às aulas e não tem nota está em situação crítica.
>
> São vinte e sete regras, no método de Mamdani, escritas do zero. E o
> engajamento entra numa escala logarítmica, porque a diferença entre zero e
> cinco acessos diz muito mais do que entre quarenta e quarenta e cinco.

---

## Bloco 4 — Kauã (02:17 a 03:13)

**Na tela:** login do aluno, o assistente, e a resposta com as fontes abertas.

> Agora o lado do aluno. O assistente responde usando apenas os documentos
> oficiais da disciplina, que estão indexados aqui: oito documentos.
>
> A pergunta é "quando é a Prova P1". A resposta vem com a data e, entre
> colchetes, o documento de onde ela saiu: o cronograma de aulas.
>
> E dá para abrir as fontes. São seis trechos usados, e cada um mostra de onde
> veio e com que similaridade. Repare que alguns foram encontrados por vetor e
> outros por termos: a busca é híbrida, vetorial mais BM25, fundidos por
> Reciprocal Rank Fusion.
>
> Isso não é enfeite. Antes da busca híbrida, "quando é a Prova P1" funcionava e
> "quando vai ser a prova" era recusada. A mesma pergunta, escrita de outro
> jeito, dava respostas diferentes.

---

## Bloco 5 — Luan (03:13 a 03:53)

**Na tela:** a pergunta sobre mensalidade e a resposta marcada como fora do material.

> Agora uma pergunta que o material não responde: o valor da mensalidade.
>
> Olhem o rótulo: "resposta fora do material". Antes de qualquer coisa, o
> assistente avisa que aquilo não está na disciplina, e manda confirmar na
> secretaria. No rodapé ele repete: conhecimento geral do modelo, sem fonte no
> material indexado.
>
> O limiar de similaridade que decide isso é 0,15, e não foi chutado. Medimos
> com trinta e uma perguntas: nesse valor a cobertura fica em 83% e a recusa
> correta sobe de 50 para 75%, sem perder cobertura nenhuma.

---

## Bloco 6 — Fabrício (03:53 a 04:32)

**Na tela:** a página de privacidade e o fechamento.

> Por último, a privacidade. O aluno vê os dados que o sistema tem sobre ele,
> exporta e pede a exclusão, que é o que a LGPD exige.
>
> E os dois lados não se misturam, de propósito: a coordenação não alcança o
> assistente, e o aluno não alcança o painel.
>
> O sistema está no ar em permaneia.vercel.app, com código aberto e dois mil e
> quarenta e um testes.
>
> E o que a gente aprendeu: a lógica fuzzy não prevê o futuro. Ela só se recusa
> a fingir que o risco é uma coisa ou outra.

---

## Antes de apresentar

- [ ] Abrir o `.mp4` uma vez na máquina da sala, para conferir que toca
- [ ] Combinar a ordem de quem fala e deixar este roteiro aberto no celular
- [ ] Deixar `permaneia.vercel.app` aberto numa aba, caso queiram mostrar ao vivo
- [ ] Levar o `.webm` de reserva: alguns projetores engasgam com um formato e
      tocam o outro
