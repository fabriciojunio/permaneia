# ADR 001: Monolito Next.js em vez de backend e frontend separados

**Situação:** aceita

## Contexto

A especificação inicial previa FastAPI em Python para o backend e React com Vite
para o frontend, em dois serviços separados.

O requisito operacional, porém, é duro: a aplicação precisa estar publicada, no
ar e funcionando, sem custo, e precisa continuar funcionando durante a
apresentação.

## Decisão

Um único aplicativo Next.js com App Router, servindo páginas e rotas de API, na
Vercel, com Postgres no Supabase.

## Consequências

**A favor.** Um artefato para publicar em vez de dois, sem CORS e sem coordenação
de duas URLs. O tier gratuito da Vercel cobre o caso com folga. Tipo
compartilhado entre servidor e cliente, sem duplicação de contrato.

**Contra.** O sistema fuzzy precisou ser escrito em TypeScript em vez de usar
`scikit-fuzzy`. Ver ADR 002, onde isso deixou de ser custo e virou ganho.

**Contra.** Perde-se o ecossistema científico do Python. Para este domínio, que é
aritmética sobre funções de pertinência, não fez falta.
