# Active Context

> **Tier:** Episodic memory · **Update:** at the end of every session
> What is happening *right now*. Keep this short.
>
> ⚠️ This file is not an archive. When work lands, move the outcome to
> `progress.md` and delete it from here. A graveyard of old notes here is the
> documented failure mode.

**Last updated:** 2026-10-01

## Current focus

Course sessions 5 and 6 read. **Session 5's deliverable is done** (see
`progress.md`); **session 6's is not started.** Gap 1 (search) is still
implemented-but-not-retired — unchanged and still the oldest open decision.

## In flight

Uncommitted on `chore/homework`, from earlier sessions:

- `src/routes/books.ts` / `src/views/books/search-results.ejs` — search
  implemented, gap marker **deliberately retained**.
- `WORKSPACE.md`, `HOW-IT-WORKS.md` — workspace documentation.
- `tests/models/review.test.ts` — 23 tests, untracked. This is why the suite
  reports 37 rather than the 14 `CLAUDE.md` documents.

Session 5's work is on its own branch, `feat/session-5-mcp-to-cli`.

## Session 6 homework — not started

Two tracks, pick by role (deliverable 2 of 2, due before Thursday):

- **Designers:** branch → one visual change via Claude Code → verify in browser
  → open a PR.
- **QA:** pick a function, run the 5-step test-gen workflow, arrive with 3+
  tests you have read and understand.

The QA track fits this repo — `user.ts` and `shelf.ts` remain untested, and
`tests/models/review.test.ts` is a half-finished start. Writing tests is not
filling a homework gap, so it does not conflict with never-ever rule 1.

## Open decisions

0. **Rotate the Jira API token.** It was pasted into a Claude Code transcript on
   2026-10-01 while building `jira-cli`. It is in no file in this repo (verified
   by grep), but the transcript retains it. Replace it at
   `id.atlassian.com/manage-profile/security/api-tokens` and delete the old one.
   *Do this first.*
1. **Retire homework gap 1, or revert the search implementation?** It was
   implemented on explicit request. Right now the code works while README entry 1
   still advertises it as an assignment — the docs and the code disagree. Resolve
   via the `new-homework-gap` skill (retire) or `git checkout` (revert). *This is
   the one blocking thing.*
2. **Close the Bash bypass in `protect-gaps`?** The hook matches
   `Edit|MultiEdit|Write|NotebookEdit`, so a shell edit (`sed -i`, heredoc, `>`)
   skips it entirely. Matters more than usual here — the course teaches that
   hooks can't be bypassed.
3. **Untrack `bookshelf.db-shm` / `bookshelf.db-wal`?** Stale better-sqlite3
   artifacts; sql.js never writes WAL. Needs a `.gitignore` line plus
   `git rm --cached`.
4. **Is the loop worth keeping given the signal volume?** Built and green, but
   extraction reports 0 rules from 4 sessions (2 incidents, nothing recurring).
   It only earns its keep as transcript history accumulates. Re-run
   `npm run self:extract-insights` in a few weeks before judging it.
5. **Still missing: a `Stop` hook** to automate the memory-bank ritual — the one
   remaining step that depends on a human habit.

## Next up

- Course sessions 5–8 unread; more workspace gaps likely.
- Session 3 also calls for `.claude/commands/` (`/commit`, `/review`, `/debug`).

## Notes for the next session

- Hook changes need a Claude Code restart — `settings.json` is read at start.
- `npm run verify` is the fastest regression check.
