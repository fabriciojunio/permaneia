# PermaneIA

*[Leia em português](README.md)*

A study assistant grounded in real course documents, plus a dropout-risk panel
built on fuzzy logic. Written for an Artificial Intelligence course at
Unisagrado, Brazil, and written to actually stay up rather than be demoed once
and switched off.

**Live:** [permaneia.vercel.app](https://permaneia.vercel.app)

`Next.js 15` · `TypeScript` · `PostgreSQL + pgvector` · `Prisma` · `Google Gemini` ·
`Docker` · `Kubernetes` · `Amazon S3`

## The problem

The [Semesp 2026 report](https://www.semesp.org.br/mapa/edicao-16/brasil/)
reports **64.7% cumulative withdrawal in private higher education** and
**68.1% in private distance education**, for the **2020–2024 cohort cycle**.
These are trajectory indicators, not annual dropout rates.

The [OECD 2025 Brazil note, Table B5.1](https://www.oecd.org/en/publications/education-at-a-glance-2025_1a3543e2-en/brazil_d42263a0-en.html)
reports that **49% of bachelor's entrants complete within three years after
the programme's expected duration**. This is not the share of all young adults
with a degree. The project explores attendance, grades and platform use as
monitoring signals. Its heuristic score has not been validated against actual
student dropout outcomes.

## What the system does

**1. A study assistant with retrieval-augmented generation.** Students ask about
the course and the system searches the indexed institutional documents before
calling a language model. Retrieval has two arms — vector proximity and term
matching — fused by rank: the first finds the paraphrase, the second finds the
word that decides a short question. Every answer cites its source and says which
arm found it.

Calendar questions ("what's next week?", "how many days until the exam?") are
answered from a schedule computed in code from the indexed timetable. The domain
does the date arithmetic; the model only writes it up.

When the answer isn't in the material, the system says so. **The refusal is the
product**: it would rather admit it doesn't know than invent a plausible exam
date.

**2. A dropout-risk panel using fuzzy logic.** Attendance, performance and
engagement feed a Mamdani system of 27 rules and come out as a continuous score.
Coordination gets the class ordered by who needs contact first, along with the
rules that produced each score.

The central argument sits in the overlap: a student with **8.6 out of 10 and 34%
attendance** comes out as **high** risk. A grade-average criterion, which is
a simplified reference chosen for this project, would not flag them.
This synthetic example demonstrates rule behaviour, not predictive accuracy.

## Running it

With Docker, nothing else needed:

```bash
docker compose up -d
```

Without Docker, given a Postgres with `pgvector`:

```bash
npm install
cp .env.example .env      # fill DATABASE_URL, DIRECT_URL, SESSION_SECRET
npm run db:push && npm run db:seed && npm run dev
```

Demo accounts use the password `permanencia2026`:
`coordenacao@permaneia.exemplo` for the risk panel,
`aluno@permaneia.exemplo` for the assistant. They deliberately don't overlap.

**The Gemini key is optional.** Without it the system falls back to a local
deterministic provider that quotes the retrieved passages verbatim, with sources
cited. You lose fluency, not trustworthiness — and the interface always shows
which of the two answered, because a generated answer and a quoted one carry
different guarantees.

## Engineering

| | |
|---|---|
| Unit tests | 2,076 passed in the October 2026 review |
| Line coverage in the configured scope | 92.96%; excluded adapters are listed in `vitest.config.ts` |
| Integration | PostgreSQL with pgvector in a separate CI job |
| End-to-end | Playwright against an isolated application and database; see the commit's CI run |
| Assistant evaluation | Historical results and limitations in `docs/AVALIACAO-RAG.md`, not a measurement of the current version |
| Production dependencies | 0 vulnerabilities reported by `npm audit --omit=dev` on October 11, 2026 |

Session revocation, private chat history, test isolation and migration order are
documented in [the October review](docs/REVISAO-2026-10.md). Software tests do not
establish the model's ability to predict student withdrawal.

Things worth a look:

- **Distributed tracing** in W3C `traceparent` format, with one span per
  measured step and one per database query. Parameter values never reach a
  span: telemetry leaves the application, and student names have no business
  travelling with it.
- **A migration guard** that fails the build on a destructive migration without
  a written justification. Deploying doesn't swap one version for the other in
  an instant — both serve traffic while it shifts, and dropping a column the
  old one still reads breaks whoever had the page open.
- **A guard against literal combining marks** in regular expressions. That one
  is a scar: the assistant's safety filters worked in source and failed in the
  published bundle, and accented prompt injection walked straight through.
- Container image, compose file, Kubernetes manifests and a manifest checker
  that catches what schema validation can't — a scale target that doesn't
  exist, a selector matching no pod, a secret key never declared.

Architecture decisions live in [docs/adr](docs/adr), twelve of them, each with
the argument and the alternatives that were turned down.

## Privacy

The student base is **entirely synthetic**: 30 students, grades, attendance and
access logs generated by a seeded script. No record maps to a real person.

The indexed documents, by contrast, are real and public — the course timetable,
the teaching contract, the project brief. That's what makes a live demo
verifiable.

## Licence

MIT.
