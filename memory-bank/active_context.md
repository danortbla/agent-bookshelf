# Active Context

> **Tier:** Episodic memory · **Update:** at the end of every session
> What is happening *right now*. Keep this short.
>
> ⚠️ This file is not an archive. When work lands, move the outcome to
> `progress.md` and delete it from here. A graveyard of old notes here is the
> documented failure mode.

**Last updated:** 2026-09-24

## Current focus

Branch `chore/homework`. The workspace layer is committed and green; the open
work is a decision, not code — **what to do about homework gap 1 (search), which
is now implemented but not retired.**

## In flight

Uncommitted on `chore/homework`:

- `src/routes/books.ts` — search endpoint implemented against the existing
  `Book.searchBooks()`. The gap marker was **deliberately retained**.
- `src/views/books/search-results.ejs` — new HTMX fragment, empty-state handled.
- `WORKSPACE.md` — how to drive the workspace layer.
- **Self-improvement loop** — `.claude/rules.md` (lifecycle), 
  `.claude/hooks/inject-rules.mjs` (UserPromptSubmit injection),
  `scripts/self-improve.mjs` (extract/status/approve/reject/archive),
  five `self:*` npm scripts, and a 7th `verify` section.

Verified: build ✓, 14 tests ✓, `npm run verify` all green, endpoint serving
(`?q=dune` → Dune, `?q=martin` → 3 matches across title and author, `?q=` → 50).

## Open decisions

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
