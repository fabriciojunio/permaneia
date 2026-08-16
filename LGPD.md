# Tratamento de dados pessoais

## Aviso principal

**Esta instalação usa exclusivamente dados sintéticos.** Os 30 alunos, as notas,
as frequências e os acessos foram gerados por script com semente fixa
(`prisma/seed.ts`). Nenhum registro corresponde a uma pessoa real, e nenhum dado
de colega de turma foi usado.

Os endereços de e-mail dos alunos sintéticos usam o domínio `.exemplo`,
reservado pela RFC 2606, que nunca será registrado. Nenhum deles pode existir.

Os **documentos indexados são reais**: cronograma, contrato didático e enunciado
do projeto da disciplina de Inteligência Artificial. São documentos públicos,
divulgados pelo professor no portal da disciplina, e não contêm dado pessoal
além do nome e do e-mail institucional do próprio professor, que já são
públicos.

O restante deste documento descreve o tratamento **previsto para um uso real**,
implementado no código para que o sistema possa um dia receber dado verdadeiro.

## Dados tratados

| Categoria | Campos | Finalidade | Base legal prevista |
|---|---|---|---|
| Identificação | nome, e-mail, curso | Identificar o aluno e vinculá-lo às disciplinas | Execução de contrato educacional |
| Acadêmicos | frequência, média, acessos à plataforma | Calcular o risco de evasão | Legítimo interesse da instituição em reduzir evasão |
| Uso do assistente | pergunta, resposta, trechos citados | Avaliar a qualidade do sistema e auditar | Legítimo interesse, com transparência ao titular |
| Conta | hash da senha, papel, último acesso | Autenticação e controle de acesso | Execução de contrato |
| Auditoria | ator, ação, recurso, momento | Demonstrar quem acessou dado pessoal | Cumprimento de obrigação legal |

Não há tratamento de dado sensível na acepção do artigo 5º, inciso II.

## Decisões de projeto que protegem o titular

**O score de risco não é mostrado ao aluno.** É a decisão mais importante deste
documento. Informar a alguém que um sistema o classificou como "risco crítico"
pode produzir justamente o desligamento que o sistema existe para evitar. O
score serve para a coordenação procurar o aluno, e não para rotulá-lo. A tela de
privacidade explica isso ao próprio aluno.

**A senha nunca é armazenada.** Apenas o hash bcrypt.

**O log remove campos sensíveis automaticamente**, em qualquer profundidade.

**Minimização.** O sistema não coleta CPF, matrícula, telefone, endereço nem data
de nascimento. Nada disso é necessário para o que ele faz.

## Direitos do titular (artigo 18)

| Direito | Situação |
|---|---|
| Confirmação e acesso | **Implementado.** `/privacidade` e `GET /api/privacidade/meus-dados` devolvem tudo que o sistema guarda sobre quem pede |
| Portabilidade | **Implementado.** A exportação sai em JSON, formato aberto e legível por máquina |
| Correção | Parcial. A coordenação corrige dado acadêmico; o aluno ainda não corrige sozinho |
| Anonimização e eliminação | Parcial. O modelo tem o campo `anonimizadoEm` e o `Aluno` suporta anonimização preservando a estatística agregada; falta a interface para solicitar |
| Informação sobre compartilhamento | **Implementado por não haver.** Nenhum dado é compartilhado com terceiros |
| Revisão de decisão automatizada | **Implementado.** Todo score traz as regras que o produziram, em linguagem natural, e a coordenação vê essa explicação antes de agir |

O último merece destaque: o artigo 20 dá ao titular o direito de solicitar
revisão de decisão tomada unicamente com base em tratamento automatizado. Este
sistema **nunca decide sozinho**: ele ordena uma lista e explica o porquê. Quem
decide procurar o aluno é uma pessoa, com a explicação à vista.

## Compartilhamento com terceiros

Nenhum dado de aluno é enviado a terceiros.

Ponto que merece atenção numa instalação real: as perguntas feitas ao assistente
**são enviadas à API do Google Gemini** junto com os trechos do documento, quando
a chave está configurada. A pergunta pode conter dado pessoal se o aluno o
escrever. Duas mitigações previstas e ainda não implementadas:

1. anonimizar a pergunta antes do envio, como já é feito em outro projeto do
   grupo;
2. oferecer à instituição o modo de leitura direta, que **não faz chamada
   externa nenhuma** e já está implementado como modo de degradação.

O modo local existente resolve o problema por inteiro para quem não quiser
enviar nada para fora.

## Retenção

| Dado | Prazo |
|---|---|
| Registros de auditoria | 365 dias, configurável em `RETENCAO_AUDITORIA_DIAS`, mínimo de 30 |
| Consultas ao assistente | Enquanto o vínculo do aluno existir |
| Dados acadêmicos | Enquanto a matrícula existir |

O expurgo da auditoria está implementado (`lib/auditoria.ts`, função `expurgar`).

## Segurança

Ver [SECURITY.md](SECURITY.md). Em resumo: papel de banco com privilégio mínimo,
Row Level Security em todas as tabelas, senha com bcrypt, sessão revogável,
anti-CSRF, limitação de taxa e trilha de auditoria.

## Incidentes

Numa instalação real, a instituição precisaria designar um encarregado (DPO) e
comunicar a ANPD e os titulares em prazo razoável diante de incidente com risco
relevante. A trilha de auditoria existe para tornar possível reconstruir quem
acessou o quê.

Como esta instalação é sintética, não há incidente possível com dado pessoal de
aluno.

## Trabalhos futuros

1. Interface para o aluno solicitar correção e eliminação
2. Anonimização da pergunta antes do envio ao provedor externo
3. Registro de consentimento com versionamento do texto aceito
4. Configuração, por instituição, para operar exclusivamente em modo local
