# Progress

> **Tier:** Episodic memory · **Update:** at session end, alongside the commit
> Durable status. What works, what's deliberately missing, what's actually broken.

**Last updated:** 2026-10-01

## Status

The app is **feature-complete for its purpose** and stable. Work has shifted from
the application to the agent workspace around it.

| Area | State |
|---|---|
| App (`src/`) | ✅ Stable, plus search implemented on `chore/homework` |
| Database | ✅ sql.js, zero native deps, all OSes |
| Tests | ✅ 48 passing (14 tracked + 23 untracked `review.test.ts` + 11 `shelf.test.ts`) · ⚠️ coverage deliberately partial |
| Homework gaps | ⚠️ 4 documented — gap 1 implemented but **not retired** |
| Agent workspace | ✅ CLAUDE.md, hook, skills, verify, memory bank, WORKSPACE.md |
| Course alignment | ⚠️ Sessions 1–6 delivered (session 6 QA track only); 7–8 unread |

## Timeline

| Date | Milestone |
|---|---|
| 2026-09-14 | Scaffolding, ADR-001, db layer, models, server, routes, API, views, CLI, README, Vitest + deliberate gaps |
| 2026-09-15 | Windows compatibility pass |
| 2026-09-16 | **Migrated better-sqlite3 → sql.js**; docs updated |
| 2026-09-24 | Agent workspace layer, in three commits: `7ca6ee9` CLAUDE.md + TROUBLESHOOT.md · `83eff81` new-homework-gap skill · `3e56485` protect-gaps hook + memory bank |
| 2026-10-01 | **Session 5 deliverable** — `jira-cli` skill (MCP-to-CLI conversion) + measurement writeup, on `feat/session-5-mcp-to-cli` |
| 2026-10-01 | **Session 6 deliverable (QA)** — 11 tests for `addBookToShelf`, surfaced the dead-FK defect, on `feat/session-6-qa-shelf-tests` |

Workspace work continues on branch `chore/homework`.

## Session 5 outcome — MCP-to-CLI conversion

Converted the Atlassian connector's `searchJiraIssuesUsingJql` into a `curl`+`jq`
wrapper. Full method and numbers in `docs/mcp-to-cli-measurement.md`.

What the measurement actually showed, including where it contradicted the
lecture:

- **No baseline existed.** 1 MCP call across 91 session transcripts, and it was
  a login that never completed. 16 of 18 connectors unused. The "three most
  frequently called tools per server" step had no answer.
- **Per-call saving is real and recurring:** ~5.9 KB → 480 bytes, ~12×, same
  five issues. The MCP tool has no parameter that suppresses its `self` URLs,
  icon URLs, nested status objects or trailing feature-flag block; `jq` drops
  them before they reach context.
- **The connector costs 13,338 tokens, not the deck's 55,000** — ~4× lower.
  45% of it is Confluence and Compass, which never come up in a code session,
  and the connector cannot be mounted in halves.
- **Deferred tool loading had already solved most of the mounting problem.**
  `/context` showed MCP tools at 1k resident / 22k deferred; the whole exercise
  materialized only 2,046 tokens of Atlassian. This weakens the mounting-cost
  argument in Claude Code specifically, and leaves the per-call argument intact.
- **`claude mcp list` reports reachability, not authorization.** It called four
  unauthenticated servers `✔ Connected`. Use `/mcp` for an honest inventory.

## Session 6 outcome — QA test generation

Ran the 5-step test-gen workflow on `Shelf.addBookToShelf`, chosen because it is
the only function in the untested models with a branch. Full writeup in
`docs/qa-addBookToShelf-coverage.md`.

**Found a real defect: declared foreign keys have never been enforced at
runtime.** `sql.js`'s `export()` closes and reopens the connection, and
`foreign_keys` is per-connection, so it reverts to off. `saveDb()` calls
`export()`; `initDb()` calls `saveDb()` on its last line. Consequences, all
verified by probe:

- `addBookToShelf(99999, 1)` returns `true` and writes an orphan row
- `addBookToShelf(shelf, 99999)` likewise
- deleting a shelf strands its `shelf_books` rows — `ON DELETE CASCADE` never fires

A migration artifact: under better-sqlite3 the pragma stayed set for the life of
the connection, and `export()` has no equivalent there. No test caught it because
no test exercised a constraint.

The 11 new tests are mutation-verified — removing the duplicate guard fails 4 of
them, flipping its return value fails 2. The three `DEFECT:` tests deliberately
assert today's broken behaviour so the suite stays green; invert them if the fix
in open decision 0 lands.

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
2. Model test coverage — `user.ts` still has none. `review.ts` (23 tests) and
   `shelf.ts` (11 tests) were covered as QA homework; the gap stands for `user.ts`
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
| `tests/setup.ts` floating promise | Calls `initDb()` without `await`. Harmless today — every model test file awaits its own `initDb()` — but it is a trap. Re-confirmed 2026-10-01. | Leave |

## Not started

- Session 3 deliverables: `.claude/commands/` (`/commit`, `/review`, `/debug`),
  PostToolUse hook ("highest-ROI hook" per the deck — nothing to run it against
  yet, as there is no formatter or linter)
- Session 4 deliverable: self-improvement loop
  (`npm run self:extract-insights`, rules file, `UserPromptSubmit` hook,
  supervised/autonomous approval modes). Cheapest useful slice first: a `Stop`
  hook that automates the memory-bank ritual, removing the one step that
  currently depends on a human habit.
- Course sessions 7–8 not yet read
