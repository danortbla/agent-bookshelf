# Troubleshooting

Start here: `npm run verify`. It checks your runtime, build, homework gaps,
hooks, and test suite, and names the failing step. Everything below is organized
by what that command (or the app) tells you.

---

## Setup

### `npm run verify` says "Node.js too old"

You need **Node 20 or newer**. Check with `node -v`.

> The README contradicts itself here — line 25 says Node 24 LTS, line 82 says
> Node 20+. The `engines` field says `>=20`, and that is the real requirement.
> Node 20, 22, and 24 all work.

Install via [nodejs.org](https://nodejs.org), or with nvm:

```bash
nvm install 22 && nvm use 22
```

### `npm run verify` says "Dependencies missing"

```bash
npm install
```

`postinstall` runs `npm run build` automatically, so a successful install also
builds. If install succeeds but the build fails, see the next section.

### `npm install` fails while building native modules

It shouldn't — that's the whole point of the sql.js migration. This project uses
**sql.js** (SQLite compiled to WebAssembly) and has **no native dependencies**,
so you do not need Python, Visual Studio Build Tools, or Xcode.

If you see `node-gyp` errors, you are almost certainly on an old checkout from
before the migration. Pull latest and delete stale state:

```bash
git pull
rm -rf node_modules package-lock.json
npm install
```

---

## Running the app

### `Cannot find module '../dist/server.js'`

The project isn't built. `npx agent-bookshelf` and `npm start` both run compiled
output from `dist/`:

```bash
npm run build
```

### The app starts but every page 500s, or templates aren't found

You ran `tsc` directly instead of `npm run build`. The build is two steps — the
TypeScript compile **and** `copy-assets`, which copies `schema.sql`, `seed.sql`,
`src/views/`, and `src/public/` into `dist/`. A bare `tsc` produces a server with
no templates and no schema.

```bash
npm run build    # always this, never bare tsc
```

### `EADDRINUSE: address already in use :::3000`

Something else holds port 3000. Either free it or pick another — the server
reads `PORT`:

```bash
PORT=3001 npx agent-bookshelf
```

On Windows PowerShell:

```powershell
$env:PORT=3001; npx agent-bookshelf
```

To find the offender on macOS/Linux: `lsof -i :3000`.

### Changes to `src/` don't show up

`npm start` serves the built `dist/`, so it won't pick up edits. Use the watch
mode during development:

```bash
npm run dev
```

### My data disappeared / the database looks wrong

sql.js holds the database **in memory** and writes it to `bookshelf.db` on
shutdown via `closeDb()`. If the process is killed hard (`kill -9`, closing the
terminal window), writes since the last save are lost. Shut down with `Ctrl-C`.

To reset to the seeded 50 books and 3 users, delete the database and restart —
`initDb()` recreates and re-seeds it when the file is absent:

```bash
rm -f bookshelf.db bookshelf.db-shm bookshelf.db-wal
npm start
```

> `bookshelf.db-shm` and `bookshelf.db-wal` are tracked in git but are leftovers
> from the old better-sqlite3 setup — sql.js never writes WAL files. Deleting
> them locally is safe; just don't commit the deletion without asking.

---

## Tests

### `npm test` hangs and never exits

That's watch mode, not a hang. For a single pass:

```bash
npm run test:run
```

### Tests fail with "Database not initialized"

`initDb()` is **async**. It was synchronous before the sql.js migration, so older
examples call it without `await`. In test setup it must be awaited:

```ts
beforeEach(async () => {
  await initDb(TEST_DB_PATH);
});
```

### My new model test fails with "expected 1 argument, got 3"

The example in `tests/README.md` is stale. It shows
`User.createUser(db, 'testuser', 'Test User')`, but models don't take a database
handle — they read module state set by `initDb()`. The real signature is:

```ts
User.createUser('testuser', 'Test User');
```

---

## Claude Code / workspace

### `claude --version` isn't found

```bash
npm install -g @anthropic-ai/claude-code
```

### The agent doesn't seem to follow the project rules

Confirm `CLAUDE.md` is actually loaded — run `/context` and look for it in the
listed files. It loads automatically from the project root when you start Claude
Code **in this directory**. Starting from a parent directory won't pick it up.

### `npm run verify` says the hook didn't block

The hook is `.claude/hooks/protect-gaps.mjs`, wired up in `.claude/settings.json`
under `PreToolUse`. Check that:

1. Both files exist and `settings.json` parses (`npm run verify` reports this).
2. The file is executable: `chmod +x .claude/hooks/protect-gaps.mjs`.
3. You restarted Claude Code — `settings.json` is read at session start, so hook
   changes don't take effect mid-session.

### An edit was blocked with "BLOCKED: this edit removes N homework-gap marker(s)"

Working as designed. Homework gaps are this repo's product; the hook enforces
what `CLAUDE.md` rule 1 states. If you genuinely mean to retire a gap, use the
`new-homework-gap` skill so the README entries get updated too.

### `npm run verify` warns "More markers in code than README entries"

Someone added a gap in code without documenting it in README.md's
**Homework Gaps** list. A gap students can't find isn't an assignment — add the
entry, or use the `new-homework-gap` skill.

---

## Still stuck?

Collect this before asking for help:

```bash
node -v && npm -v && git log --oneline -1 && npm run verify
```
