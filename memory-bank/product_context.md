# Product Context

> **Tier:** Semantic memory · **Update:** when assignments or personas change
> User stories and the reasoning behind the homework design.

## The domain

A reader tracks books. They put a book on one of three shelves
(want-to-read, currently-reading, read) and optionally review it with a 1–5
rating. That's the whole domain — deliberately small enough to hold in your head
so students think about *directing the agent*, not about business rules.

**Data model:** `books`, `users`, `shelves`, `shelf_books`, `reviews` (5 tables).
Seeded with 50 books (tech + sci-fi), 3 users (Alice Chen, Bob Martinez,
Carol Okafor), and sample shelves and reviews.

## User stories that work today

- Browse all 50 books on the index page.
- Open a book and see its details, reviews, and average rating.
- Add a review with a rating — duplicate reviews per user/book are rejected (409).
- View a user's shelves and the books on them.
- Drive all of the above over the JSON API at `/api/*`.

## Stories that are deliberately incomplete

These are the assignments. **Do not implement them unasked** — see `CLAUDE.md`
rule 1.

| # | Story | Where | Assigned to |
|---|---|---|---|
| 1 | "As a reader, I search books by title or author" | `src/routes/books.ts` | Developer |
| 2 | "As a maintainer, I trust the models are covered" | `tests/` | QA |
| 3 | "As an API consumer, I get useful validation errors" | `src/routes/api.ts` | Developer |
| 4 | "As a reader, the app looks like something I'd use" | `src/public/css/style.css` | PM / Design |

### Why these four

They cover different **kinds** of agent direction, which is the actual
curriculum:

- **Search** is wiring — the UI is live, `searchBooks()` already exists at
  `src/models/book.ts:22`. Tests the student's ability to give precise,
  bounded instructions.
- **Tests** are volume work with a measurable exit criterion. Tests whether a
  student can define "done."
- **Validation** is judgment — there is no single right answer about what to
  validate. Tests specification skill.
- **CSS** is taste, with no test to lean on. Tests whether a student can
  describe an outcome rather than a procedure.

## Difficulty calibration

The house rule, derived from the search gap: **leave the hard part done, gap the
wiring.** `searchBooks()` is implemented; only the route is missing. A gap that
needs a schema migration is a different and much harder assignment — and should
be a deliberate choice, not an accident.

A gap must be:
- reachable from the running app (a student can see it),
- gracefully degraded (never a crash or a 404),
- documented in README's **Homework Gaps** list,
- solvable without touching `schema.sql`.

## Non-users

Nobody runs this in production, nobody stores real data in it, and no student
shares an instance with another. Every instance is one person on localhost. That
assumption is what justifies having no auth and no migrations — if it ever stops
being true, most of `project_brief.md`'s out-of-scope list has to be revisited.
