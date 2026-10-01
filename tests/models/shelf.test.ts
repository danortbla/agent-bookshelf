import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb, all, get } from '../../src/db/index.js';
import * as Shelf from '../../src/models/shelf.js';

beforeEach(async () => {
  await initDb('/tmp/test-shelf-model.db');
});

afterEach(() => {
  closeDb();
  const fs = require('fs');
  try {
    fs.unlinkSync('/tmp/test-shelf-model.db');
  } catch (e) {
    // ignore
  }
});

// Seed layout this suite relies on:
//   shelves 1-3 -> alice (want-to-read, currently-reading, read)
//   shelves 4-6 -> bob,  shelves 7-9 -> carol
//   shelf 1 holds books 31, 32 · shelf 2 holds book 28 · shelf 3 holds books 1, 2, 16
const ALICE_WANT_TO_READ = 1;
const ALICE_READ = 3;
const BOB_READ = 6;

const rowsFor = (shelfId: number, bookId: number) =>
  all('SELECT * FROM shelf_books WHERE shelf_id = ? AND book_id = ?', [shelfId, bookId]);

describe('Shelf Model', () => {
  describe('addBookToShelf', () => {
    // --- happy path -------------------------------------------------------

    it('adds a book to a shelf and reports success', () => {
      expect(Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5)).toBe(true);
      expect(rowsFor(ALICE_WANT_TO_READ, 5)).toHaveLength(1);
    });

    it('makes the book visible through getShelfWithBooks', () => {
      Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5);

      const shelf = Shelf.getShelfWithBooks(ALICE_WANT_TO_READ);
      expect(shelf?.books.map((b) => b.book_id)).toContain(5);
    });

    it('stamps added_at so shelf contents can be ordered by recency', () => {
      Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5);

      const row = get(
        'SELECT added_at FROM shelf_books WHERE shelf_id = ? AND book_id = ?',
        [ALICE_WANT_TO_READ, 5]
      );
      expect(row?.added_at).toBeTruthy();
    });

    // --- the duplicate guard, which is the function's only branch ---------

    it('returns false when the pair is already present', () => {
      Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5);

      expect(Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5)).toBe(false);
    });

    it('does not insert a second row on a repeat add', () => {
      Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5);
      Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5);
      Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5);

      expect(rowsFor(ALICE_WANT_TO_READ, 5)).toHaveLength(1);
    });

    it('counts seeded rows as already present', () => {
      // book 1 is on shelf 3 straight from seed.sql — the guard must see rows
      // it did not insert itself, not just ones added during this session.
      expect(Shelf.addBookToShelf(ALICE_READ, 1)).toBe(false);
    });

    // --- scoping: the pair is the unit, not the book ----------------------

    it('scopes the duplicate check to one shelf, so the same book can sit on two', () => {
      expect(Shelf.addBookToShelf(ALICE_WANT_TO_READ, 5)).toBe(true);
      expect(Shelf.addBookToShelf(BOB_READ, 5)).toBe(true);

      expect(rowsFor(ALICE_WANT_TO_READ, 5)).toHaveLength(1);
      expect(rowsFor(BOB_READ, 5)).toHaveLength(1);
    });

    it('leaves a shelf untouched when the add is rejected', () => {
      const before = Shelf.getShelfWithBooks(ALICE_READ)?.books.length;
      Shelf.addBookToShelf(ALICE_READ, 1); // already there -> false

      expect(Shelf.getShelfWithBooks(ALICE_READ)?.books.length).toBe(before);
    });

    // --- DEFECT: referential integrity is not enforced --------------------
    //
    // These three tests assert what the code does today, not what it should do.
    // schema.sql declares FOREIGN KEY on both columns and src/db/index.ts:29
    // runs `PRAGMA foreign_keys = ON`, so the intent is clearly that these be
    // rejected. They are not, because sql.js's db.export() closes and reopens
    // the connection, and foreign_keys is a per-connection pragma. saveDb()
    // calls export(), initDb() calls saveDb() on its last line — so enforcement
    // is already off before any model function runs.
    //
    // See docs/qa-addBookToShelf-coverage.md. When that is fixed, these three
    // tests should be inverted to expect a thrown constraint error.

    it('DEFECT: accepts a shelf_id that does not exist, creating an orphan row', () => {
      expect(Shelf.addBookToShelf(99999, 1)).toBe(true);
      expect(rowsFor(99999, 1)).toHaveLength(1);
    });

    it('DEFECT: accepts a book_id that does not exist, creating an orphan row', () => {
      expect(Shelf.addBookToShelf(ALICE_WANT_TO_READ, 99999)).toBe(true);
      expect(rowsFor(ALICE_WANT_TO_READ, 99999)).toHaveLength(1);
    });

    it('DEFECT: deleting a shelf strands its shelf_books rows instead of cascading', () => {
      const before = all('SELECT * FROM shelf_books WHERE shelf_id = ?', [ALICE_READ]).length;
      expect(before).toBeGreaterThan(0);

      Shelf.deleteShelf(ALICE_READ);

      // ON DELETE CASCADE is declared in schema.sql but never fires.
      expect(all('SELECT * FROM shelf_books WHERE shelf_id = ?', [ALICE_READ])).toHaveLength(before);
    });
  });
});
