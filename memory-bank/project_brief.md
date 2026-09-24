# Project Brief

> **Tier:** Semantic memory · **Update:** on major scope changes only
> Goals and scope. If a fact here changes, something big changed.

## What this is

Agent Bookshelf is a Goodreads-lite web app whose real product is **homework**.
It exists so students in an agentic-engineering course can point AI agents at a
realistic codebase and practice directing them.

The app is the medium. The gaps in the app are the product.

## Who it serves

| Audience | Gets |
|---|---|
| **Students** | An app that installs and runs in one command, with concrete tasks to point an agent at |
| **Instructors** | Pre-built assignments with known-good solutions and difficulty already calibrated |
| **AI agents** | A conventional, well-typed codebase they can read without special explanation |

## Goals

1. **Install in one command on any OS.** `npx agent-bookshelf` works on Windows,
   macOS, and Linux with no compiler, no Python, no native build step. This goal
   drove the single largest technical decision in the project (see
   `tech_context.md` — the sql.js migration).
2. **Be legible to an agent.** Conventional Express + TypeScript, small files,
   obvious naming. An agent should not need tribal knowledge to make a correct
   change.
3. **Fail safely.** A student cannot corrupt anything that `rm bookshelf.db`
   doesn't fix. No cloud state, no credentials, no external services.
4. **Hold deliberate gaps.** Each gap is reachable from the running app,
   documented in the README, and solvable without a schema change.

## Success criteria

- A student with no prior setup goes from clone to a running app in under five
  minutes.
- `npm run verify` is green on a fresh clone.
- Every homework gap is completable by an agent given a well-specified prompt,
  without touching the database schema.
- The app remains fully usable by a student who completes zero homework.

## Scope

**In scope:** the app itself (`src/`), tests, course-facing documentation, ADRs,
and the agent workspace config (`CLAUDE.md`, `.claude/`, `memory-bank/`).

**Out of scope:**

- **Frontend frameworks.** No React, Vue, Svelte, SPA router, or bundler. Recorded
  as a deliberate trade-off in `docs/adr/001-architecture.md`: less modern-frontend
  surface is acceptable because the course is about agents, not frontends.
- **Auth, accounts, sessions.** The three seeded users are selected, not logged in.
  Auth would add setup friction for zero teaching value.
- **Production concerns.** No deployment, monitoring, rate limiting, or
  migrations. This runs on localhost for 30 minutes at a time.
- **Real book data.** The 50 seeded books are fixed fixtures. No external API.

## Constraints

- **Zero native dependencies** — non-negotiable, it is what makes Windows work.
- **No build step for the frontend** — HTMX is vendored at
  `src/public/htmx.min.js`, not fetched from a CDN, so the app works offline.
- **The gaps must survive contact with agents.** Agents treat TODOs as defects;
  enforcement lives in `.claude/hooks/protect-gaps.mjs`, not in good intentions.
