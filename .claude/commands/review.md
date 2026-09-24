---
description: Run the full code review checklist over the current diff.
---

Review the current changes. Default to `git diff HEAD`; if the user names a
branch, file, or PR, review that instead.

Work through all four, in order, and report findings grouped by severity:

**1. Correctness**
- Does it do what it claims? Trace at least one real input through the change.
- Error and empty states handled, not just the happy path.
- `async` correctly awaited — `initDb()` is async since the sql.js migration.

**2. Convention violations** (this repo specifically)
- Relative imports carry `.js` extensions (NodeNext ESM).
- Models use the `all` / `get` / `run` helpers, never `getDb()`, and never take a
  db handle as an argument.
- Literal routes declared before parameterized ones (`/books/search` before
  `/books/:id`).
- HTML routes return HTMX fragments; `api.ts` returns JSON with a real status code.
- No new runtime dependency, no native binding, no frontend framework.

**3. Security & performance**
- SQL is parameterized — never string-interpolated.
- User input is escaped in EJS (`<%=`, not `<%-`).
- No N+1 queries inside a loop over rows.

**4. Coverage gaps**
- Does the change need a test? Which one is missing?
- Does it touch a deliberately untested model (`user`, `review`, `shelf`)? Say so
  rather than adding tests unasked — those are homework.

Report findings as `file:line — problem — suggested fix`. State clearly when you
find nothing; do not invent findings to fill the sections.

Do not fix anything unless asked. Review only.
