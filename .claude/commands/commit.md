---
description: Write a conventional commit message from the staged diff and commit. Never pushes.
---

Commit what is currently staged.

1. Run `git status` and `git diff --staged`. If nothing is staged, say so and stop
   — do not stage files on the user's behalf.
2. Run `git log --oneline -10` to match the existing message style.
3. Write a conventional-commit subject: `type(scope): summary`
   - types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`
   - scope is the area touched (`routes`, `models`, `db`, `workspace`, `session-N`)
   - imperative mood, lower case, no trailing period, under 72 characters
4. Add a body **only** when the change needs a why. Session 4 treats the commit
   log as episodic memory — a decision recorded here is a decision the team can
   still find in six months. Explain reasoning, not the diff.
5. Commit. **Never push**, never amend an existing commit, never add `-f`.

Before committing, verify the staged change does not remove a homework-gap
marker. If it does, stop and say so — see `CLAUDE.md` rule 1.
