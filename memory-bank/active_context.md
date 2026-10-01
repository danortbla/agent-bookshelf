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
- `tests/models/review.test.ts` — 23 tests, untracked. With session 6's 11 the
  suite reports 48, not the 14 `CLAUDE.md` documents.

Session 5's work is on its own branch, `feat/session-5-mcp-to-cli`.

## Session 6 homework — QA track delivered

11 tests for `addBookToShelf` on `feat/session-6-qa-shelf-tests`, plus a real
defect (see `progress.md`). The designer track was not attempted.

`user.ts` is still untested — the obvious next target if more coverage is wanted.

## Open decisions

0. **Enable foreign key enforcement?** `PRAGMA foreign_keys = ON` is set in
   `initDb`, but `saveDb()` -> `db.export()` closes and reopens the sql.js
   connection, resetting it. Every declared FK and `ON DELETE CASCADE` has been
   inert since the sql.js migration. One-line fix in `saveDb()`, verified: the
   suite goes to 45 pass / 3 fail, the 3 being the `DEFECT:` characterization
   tests that assert today's behaviour. Nothing else breaks. Turning it on means
   bad writes start throwing where they now silently succeed — a behaviour
   change, hence a decision. See `docs/qa-addBookToShelf-coverage.md`.
1. **Rotate the Jira API token.** It was pasted into a Claude Code transcript on
   2026-10-01 while building `jira-cli`. It is in no file in this repo (verified
   by grep), but the transcript retains it. Replace it at
   `id.atlassian.com/manage-profile/security/api-tokens` and delete the old one.
   *Do this first.*
2. **Retire homework gap 1, or revert the search implementation?** It was
   implemented on explicit request. Right now the code works while README entry 1
   still advertises it as an assignment — the docs and the code disagree. Resolve
   via the `new-homework-gap` skill (retire) or `git checkout` (revert). *This is
   the one blocking thing.*
3. **Close the Bash bypass in `protect-gaps`?** The hook matches
   `Edit|MultiEdit|Write|NotebookEdit`, so a shell edit (`sed -i`, heredoc, `>`)
   skips it entirely. Matters more than usual here — the course teaches that
   hooks can't be bypassed.
4. **Untrack `bookshelf.db-shm` / `bookshelf.db-wal`?** Stale better-sqlite3
   artifacts; sql.js never writes WAL. Needs a `.gitignore` line plus
   `git rm --cached`.
5. **Is the loop worth keeping given the signal volume?** Built and green, but
   extraction reports 0 rules from 4 sessions (2 incidents, nothing recurring).
   It only earns its keep as transcript history accumulates. Re-run
   `npm run self:extract-insights` in a few weeks before judging it.
6. **Still missing: a `Stop` hook** to automate the memory-bank ritual — the one
   remaining step that depends on a human habit.

## Next up

- Course sessions 5–8 unread; more workspace gaps likely.
- Session 3 also calls for `.claude/commands/` (`/commit`, `/review`, `/debug`).

## Notes for the next session

- Hook changes need a Claude Code restart — `settings.json` is read at start.
- `npm run verify` is the fastest regression check.
