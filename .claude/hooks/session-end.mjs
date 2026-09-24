#!/usr/bin/env node
/**
 * Stop hook — closes the self-improvement loop.
 *
 * This is the only event that fires without anyone remembering to do anything,
 * so it is where the loop's automatic half lives:
 *
 *   1. Runs rule extraction (throttled — transcripts are large).
 *   2. Nudges the memory-bank ritual when episodic memory has gone stale.
 *
 * It never blocks: always exits 0, and any failure is swallowed.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STATE = join(ROOT, '.claude/.self-improve-state.json');
const EXTRACT_EVERY_H = 6;   // transcripts change slowly; no need to rescan constantly
const NUDGE_EVERY_H = 20;    // at most one memory nudge per working day
const STALE_DAYS = 3;

const now = Date.now();
const hoursSince = (t) => (t ? (now - t) / 3600000 : Infinity);

const load = () => {
  try { return JSON.parse(readFileSync(STATE, 'utf8')); } catch { return {}; }
};
const save = (s) => {
  try { writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n'); } catch { /* best effort */ }
};

try {
  const state = load();
  const notes = [];

  /* ---- 1. extraction, throttled ---- */
  if (hoursSince(state.lastExtract) >= EXTRACT_EVERY_H) {
    const r = spawnSync(process.execPath, [join(ROOT, 'scripts/self-improve.mjs'), 'extract'], {
      encoding: 'utf8',
      timeout: 30000,
    });
    state.lastExtract = now;
    const out = `${r.stdout || ''}`;
    const m = out.match(/Proposed (\d+) rule\(s\)/);
    if (m && Number(m[1]) > 0) {
      notes.push(`${m[1]} new rule(s) proposed in .claude/rules.md — review with: npm run self:status`);
    }
  }

  /* ---- 2. memory-bank staleness ---- */
  if (hoursSince(state.lastNudge) >= NUDGE_EVERY_H) {
    const ac = join(ROOT, 'memory-bank/active_context.md');
    if (existsSync(ac)) {
      const d = readFileSync(ac, 'utf8').match(/\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
      const days = d ? Math.floor((now - Date.parse(d[1])) / 86400000) : 999;
      if (days >= STALE_DAYS) {
        notes.push(
          `memory-bank/active_context.md is ${days} day(s) old. ` +
            `Run the ritual: "Summarize this session's decisions and update the memory bank."`
        );
        state.lastNudge = now;
      }
    }
  }

  save(state);
  if (notes.length) process.stdout.write(`\nSelf-improvement:\n${notes.map((n) => `  • ${n}`).join('\n')}\n`);
} catch {
  /* never interfere with stopping */
}
process.exit(0);
