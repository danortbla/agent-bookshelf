# Tech Context

> **Tier:** Semantic memory · **Update:** on stack or tooling changes
> Stack, dev setup, and the decisions behind them. Rules live in `CLAUDE.md`;
> this file explains *why* those rules exist.

## Stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js, ESM (`"type": "module"`) | ≥20 |
| Language | TypeScript, NodeNext resolution | 5.7 |
| Server | Express | 4.21 |
| Database | SQLite via **sql.js** (WebAssembly) | 1.12 |
| Views | EJS + HTMX (vendored) | 3.1 / 1.9 |
| Tests | Vitest + supertest | 2.1 / 7.0 |

No linter, no formatter. `npm run build` (tsc) is the typecheck.

## The decision that shapes everything: sql.js

**2026-09-16 — migrated from better-sqlite3 to sql.js.**

better-sqlite3 is a native module. On Windows it needs Visual Studio Build Tools,
and students were losing the first half of a session to `node-gyp` errors. That
is unacceptable for a 30-minute teaching slot, so the database moved to SQLite
compiled to WebAssembly.

**What it bought:** zero native dependencies, identical install on all three OSes.

**What it cost — the consequences that still bite:**

1. **`initDb()` became async.** It was synchronous before. Anything calling it
   without `await` is stale code.
2. **The whole database lives in WASM memory.** It is written to disk only by
   `saveDb()`, which today only `closeDb()` calls. A hard kill loses recent
   writes; `Ctrl-C` is clean.
3. **Query results lost their types.** The helpers return
   `Record<string, unknown>`, so every model function casts through
   `as unknown as T`. Ugly, but contained to the model layer.
4. **WAL files are meaningless now.** sql.js exports the entire database as a
   buffer. `bookshelf.db-shm` and `bookshelf.db-wal` are tracked leftovers from
   the old engine — see `progress.md`.

## Data access

`src/db/index.ts` exposes the only sanctioned entry points:

```
initDb(path?)  async · create/open, apply schema, seed if empty, save
get(sql, params)   → one row or undefined
all(sql, params)   → array of rows
run(sql, params)   → { changes, lastInsertRowid }
saveDb()           → export WASM memory to disk
closeDb()          → save, then close
```

Models use `get` / `all` / `run` only. They never call `getDb()` and never accept
a database handle as a parameter — `initDb()` sets module state.

## Conventions that break things silently

- **Relative imports need `.js`**, even for `.ts` sources (NodeNext ESM).
- **Literal routes before parameterized ones** — `/books/search` must precede
  `/books/:id`, or `"search"` parses as an id.
- **`npm run build`, never bare `tsc`** — `copy-assets` is what puts
  `schema.sql`, `seed.sql`, `views/`, and `public/` into `dist/`. A bare `tsc`
  yields a server with no templates.
- **HTML routes return HTMX fragments; `api.ts` returns JSON.** Don't mix.

## Dev setup

```bash
npm install        # postinstall builds automatically
npm run dev        # tsx watch, hot reload
npm run verify     # environment + gaps + hooks + tests
npm run test:run   # single pass (npm test watches)
```

Server reads `PORT`, defaults to 3000.

## Agent workspace

Per the course's three-layer model — Core runs, Config directs, Skills inform:

| Layer | Here |
|---|---|
| Config | `CLAUDE.md`, `.claude/settings.json` |
| Enforcement | `.claude/hooks/protect-gaps.mjs` (PreToolUse) |
| Skills | `.claude/skills/new-homework-gap/` |
| Memory | `memory-bank/` (this directory) |

> ⚠️ The course deck writes hook matchers in kebab-case (`post-tool-use`).
> Claude Code actually expects PascalCase event names (`PreToolUse`,
> `PostToolUse`) with a nested `hooks` array. `.claude/settings.json` uses the
> working format; `npm run verify` proves it fires.
