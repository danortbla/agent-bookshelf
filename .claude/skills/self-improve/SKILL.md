---
name: self-improve
description: Turn extracted failure signals from this project's session history into real, evidence-grounded rules in .claude/rules.md. Use when reviewing proposed rules, after running self:extract-insights, when asked what went wrong or what we learned from recent sessions, or when a proposed rule's draft text needs rewriting before approval.
---

# Writing rules from session history

`scripts/self-improve.mjs` finds *signals* — tool errors, interrupts, files the
user corrected right after an agent wrote them. It cannot say what those signals
**mean**. That is this skill's job.

A script counts. Reflection requires reading the code the failure touched and
saying something true about it. Do not skip that reading.

## The pipeline

```
self:extract-insights  → detects patterns, writes PROPOSED rules with draft stubs
   ↓  (you are here)
this skill             → replaces each stub with a real rule
   ↓
self:approve R00N      → goes live, injected on matching prompts
```

## Procedure

### 1. Get the evidence

```bash
npm run self:incidents   # JSON: kind, target, count, sessions, sample
npm run self:score       # per-session quality, worst first
npm run self:status      # what is already proposed or accepted
```

### 2. Investigate before writing

For each pattern, **open the file or command involved.** A rule written from the
incident summary alone will be generic, and a generic rule is noise that costs
context on every matching prompt.

Ask:

- What was the agent actually trying to do?
- What did the project expect that the agent didn't know?
- Is the real fix a *rule*, or a fix to the code or docs? Often it's the latter —
  say so instead of writing a rule.

### 3. Judge whether it deserves a rule

Reject far more than you accept. A rule earns its place only if **all** hold:

- It recurs. One failure is an anecdote.
- It is **specific** — names a file, function, signature, or command.
- It is **actionable** — tells the next agent what to do, not what to avoid feeling.
- It is **not already covered** by `CLAUDE.md`. Duplicating a never-ever rule
  wastes context and splits the source of truth.

❌ "Be careful when editing tests" — generic, unactionable, noise.
✅ "`tests/README.md` shows `createUser(db, …)`; the real signature takes no db
handle. Read the model's signature before writing a test against it."

### 4. Write it into `.claude/rules.md`

Replace the draft body. Keep the metadata block's shape exactly — the parser and
the injector both depend on it:

```markdown
## R00N · Short imperative title

- **state:** proposed
- **created:** YYYY-MM-DD
- **triggers:** comma, separated, keywords
- **evidence:** N incident(s) · kind · session(s) abc12345
- **hits:** 0
- **last-hit:** never

Two or three sentences. What goes wrong, why, and what to do instead.
Name the file or signature.
```

**Triggers decide when the rule loads.** Too broad and it burns context on every
prompt; too narrow and it never fires. Use the words someone would naturally type
when about to make this mistake — not words describing the mistake.

### 5. Hand back, don't self-approve

Report what you wrote and why. Let the user run `self:approve`. Supervised mode
is the default on purpose: a rule that goes live unreviewed is indistinguishable
from a hallucinated instruction injected into every future prompt.

## Hard limits

- Never write a rule targeting `CLAUDE.md`, `.claude/settings.json`, or
  `.claude/hooks/`. `self:approve` refuses them, and rules must never be able to
  rewrite their own guardrails.
- Never edit the lifecycle state of a rule directly — use the commands.
- If the evidence is thin, **say so and write nothing.** "Not enough signal yet"
  is a correct and useful answer. It is always better than a plausible rule
  invented to look productive.
