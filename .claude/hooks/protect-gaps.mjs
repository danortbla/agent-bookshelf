#!/usr/bin/env node
/**
 * PreToolUse hook — protects deliberate homework gaps.
 *
 * CLAUDE.md rule 1 says "never fill in or remove a homework gap." A rule in a
 * markdown file is soft enforcement; this hook is hard enforcement. It blocks
 * any Edit/Write that would delete a gap marker from the codebase.
 *
 * It fires ONLY when a marker count actually drops, so ordinary edits to a file
 * that happens to contain a gap pass straight through.
 *
 * Exit codes: 0 = allow, 2 = block (stderr is shown to the agent).
 */

import { readFileSync, existsSync } from 'node:fs';

const MARKER = /deliberate homework gap/gi;

const count = (s) => ((s ?? '').match(MARKER) || []).length;

const read = (p) => {
  try {
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
  } catch {
    return '';
  }
};

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // Malformed input is not our problem — don't wedge the session.
}

const tool = payload.tool_name ?? '';
const input = payload.tool_input ?? {};
const file = input.file_path ?? '';

if (!/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool) || !file) process.exit(0);

let before = 0;
let after = 0;

if (tool === 'Write') {
  before = count(read(file));
  after = count(input.content);
} else if (Array.isArray(input.edits)) {
  // MultiEdit: compare the whole batch.
  before = input.edits.reduce((n, e) => n + count(e.old_string), 0);
  after = input.edits.reduce((n, e) => n + count(e.new_string), 0);
} else {
  before = count(input.old_string);
  after = count(input.new_string);
}

if (after < before) {
  const removed = before - after;
  process.stderr.write(
    `BLOCKED: this edit removes ${removed} homework-gap marker(s) from ${file}.\n\n` +
      `Homework gaps are this repo's product, not a backlog (CLAUDE.md rule 1).\n` +
      `The TODO comment is what tells a student's agent the gap is deliberate.\n\n` +
      `If you were asked to implement this gap, implement the behavior but LEAVE\n` +
      `the marker comment in place, and tell the user the gap is now solved so\n` +
      `they can retire it deliberately via the new-homework-gap skill.\n`
  );
  process.exit(2);
}

process.exit(0);
