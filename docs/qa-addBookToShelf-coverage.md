# QA test-generation workflow: `addBookToShelf`

Session 6 deliverable — QA track. Run 2026-10-01 against `src/models/shelf.ts`.

The deck's five steps, as actually executed. The outcome is 11 tests and one
real defect: **declared foreign keys are never enforced at runtime.**

---

## 01 · Pick the function

`Shelf.addBookToShelf(shelfId, bookId)` — from homework gap 2 ("models have no
test coverage"). `review.ts` already had a suite, leaving `user.ts` and
`shelf.ts`.

Chosen over every function in `user.ts` because it is the only one in either
model with a **branch**: a read-then-write guard that returns `false` instead of
inserting. A function with no branch has one behaviour to test; this one has a
decision, and decisions are where defects live.

```ts
export function addBookToShelf(shelfId: number, bookId: number): boolean {
  const existing = get(
    'SELECT 1 FROM shelf_books WHERE shelf_id = ? AND book_id = ?',
    [shelfId, bookId]
  );
  if (existing) return false;
  run('INSERT INTO shelf_books (shelf_id, book_id) VALUES (?, ?)', [shelfId, bookId]);
  return true;
}
```

## 02 · Read the implementation

Three things the signature does not tell you:

1. **The guard is check-then-act in application code**, not a constraint. The
   schema also declares `PRIMARY KEY (shelf_id, book_id)`, so there are two
   independent duplicate defences that could disagree.
2. **`boolean` is overloaded.** `false` means "already there" — not "failed".
   There is no return value for "the shelf does not exist."
3. **No existence checks on either id.** The function trusts the database to
   reject bad references. `schema.sql` declares `FOREIGN KEY` on both columns and
   `src/db/index.ts:29` runs `PRAGMA foreign_keys = ON`, so that trust looks
   well-placed.

Point 3 is the one worth probing, because it is an assumption rather than code.

## 03 · Identify gaps

Probed behaviour directly rather than assuming it:

| Probe | Expected | Actual |
|---|---|---|
| Add a new pair | `true` | `true` ✅ |
| Add the same pair again | `false` | `false` ✅ |
| Add to shelf id 99999 (no such shelf) | constraint error | **`true`, orphan row written** ❌ |
| Add book id 99999 (no such book) | constraint error | **`true`, orphan row written** ❌ |
| `PRAGMA foreign_keys` | `1` | **`0`** ❌ |
| Delete a shelf holding 4 books | cascade to 0 rows | **4 rows remain** ❌ |

## 04 · Root cause

Not the model. `sql.js`'s `export()` closes and reopens the database connection
to read the file out of its virtual filesystem, and `foreign_keys` is a
**per-connection** pragma — reopening reverts it to the default, off.

Demonstrated in isolation:

```
after PRAGMA ON   fk = 1
after db.export() fk = 0   <-- reset by export()
re-applied        fk = 1
```

`saveDb()` calls `db.export()`. `initDb()` calls `saveDb()` on its last line.
So enforcement is off before any model function ever runs — in the app and in
every test.

This is a migration artifact. Under `better-sqlite3` the pragma was set once per
connection and stayed set; `export()` has no equivalent there. It is exactly the
class of bug `CLAUDE.md` warns about under "never bypass the sql.js data layer",
and nothing in the test suite would have caught it, because nothing tested a
constraint.

### Candidate fix, verified but not applied

```diff
 export function saveDb(): void {
   if (db) {
     const data = db.export();
+    db.run("PRAGMA foreign_keys = ON");
     const buffer = Buffer.from(data);
     writeFileSync(dbPath, buffer);
   }
 }
```

Applied experimentally, the full suite went to **45 passed / 3 failed** — the
only failures being this file's three `DEFECT:` tests, which assert today's
broken behaviour. No existing test broke, and the seed data does not violate any
declared constraint.

Reverted, because enabling referential integrity changes application behaviour
(bad writes would start throwing where they now silently succeed) and that is a
decision for the repo owner, not a side effect of writing tests.

## 05 · Review and own

11 tests in `tests/models/shelf.test.ts`:

- 3 happy path — insert, read-back, `added_at` stamping
- 4 duplicate guard — including one for *seeded* rows, so the guard is tested
  against data it did not insert itself
- 1 scoping — the same book on two shelves is allowed, because the pair is the
  unit, not the book
- 3 `DEFECT:` — characterization tests that assert current broken behaviour so
  the suite stays green. **If the fix above lands, invert these to expect a
  thrown constraint error.**

### Mutation-tested

A passing test that cannot fail is worthless, so the suite was checked against
two deliberate mutations of `addBookToShelf`:

| Mutation | Tests failed |
|---|---|
| Remove the duplicate guard entirely | 4 |
| `return true` instead of `false` on duplicate | 2 |

Source restored and verified byte-identical afterwards.

## Re-confirmed, already known

`tests/setup.ts` calls `initDb(TEST_DB_PATH)` without `await` inside a
synchronous `beforeEach` — one of the stale un-awaited examples `CLAUDE.md`
warns about. This is **already recorded** in `memory-bank/progress.md` under
"Actually broken / untidy", decision: leave. Noted here only because writing a
new test file is exactly when someone would copy the pattern. Every model test
file declares its own awaiting `beforeEach`, which masks the global hook's race.
