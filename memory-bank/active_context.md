# Active Context

> **Tier:** Episodic memory · **Update:** at the end of every session
> What is happening *right now*. Keep this short.
>
> ⚠️ This file is not an archive. When work lands, move the outcome to
> `progress.md` and delete it from here. A graveyard of old notes here is the
> documented failure mode.

**Last updated:** 2026-09-24

## Current focus

Building the agent workspace layer for the course — `CLAUDE.md`, hooks, skills,
verification, and this memory bank. The app code itself is stable and untouched.

## Landed this session (2026-09-24)

- `CLAUDE.md` — 3 never-ever rules, stack, scope, known inconsistencies.
- `.claude/skills/new-homework-gap/` — skill for authoring and auditing gaps.
- `.claude/hooks/protect-gaps.mjs` + `.claude/settings.json` — PreToolUse hook
  that blocks edits removing a gap marker.
- `scripts/verify.mjs` + `npm run verify` — 5-section check, fires the hook live.
- `TROUBLESHOOT.md` — referenced by the course deck; previously missing.
- `memory-bank/` — these five files.

Status: `npm run verify` all green, 14 tests passing.

## Open decisions

1. **Untrack `bookshelf.db-shm` / `bookshelf.db-wal`?** They are stale
   better-sqlite3 artifacts; sql.js never writes WAL. Needs a `.gitignore` line
   plus `git rm --cached`. Raised, not yet decided.
2. **Fix the README Node-version contradiction?** Line 25 says 24 LTS, line 82
   says 20+, `engines` says `>=20`. Documented as known; not fixed.
3. **Build the self-improvement loop?** The course's session 4 calls for
   `npm run self:extract-insights`, a git-tracked rules file, and a
   `UserPromptSubmit` hook. Not started.

## Next up

- Course sessions 5–8 have not been read; more workspace gaps may surface.
- Session 3 also calls for slash commands in `.claude/commands/`
  (`/commit`, `/review`, `/debug`) and a PostToolUse hook — neither exists yet.

## Notes for the next session

- The hook only takes effect after a Claude Code restart; `settings.json` is
  read at session start.
- `npm run verify` is the fastest way to confirm nothing regressed.
