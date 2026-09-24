#!/usr/bin/env node
/**
 * PreToolUse hook — protects deliberate homework gaps.
 *
 * CLAUDE.md rule 1 says "never fill in or remove a homework gap." A rule in a
 * markdown file is soft enforcement; this hook is hard enforcement.
 *
 * Two surfaces:
 *   Edit/Write/MultiEdit — compare marker counts before and after.
 *   Bash                 — detect shell writes aimed at a file holding a marker.
 *
 * The Bash path exists because structured edits are not the only way to change a
 * file. `sed -i`, redirects, tee, and heredocs all bypass a tool-payload check.
 * It matches on a write operator whose TARGET is a guarded file, so reads of a
 * guarded file (cat, grep, even `grep x guarded.ts > /tmp/out`) pass through.
 *
 * Exit codes: 0 = allow, 2 = block (stderr is shown to the agent).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKER = /deliberate homework gap/gi;
const SCAN_DIRS = ['src', 'tests'];

const count = (s) => ((s ?? '').match(MARKER) || []).length;
const read = (p) => {
  try { return existsSync(p) ? readFileSync(p, 'utf8') : ''; } catch { return ''; }
};

/* --------------------------------------------------------- guarded file list */

function guardedFiles() {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      const full = join(dir, e);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (/\.(ts|js|mjs|ejs|css|sql|md)$/.test(e) && count(read(full))) out.push(full);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return out;
}

/* ------------------------------------------------------------ bash inspection */

// Each pattern captures the TARGET of a write.
const WRITE_TARGETS = [
  />>?\s*["']?([^\s"'|;&>]+)/g,                          // > file   >> file
  /\btee\s+(?:-a\s+)?["']?([^\s"'|;&]+)/g,               // tee file
  /\b(?:mv|cp)\s+(?:-\w+\s+)*[^\s]+\s+["']?([^\s"'|;&]+)/g,
  /\brm\s+(?:-\w+\s+)*["']?([^\s"'|;&]+)/g,
  /\btruncate\b[^|;&]*?["']?([^\s"'|;&]+)/g,
  /open\(\s*["']([^"']+)["']\s*,\s*["'][wa]/g,           // python open(p,'w')
  /writeFileSync\(\s*["']([^"']+)["']/g,                 // node fs write
];

// In-place editors (sed -i, perl -i) rewrite whichever file arguments they are
// given, and their flag syntax varies by platform (GNU `-i`, BSD `-i ''`).
// Rather than parse that, treat every token in such a command as a candidate.
const INPLACE = /\b(?:sed|perl)\b[^|;&]*?\s-i/;

function bashHits(command, guarded) {
  const guardedAbs = new Set(guarded.map((f) => resolve(f)));
  const hits = new Set();

  if (INPLACE.test(command)) {
    for (const tok of command.split(/[\s'"]+/)) {
      if (!tok) continue;
      const abs = resolve(tok.startsWith('/') ? tok : join(ROOT, tok));
      if (guardedAbs.has(abs)) hits.add(relative(ROOT, abs));
    }
  }
  for (const re of WRITE_TARGETS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(command))) {
      const target = m[1];
      if (!target) continue;
      const abs = resolve(target.startsWith('/') ? target : join(ROOT, target));
      if (guardedAbs.has(abs)) hits.add(relative(ROOT, abs));
    }
  }
  return [...hits];
}

/* ---------------------------------------------------------------------- main */

let raw = '';
for await (const chunk of process.stdin) raw += chunk;

let payload;
try { payload = JSON.parse(raw); } catch { process.exit(0); }

const tool = payload.tool_name ?? '';
const input = payload.tool_input ?? {};

/* ---- Bash surface ---- */
if (tool === 'Bash') {
  const command = input.command ?? '';
  if (!command) process.exit(0);
  const hits = bashHits(command, guardedFiles());
  if (hits.length) {
    process.stderr.write(
      `BLOCKED: this shell command writes to ${hits.join(', ')}, which holds a homework-gap marker.\n\n` +
        `Homework gaps are this repo's product, not a backlog (CLAUDE.md rule 1).\n` +
        `Shell writes bypass the structured-edit guard, so they are blocked outright here.\n\n` +
        `Use the Edit tool instead — it checks whether the marker survives the change.\n` +
        `To retire the gap on purpose, use the new-homework-gap skill.\n`
    );
    process.exit(2);
  }
  process.exit(0);
}

/* ---- structured-edit surface ---- */
const file = input.file_path ?? '';
if (!/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool) || !file) process.exit(0);

let before = 0;
let after = 0;

if (tool === 'Write') {
  before = count(read(file));
  after = count(input.content);
} else if (Array.isArray(input.edits)) {
  before = input.edits.reduce((n, e) => n + count(e.old_string), 0);
  after = input.edits.reduce((n, e) => n + count(e.new_string), 0);
} else {
  before = count(input.old_string);
  after = count(input.new_string);
}

if (after < before) {
  process.stderr.write(
    `BLOCKED: this edit removes ${before - after} homework-gap marker(s) from ${file}.\n\n` +
      `Homework gaps are this repo's product, not a backlog (CLAUDE.md rule 1).\n` +
      `The TODO comment is what tells a student's agent the gap is deliberate.\n\n` +
      `If you were asked to implement this gap, implement the behavior but LEAVE\n` +
      `the marker comment in place, and tell the user the gap is now solved so\n` +
      `they can retire it deliberately via the new-homework-gap skill.\n`
  );
  process.exit(2);
}

process.exit(0);
