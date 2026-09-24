---
name: new-homework-gap
description: Author, resize, or audit a deliberate homework gap in the Agent Bookshelf teaching codebase — the TODO-marked stub that degrades gracefully plus the README entries that document it. Use when creating a new assignment, changing an existing gap's difficulty, or checking that the shipped gaps are still intact and solvable.
---

# Authoring a homework gap

Agent Bookshelf is a teaching playground. A **homework gap** is a deliberate,
documented hole that a student's AI agent is meant to fill. A gap is not a bug
and not an unfinished feature — it is a designed exercise, and it has to survive
a student cloning the repo and running the app without ever noticing something
looks broken.

## The five invariants

Every gap in this repo satisfies all five. If your new gap misses one, it will
read as a defect instead of an assignment.

1. **The app still works.** `npx agent-bookshelf` runs, no crashes, no 500s, no
   404s. A student who never does the homework still gets a working app.
2. **The affordance is already wired.** The UI or API entry point exists and
   reaches real code. The student implements behavior, not plumbing.
3. **The stub degrades gracefully** — a friendly message, an empty result, a
   documented no-op. Never an exception, never a stack trace.
4. **A TODO names it as deliberate**, in the exact house phrasing, so an agent
   reading the file knows it is an exercise and not an oversight.
5. **It is documented in two places** — `README.md` under "Homework Gaps", and
   `tests/README.md` if the gap involves test coverage.

## The canonical example

The search gap is the reference implementation. Read it before writing a new one:

- `src/views/books/index.ejs` — the HTMX input is **fully wired**
  (`hx-get="/books/search"`, `hx-target="#search-results"`).
- `src/routes/books.ts` — `GET /books/search` is registered and returns a
  friendly fragment, carrying the TODO.
- `src/models/book.ts:22` — `searchBooks(query)` is **already implemented**.

Note the difficulty calibration: the hard part (the SQL) is done. The gap is the
wiring between an existing model function and an existing UI. That is the
difficulty this course targets — size new gaps the same way unless you mean to
make one harder.

## Procedure

### 1. Choose the surface

Pick one layer, and check what already exists there so the gap is wiring, not
invention:

| Surface | File | Good for |
|---|---|---|
| HTML route | `src/routes/{books,shelves,reviews}.ts` | Feature work, HTMX fragments |
| JSON API | `src/routes/api.ts` | Validation, error handling, status codes |
| Model | `src/models/*.ts` | SQL and data-shape exercises |
| Tests | `tests/` | QA homework — see step 5 |
| Styling | `src/public/css/style.css` | PM/design homework |

### 2. Write the stub

Follow the house conventions — an agent that gets these wrong produces code that
does not compile:

- Relative imports carry `.js` extensions: `import * as Book from '../models/book.js'`
- Models go through the `all` / `get` / `run` helpers in `src/db/index.ts`,
  never `getDb()` directly, and cast with `as unknown as T`.
- **Declare literal routes before parameterized ones.** `/books/search` must come
  before `/books/:id`, or `"search"` is parsed as an id. This is the single
  easiest way to break a route-layer gap.
- HTML routes return HTMX fragments (`res.send('<div>…</div>')` or
  `res.render('partial')`); `api.ts` returns `res.json()` with a real status code.

Use the established TODO phrasing so it is greppable and unmistakable:

```ts
// TODO: Implement <thing>
// This is a deliberate homework gap - agents should implement <the part>
```

### 3. Verify graceful degradation

Start the app and exercise the affordance by hand. The stub must produce
something a student can see and understand:

```bash
npm run build && npx agent-bookshelf
```

For an HTML gap, return a message in the shape the target expects:

```ts
res.send(`
  <div class="search-message">
    <p>Search functionality coming soon! This is a homework exercise for agents to implement.</p>
  </div>
`);
```

For an API gap, return valid JSON — an empty array or an honest error object,
never an uncaught throw.

### 4. Document it in `README.md`

Add a numbered entry under **### Homework Gaps**, matching the existing four:

```markdown
N. **<Gap name>** - <one line on what is missing>
   - Location: `src/path/to/file.ts` line NN
   - <what students do>
```

Open the file and read off the real line number — do not guess. Existing entries
have already drifted, so if you touch a file above another gap's TODO, re-check
that gap's line number too.

### 5. Document test coverage in `tests/README.md`

If the gap is a test gap, or adds code that ships untested, update
`tests/README.md` — both the "Intentionally incomplete" bullets and the
"What's Missing (Homework Gaps)" list.

⚠️ The "Writing New Tests" example in that file is stale: it shows
`User.createUser(db, 'testuser', 'Test User')`, but the real signature is
`createUser(username, displayName)` — no `db` argument. Models read module state
set by `initDb()`; they never take a database handle. Do not copy that example
into new material, and fix it if you are editing the file anyway.

### 6. Check the gap is solvable and the suite is green

```bash
npm run test:run
```

All existing tests must still pass (14 at last check). Then confirm the gap is
actually completable: the model function, table, or column the student needs
must already exist. A gap that requires a schema migration is a different and
much harder assignment — make that choice on purpose, not by accident.

## Auditing existing gaps

To check the shipped gaps are intact:

```bash
grep -rn "TODO\|deliberate homework" src/
```

Cross-check each hit against the numbered list in `README.md`. A gap that appears
in code but not the README is invisible to students; one in the README but not
the code has been silently filled in — most likely by an agent that treated it as
a bug. Both are worth fixing before a cohort starts.

## Do not

- Leave a gap that throws, 404s, or renders a blank page.
- Gap something a student cannot reach from the running app.
- Remove or "fix" an existing gap while working on something else — per the
  README's contributing note, the gaps are the product.
- Add a gap that needs a schema change, unless that is the assignment.
