---
description: Diagnostic workflow — trace an error to its root cause and explain before changing code.
---

Diagnose the problem the user described (or the last failure in the session).

**Explain before touching code.** Do not edit anything until step 4.

1. **Read the actual error.** Full message, full stack trace. Quote the specific
   line that failed — not a paraphrase.
2. **Reproduce it.** Find the smallest command that shows the failure:
   `npm run test:run`, `npm run build`, `npm run verify`, or a `curl` against a
   running server. If you cannot reproduce it, say so and ask for the steps
   rather than guessing.
3. **Trace to root cause.** Follow the call path back from the failure. Check the
   usual suspects in this codebase first:
   - missing `.js` on a relative import
   - `initDb()` not awaited
   - route order (`/books/:id` shadowing `/books/search`)
   - `npm run build` skipped, so `dist/` has no views or schema
   - writes lost because the process was killed before `saveDb()` ran
4. **Explain the cause in two or three sentences**, then propose the smallest fix
   and ask before applying it.
5. **Verify** with the exact command from step 2, and report its real output.

If the root cause turns out to be a deliberate homework gap, say so and stop —
that is not a bug (`CLAUDE.md` rule 1).
