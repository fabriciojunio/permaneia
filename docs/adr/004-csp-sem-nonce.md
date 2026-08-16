# ADR 004: CSP com unsafe-inline em script-src, sem nonce

**Situação:** aceita, com revisão prevista

## Contexto

A política ideal de CSP usa um nonce por requisição em `script-src`, eliminando a
necessidade de `unsafe-inline`.

O Next.js na versão em uso injeta scripts inline para hidratação. Habilitar nonce
exige acessar `headers()` no middleware e desativa a otimização estática de
várias rotas.

## Decisão

Manter `script-src` com `unsafe-inline` e compensar com o resto da política:

- `default-src 'self'`
- `object-src 'none'`
- `frame-ancestors 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `connect-src 'self'`

## Justificativa

`unsafe-inline` só é perigoso combinado com uma injeção de HTML. O React escapa
todo texto interpolado por padrão, e o projeto não usa `dangerouslySetInnerHTML`
em lugar nenhum.

`connect-src 'self'` limita a exfiltração mesmo na hipótese de execução de
script arbitrário: o navegador não consegue enviar dado para fora da origem.

Vale registrar que a chave do Gemini nunca chega ao navegador. Quem chama a API
externa é o servidor, e é por isso que `connect-src` pode ficar restrito.

## Consequências

**Contra.** A CSP não é a mais estrita possível.

**Revisão prevista.** Ao migrar para uma versão do Next em que o nonce não custe
a estratégia de renderização, remover `unsafe-inline`.
