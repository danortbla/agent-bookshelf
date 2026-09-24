#!/usr/bin/env node
/**
 * UserPromptSubmit hook — injects ACCEPTED learned rules into context.
 *
 * Only rules whose triggers match the prompt are injected, so context cost stays
 * proportional to relevance and "no hits in 60 days" stays meaningful.
 *
 * Injected rules are visible context, not hidden instructions: they appear in the
 * transcript, they say where they came from, and CLAUDE.md outranks them.
 *
 * This hook must never break a prompt. Any failure exits 0 silently.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES = join(ROOT, '.claude/rules.md');
const MAX_INJECTED = 5;

try {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const prompt = (JSON.parse(raw || '{}').prompt || '').toLowerCase();
  if (!prompt || !existsSync(RULES)) process.exit(0);

  const file = readFileSync(RULES, 'utf8');
  const marker = file.indexOf('<!-- RULES BELOW');
  if (marker === -1) process.exit(0);

  const blocks = file.slice(marker).split(/\n## /).slice(1);
  const matched = [];

  for (const chunk of blocks) {
    const head = chunk.split('\n')[0];
    const m = head.match(/^(R\d+)\s+·\s+(.*)$/);
    if (!m) continue;
    if (!/^- \*\*state:\*\*\s*accepted\s*$/m.test(chunk)) continue;

    const trig = (chunk.match(/^- \*\*triggers:\*\*\s*(.*)$/m)?.[1] || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!trig.some((t) => prompt.includes(t))) continue;

    const body = chunk
      .split('\n')
      .filter((l) => !/^- \*\*/.test(l) && l.trim())
      .slice(1)
      .join(' ')
      .slice(0, 400);

    matched.push({ id: m[1], title: m[2].trim(), body });
    if (matched.length >= MAX_INJECTED) break;
  }

  if (!matched.length) process.exit(0);

  // Record hits so unused rules become visible to `npm run self:status`.
  // RULES_DRY_RUN lets `npm run verify` exercise this hook without inflating counts.
  try {
    if (process.env.RULES_DRY_RUN) throw new Error('dry-run');
    const today = new Date().toISOString().slice(0, 10);
    let updated = file;
    for (const r of matched) {
      const re = new RegExp(`(## ${r.id} · [^\\n]*\\n[\\s\\S]*?)- \\*\\*hits:\\*\\* (\\d+)([\\s\\S]*?)- \\*\\*last-hit:\\*\\* [^\\n]*`);
      updated = updated.replace(re, (_, a, n, c) => `${a}- **hits:** ${Number(n) + 1}${c}- **last-hit:** ${today}`);
    }
    if (updated !== file) writeFileSync(RULES, updated);
  } catch { /* hit tracking is best-effort */ }

  process.stdout.write(
    `Learned rules matching this prompt (from .claude/rules.md — advisory; CLAUDE.md takes precedence):\n\n` +
      matched.map((r) => `- **${r.id} ${r.title}** — ${r.body}`).join('\n') +
      `\n`
  );
} catch {
  /* never break a prompt */
}
process.exit(0);
