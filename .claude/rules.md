# Learned Rules

Git-tracked rules extracted from this project's own session history.

**This file is the source of truth for the self-improvement loop.** It is plain
markdown on purpose — rules are *visible context, not hidden instructions*. Read
them, edit them, delete them. Every change is a diff you can review and revert.

## Lifecycle

```
PROPOSED ──approve──> ACCEPTED ──no hits/60d──> UNUSED ──archive──> ARCHIVED
    │                                                                   ▲
    └──────────────────────── reject ───────────────────────────────────┘
```

| State | Meaning |
|---|---|
| `proposed` | Extracted from a failure signal. **Not active.** Awaiting your call. |
| `accepted` | Live. Injected into prompts whose text matches its triggers. |
| `unused` | Accepted but never matched a prompt in 60 days. Flagged for review. |
| `archived` | Retired. Kept here as an audit trail, never injected. |

## Commands

```bash
npm run self:extract-insights   # scan transcripts → propose rules
npm run self:status             # show rules by state, flag stale ones
npm run self:approve R001       # proposed → accepted
npm run self:reject R001        # proposed → archived
npm run self:archive            # sweep unused → archived
```

Commit accepted rules as `chore(self-improve): …` so a bad rule is one
`git revert` away.

## Safety

A rule can never modify `CLAUDE.md`, `.claude/settings.json`, or anything in
`.claude/hooks/`. Rules are advisory text injected into context; `CLAUDE.md`
outranks them, and the hooks are unreachable from here. `self:approve` refuses
any rule whose body targets those paths.

---

<!-- RULES BELOW — managed by scripts/self-improve.mjs, safe to hand-edit -->

## R001 · Do not copy the createUser example from tests/README.md

- **state:** accepted
- **created:** 2026-09-24
- **triggers:** test, vitest, spec, createuser, model test
- **evidence:** 2 incident(s) · stale-doc · observed 2026-09-24
- **hits:** 3
- **last-hit:** 2026-10-01

`tests/README.md` shows `User.createUser(db, 'testuser', 'Test User')`, but models
never take a database handle — the real signature is `createUser(username, displayName)`.
Agents that follow that README write tests that fail to compile. Read the model's
actual signature before writing a test against it.

## R002 · Rules must never rewrite CLAUDE.md

- **state:** archived
- **created:** 2026-09-24
- **triggers:** rule, policy
- **evidence:** synthetic · safety test
- **hits:** 0
- **last-hit:** never

This rule deliberately targets CLAUDE.md to prove the approval guard refuses it.
