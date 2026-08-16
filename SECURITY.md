# Segurança

Postura de segurança do PermaneIA. É um trabalho acadêmico, mas trata dado
acadêmico de aluno e foi construído como se fosse receber dado real um dia.

## Autenticação e sessão

- Sessão em **JWT assinado com HS256**, em cookie `HttpOnly`, `SameSite=Lax`,
  com validade de 8 horas
- O atributo `Secure` acompanha o **protocolo real da requisição**, lido do
  `x-forwarded-proto`, e não o `NODE_ENV`. Um cookie `Secure` é descartado em
  silêncio pelo navegador em conexão http, o que fazia o build de produção
  servido localmente aceitar o login e perder a sessão logo depois
- **Versão de sessão** (`vs`) no token, comparada com a gravada no usuário:
  trocar a senha ou desativar a conta invalida na hora todos os tokens emitidos
  antes, resolvendo a fraqueza clássica do JWT quanto a revogação
- Senha com **bcrypt de custo 12**
- Comparação de senha executada **mesmo quando o usuário não existe**, contra um
  hash descartável, para que a diferença de tempo não revele quais e-mails estão
  cadastrados
- Mensagem de erro **idêntica** para usuário inexistente e senha errada

## Cadastro

- O **papel nunca vem do formulário**. Toda conta criada pelo cadastro público é
  de aluno. Coordenação e administração são criadas por quem já é administrador,
  porque o painel expõe dado de toda a instituição
- E-mail já cadastrado recebe **a mesma resposta** que um cadastro novo, sem
  cookie: um erro "esse e-mail já existe" transformaria o cadastro num oráculo
- Política de senha que prioriza comprimento sobre variedade de símbolo, com
  bloqueio de senhas óbvias, sequências previsíveis e senha contendo o próprio
  usuário do e-mail
- Restrição opcional por domínio institucional (`DOMINIOS_CADASTRO`)

## Autorização

Três papéis, com a matriz de permissões em um único lugar (`lib/acesso.ts`),
aplicada em duas camadas:

- **Middleware**: defesa de borda, impede que a página sequer renderize
- **Cada rota de API**: a defesa que de fato conta

Um aluno nunca vê o painel de risco nem o próprio score. É decisão de projeto:
informar a alguém que um sistema o classificou como risco crítico pode produzir
justamente o desligamento que se quer evitar.

## Proteção da API

- **Anti-CSRF por verificação de origem**, além do `SameSite`. Escrita na API
  exige `Origin` ou `Referer` do mesmo host
- Rejeição do cabeçalho `x-middleware-subrequest` (CVE-2025-29927): nenhum
  cliente legítimo o envia, e recusá-lo elimina a classe de ataque
- **Limitação de taxa** em login, cadastro, ingestão de documento e consultas ao
  assistente, com limites diferentes por finalidade
- Validação de toda entrada com Zod antes de tocar banco ou API externa
- Teto de tamanho em pergunta, documento e upload

## Banco de dados

- **Papel de aplicação dedicado** (`permaneia_app`), com privilégio mínimo:
  apenas DML sobre as tabelas do domínio, sem DDL e sem acesso a outros schemas.
  A aplicação não usa o papel administrativo do projeto
- **Row Level Security ligada em todas as tabelas**, com política explícita
  apenas para o papel da aplicação. Isso fecha o acesso pela API REST do
  Supabase: os papéis `anon` e `authenticated` ficam sem nenhuma política e,
  portanto, sem nenhuma linha visível, mesmo que a chave pública do projeto vaze
- `GRANT` revogado de `anon` e `authenticated`, como defesa em profundidade
- Busca vetorial por **SQL parametrizado**, nunca por interpolação de string

## Cabeçalhos HTTP

Definidos em `next.config.mjs`, que é a fonte canônica:

| Cabeçalho | Valor |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | câmera, microfone, geolocalização e pagamento desligados |
| `Cross-Origin-Opener-Policy` | `same-origin` |

Respostas de API levam `Cache-Control: no-store`.

O navegador **nunca fala com a API do Gemini**: quem chama é o servidor, e a
chave não sai dele. Por isso `connect-src` fica em `'self'`.

## Exposição

- Sem source map de produção
- `console` removido do build, exceto `console.error`, que alimenta o log
  estruturado
- Log estruturado com **remoção automática de campos sensíveis** em qualquer
  profundidade: senha, token, cookie, chave de API e string de conexão viram
  `[oculto]`. O vazamento típico não vem de logar a senha de propósito, vem de
  logar um objeto inteiro que por acaso a contém
- Corpo de erro devolve código, mensagem genérica e um identificador de
  correlação. O detalhe técnico fica só no log
- `robots.txt` bloqueando buscadores e rastreadores de treinamento de modelos
- `/api/health` é público mas não devolve versão de biblioteca, host de banco nem
  contagem de usuários

## Verificação contínua

O CI roda a cada commit:

- `npm audit` de dependências de produção, falhando em severidade alta
- Semgrep com as regras de TypeScript, Node, Next, OWASP Top Ten, injeção de SQL
  e XSS
- Testes que verificam a matriz de permissões papel a papel, a rejeição de
  origem cruzada, a adulteração de token e a presença dos cabeçalhos

## Limitações conhecidas

- **A limitação de taxa é por instância.** Em ambiente serverless cada instância
  tem a própria memória, então o limite não é global. Resolve o que precisa
  resolver aqui, que é conter cota e frear força bruta ingênua. Um limite global
  exigiria Redis, que custa dinheiro e sai do escopo
- **Não há verificação de e-mail no cadastro.** Uma pessoa pode se cadastrar com
  um endereço que não é dela. Numa instalação real isso seria resolvido por
  integração com o diretório da instituição
- **Não há segundo fator.**
- **As senhas da base de demonstração são públicas**, de propósito. A base é
  sintética.

## Relatar um problema

Este é um trabalho acadêmico sem canal formal. Abra uma issue no repositório.
