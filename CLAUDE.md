# Agent Bookshelf

A Goodreads-lite web app that exists to be **homework**. Students install it and
point AI agents at deliberate gaps in it. Optimize for a codebase that is easy
for an agent to read and safe for a student to break.

---

## 🚫 Never-ever rules

### 1. Never fill in, remove, or "fix" a homework gap

The gaps are the product, not a backlog. A `TODO` reading
`This is a deliberate homework gap` is a designed exercise — treat it as
load-bearing. The same goes for the untested models (`user.ts`, `review.ts`,
`shelf.ts`) and the missing API validation.

Implement a gap **only** when the prompt names it explicitly ("implement the
search backend"). Never as a drive-by while doing something else, never because
it "looks unfinished." If you are editing a file and notice a gap, leave it.

To author or resize a gap, use the `new-homework-gap` skill.

### 2. Never bypass the sql.js data layer

This repo migrated off `better-sqlite3` to sql.js (WebAssembly) so it installs
with zero native dependencies on Windows. Do not undo that.

- Never add `better-sqlite3`, `node-sqlite3`, or any native binding.
- Models call the `all` / `get` / `run` helpers from `src/db/index.ts`. They
  never call `getDb()` directly and never take a database handle as an argument.
- `initDb()` is **async**. It was synchronous before the migration; older
  examples that call it without `await` are stale.

### 3. Never commit database artifacts or run destructive git commands

`bookshelf.db` and its sidecars are local state. No `git push --force`, no
`reset --hard`, no branch deletion, no `rm` of a `.db` file, without being asked.

> ⚠️ `bookshelf.db-shm` and `bookshelf.db-wal` are currently **tracked** —
> `.gitignore` covers `*.db` but not the sidecars. They are stale WAL files from
> the better-sqlite3 era; sql.js never writes WAL. Don't add more; ask before
> untracking the existing two.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js ≥20, ESM (`"type": "module"`) | |
| Language | TypeScript 5.7, NodeNext resolution | |
| Server | Express 4 | |
| Database | SQLite via **sql.js** 1.12 (WASM) | No native deps |
| Views | EJS + HTMX 1.9 | No build step, no SPA |
| Tests | Vitest 2.1 + supertest | 14 tests, all passing |

### Conventions that are easy to get wrong

**Relative imports carry `.js` extensions**, even importing `.ts` files — this is
NodeNext ESM:

```ts
import * as Book from '../models/book.js';   // ✅
import * as Book from '../models/book';      // ❌ fails at runtime
```

**Every db helper result needs a cast.** The helpers return
`Record<string, unknown>`, so models cast through `unknown`:

```ts
export function getBookById(id: number): Book | undefined {
  return get('SELECT * FROM books WHERE id = ?', [id]) as unknown as Book | undefined;
}
```

**Literal routes must be declared before parameterized ones.** `/books/search`
before `/books/:id`, or `"search"` is parsed as an id.

**Writes are in-memory until `saveDb()` runs.** sql.js holds the whole database
in WASM memory. Nothing outside `src/db/index.ts` calls `saveDb()` today —
`closeDb()` does it on shutdown. If you add a write path that must survive a
crash, call `saveDb()` explicitly and say so.

**Models are function modules, not classes.** Import them namespaced:
`import * as Review from '../models/review.js'`.

**HTML routes return HTMX fragments; `api.ts` returns JSON.** Don't mix — a
fragment route returns `res.send('<div>…</div>')` or renders a partial; an API
route returns `res.json()` with a real status code.

---

## Project layout

```
src/
  server.ts          Express app + startup
  db/index.ts        initDb / all / get / run / saveDb / closeDb
  db/schema.sql      Schema (also copied to dist/ by copy-assets)
  db/seed.sql        50 books, 3 users, sample shelves + reviews
  models/            book, user, review, shelf — plain functions
  routes/            books, shelves, reviews (HTML) + api (JSON)
  views/             EJS templates and partials
  public/            CSS + vendored htmx.min.js
tests/               Vitest — deliberately incomplete
docs/adr/            Architecture decisions
memory-bank/         Persistent project memory (see below)
.claude/skills/      Project skills
.claude/hooks/       Deterministic guardrails
```

## Memory

`memory-bank/` holds what won't fit in this file and shouldn't be re-explained
every session. Read it when you need background; this file stays the rules.

| File | Holds | Update |
|---|---|---|
| `project_brief.md` | Goals, scope, constraints | Major scope changes |
| `product_context.md` | User stories, why each gap exists | Assignment changes |
| `tech_context.md` | Stack, setup, the sql.js consequences | Stack changes |
| `active_context.md` | What's in flight right now | **Every session** |
| `progress.md` | Status, timeline, known issues | **Every session** |

The first three are semantic memory — stable knowledge. The last two are episodic
— what happened lately. **Never let episodic content accumulate in the semantic
files, and never let `active_context.md` become an archive**: when work lands,
move the outcome to `progress.md` and delete it from `active_context.md`.

Update these at session end, not mid-task, and commit them with the work so the
team's context stays in sync.

## Commands

```bash
npm run dev        # tsx watch, hot reload
npm run build      # tsc + copy-assets (sql/views/public → dist)
npm start          # run the built server
npm run test:run   # single pass — use this, not `npm test` (that watches)
npm run verify     # environment + gap-integrity check
```

`npm run build` is **not** optional before `npm start` — `copy-assets` is what
puts `schema.sql`, `seed.sql`, and the views into `dist/`. A build that skips it
starts a server with no templates.

---

## Definition of done

A change is done when:

1. `npm run test:run` passes — all 14 existing tests, plus any you added.
2. `npm run build` succeeds (this is the typecheck; there is no separate lint).
3. `npm run verify` reports every homework gap still intact.
4. The app actually serves the affected page or endpoint.

State which of these you ran. "Should work" is not done.

---

## Scope

**In scope:** features and fixes inside `src/`, tests under `tests/`, course
documentation, ADRs in `docs/adr/`, and skills in `.claude/skills/`.

**Out of scope — do not introduce a frontend framework.** No React, Vue, Svelte,
or SPA router; no bundler, no client-side build step. The stack is EJS + HTMX on
purpose, and `docs/adr/001-architecture.md` records the trade-off: less "modern
frontend" surface is acceptable because this course is about agents, not frontend
frameworks. If a task seems to need a framework, say so and stop rather than
adding one.

Also out of scope without being asked: schema migrations, new runtime
dependencies, renaming or moving existing files, and reformatting untouched code.

---

## Known inconsistencies

Documented so you don't "fix" them by surprise. Leave them unless asked:

- **README Node version conflicts with itself** — line 25 says Node 24 LTS, line
  82 says Node 20+, `engines` says `>=20`. The app runs fine on 20+.
- **`.gitignore` says `dist/` is committed; it isn't** — the `dist` entry in the
  Nuxt block catches it. Harmless: `postinstall` builds on install.
- **`tests/README.md` has a stale example** — it shows
  `User.createUser(db, 'testuser', 'Test User')`, but the real signature is
  `createUser(username, displayName)`. Never copy that pattern; see rule 2.
