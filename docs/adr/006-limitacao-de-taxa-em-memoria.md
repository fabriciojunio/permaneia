# ADR 006: Limitação de taxa em memória, por instância

**Situação:** aceita, com limitação declarada

## Contexto

O sistema precisa de limitação de taxa para conter tentativa de adivinhação de
senha no login e para conter o consumo da cota do tier gratuito do Gemini.

Um limite global exato exigiria armazenamento compartilhado, como Redis, que
custa dinheiro. O projeto não tem orçamento.

## Decisão

Limitação por janela deslizante, em memória do processo, com limites diferentes
por finalidade: login, cadastro, ingestão de documento, consulta ao assistente e
escrita comum.

## Justificativa

Em ambiente serverless cada instância tem a própria memória, então **este não é
um limite global exato**. Ele resolve o que precisa resolver: conter um laço
acidental, frear tentativa ingênua de adivinhação de senha e evitar que a cota
diária evapore em minutos.

Declarar a limitação é parte da decisão. Um limitador que se apresenta como
garantia e não é seria pior do que nenhum.

## Consequências

**Contra.** Um atacante distribuído contorna o limite. Aceito no escopo de um
trabalho acadêmico com base sintética.

**Configurável por um motivo concreto.** O limite de login virou variável de
ambiente porque, numa instituição, uma sala inteira sai pelo mesmo endereço IP.
Cinco tentativas por minuto protegem contra adivinhação vinda de uma máquina e
derrubam uma turma de trinta alunos entrando ao mesmo tempo do laboratório. Quem
opera a instalação conhece a topologia da rede; o código, não.

**O limite do assistente é por usuário, e não por endereço**, exatamente pelo
mesmo motivo: um limite por IP derrubaria a demonstração ao vivo com a turma
inteira na mesma rede.

**Confiança no proxy é configurável.** Atrás da Vercel, `x-forwarded-for` é
confiável porque a plataforma o reescreve. Em auto-hospedagem sem proxy, o
cabeçalho é controlado pelo cliente, e confiar nele daria a qualquer um um limite
infinito bastando variar o valor.
