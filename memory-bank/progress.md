# Progress

> **Tier:** Episodic memory · **Update:** at session end, alongside the commit
> Durable status. What works, what's deliberately missing, what's actually broken.

**Last updated:** 2026-09-24

## Status

The app is **feature-complete for its purpose** and stable. Work has shifted from
the application to the agent workspace around it.

| Area | State |
|---|---|
| App (`src/`) | ✅ Stable, plus search implemented on `chore/homework` |
| Database | ✅ sql.js, zero native deps, all OSes |
| Tests | ✅ 14 passing · ⚠️ coverage deliberately partial |
| Homework gaps | ⚠️ 4 documented — gap 1 implemented but **not retired** |
| Agent workspace | ✅ CLAUDE.md, hook, skill, verify, memory bank, WORKSPACE.md |
| Course alignment | ⚠️ Sessions 1–4 covered; 5–8 unread |

## Timeline

| Date | Milestone |
|---|---|
| 2026-09-14 | Scaffolding, ADR-001, db layer, models, server, routes, API, views, CLI, README, Vitest + deliberate gaps |
| 2026-09-15 | Windows compatibility pass |
| 2026-09-16 | **Migrated better-sqlite3 → sql.js**; docs updated |
| 2026-09-24 | Agent workspace layer, in three commits: `7ca6ee9` CLAUDE.md + TROUBLESHOOT.md · `83eff81` new-homework-gap skill · `3e56485` protect-gaps hook + memory bank |

15 commits. Workspace work continues on branch `chore/homework`.

## Works

- 50 books, 3 users, shelves and reviews seeded on first run
- Browse, book detail, reviews with average rating, duplicate-review rejection
- User shelves, add/remove books
- Full JSON API at `/api/*` for books, users, reviews, shelves
- HTMX interactions with no client build step
- One-command install on Windows/macOS/Linux
- `npm run verify` — runtime, build, gaps, hooks, tests

## Deliberately missing

Not bugs. See `product_context.md`. **Do not fix unasked.**

1. ⚠️ Search backend — `src/routes/books.ts` — **implemented 2026-09-24 on
   explicit request, on `chore/homework`.** The marker was retained so the gap is
   retired deliberately, but README entry 1 still advertises it as an assignment.
   Code and docs disagree until this is resolved — see `active_context.md`.
2. Model test coverage — `user.ts`, `review.ts`, `shelf.ts` have none
3. API input validation — `src/routes/api.ts`
4. Visual design — `src/public/css/style.css`

## Actually broken / untidy

Real issues, low severity, documented so nobody "discovers" them twice:

| Issue | Detail | Decision |
|---|---|---|
| **Hook bypassable via Bash** | `protect-gaps` matches `Edit\|MultiEdit\|Write\|NotebookEdit`. A shell edit (`sed -i`, heredoc, `>`) never triggers it, so the gap guard silently does not apply. Found 2026-09-24 when auto mode routed edits through Bash. Sharp edge for a course teaching that hooks can't be bypassed. | Open — see `active_context.md` |
| Tracked WAL sidecars | `bookshelf.db-shm`, `bookshelf.db-wal` are in git; `.gitignore` covers `*.db` but not the sidecars. Meaningless under sql.js. | Open — see `active_context.md` |
| `.gitignore` comment is wrong | Claims `dist/` is committed "so npx works"; `dist/` is untracked because the Nuxt-block `dist` entry catches it. Harmless — `postinstall` builds. | Leave |
| README Node versions conflict | Line 25 says 24 LTS, line 82 says 20+, `engines` says `>=20`. | Leave, documented |
| `tests/README.md` example is stale | Shows `User.createUser(db, …)`; real signature takes no db handle. Will mislead student agents. | Fix when touching that file |
| `tests/setup.ts` floating promise | Calls `initDb()` without `await`. Harmless today — all three test files await their own `initDb()` — but it is a trap. | Leave |

## Not started

- Session 3 deliverables: `.claude/commands/` (`/commit`, `/review`, `/debug`),
  PostToolUse hook ("highest-ROI hook" per the deck — nothing to run it against
  yet, as there is no formatter or linter)
- Session 4 deliverable: self-improvement loop
  (`npm run self:extract-insights`, rules file, `UserPromptSubmit` hook,
  supervised/autonomous approval modes). Cheapest useful slice first: a `Stop`
  hook that automates the memory-bank ritual, removing the one step that
  currently depends on a human habit.
- Course sessions 5–8 not yet read
