#!/usr/bin/env node
/**
 * Workspace verification for Agent Bookshelf.
 *
 * Confirms a student's environment is set up, the homework gaps are intact,
 * and the hooks actually fire. Run: npm run verify
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = process.stdout.isTTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[2m', x: '\x1b[0m' }
  : { g: '', r: '', y: '', d: '', x: '' };

let failed = 0;
let warned = 0;

const pass = (label, detail = '') =>
  console.log(`  ${C.g}✓${C.x} ${label}${detail ? ` ${C.d}${detail}${C.x}` : ''}`);
const warn = (label, detail = '') => {
  warned++;
  console.log(`  ${C.y}!${C.x} ${label}${detail ? ` ${C.d}${detail}${C.x}` : ''}`);
};
const fail = (label, detail = '') => {
  failed++;
  console.log(`  ${C.r}✗${C.x} ${label}${detail ? ` ${C.d}${detail}${C.x}` : ''}`);
};
const section = (name) => console.log(`\n${name}`);

const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), 'utf8');
  } catch {
    return '';
  }
};

const walk = (dir, out = []) => {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = `${dir}/${e}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

console.log(`\n${C.d}Agent Bookshelf — workspace verification${C.x}`);

/* ---------------------------------------------------------------- 1. runtime */
section('Runtime');

const major = Number(process.versions.node.split('.')[0]);
if (major >= 20) pass('Node.js', `v${process.versions.node}`);
else fail('Node.js too old', `v${process.versions.node} — need >=20`);

if (existsSync(join(ROOT, 'node_modules/express'))) pass('Dependencies installed');
else fail('Dependencies missing', 'run: npm install');

/* ------------------------------------------------------------ 2. build assets */
section('Build');

for (const f of ['src/db/schema.sql', 'src/db/seed.sql']) {
  if (existsSync(join(ROOT, f))) pass(f);
  else fail(`${f} missing`);
}

if (existsSync(join(ROOT, 'dist/server.js'))) {
  const missing = ['dist/views', 'dist/db/schema.sql', 'dist/db/seed.sql'].filter(
    (f) => !existsSync(join(ROOT, f))
  );
  if (missing.length === 0) pass('dist/ complete', 'server + views + sql');
  else fail('dist/ incomplete', `missing ${missing.join(', ')} — run: npm run build`);
} else {
  warn('dist/ not built', 'run: npm run build (needed for npm start)');
}

/* ------------------------------------------------------------ 3. homework gaps */
section('Homework gaps');

const MARKER = /deliberate homework gap/i;
const codeGaps = walk('src')
  .filter((f) => /\.(ts|ejs|css)$/.test(f))
  .filter((f) => MARKER.test(read(f)));

if (codeGaps.length > 0) pass(`${codeGaps.length} gap marker(s) in src/`, codeGaps.join(', '));
else fail('No gap markers found in src/', 'gaps may have been filled in — check git log');

const readme = read('README.md');
const gapSection = readme.split('### Homework Gaps')[1]?.split(/\n###\s/)[0] ?? '';
const documented = (gapSection.match(/^\d+\.\s+\*\*/gm) || []).length;

if (documented > 0) pass(`${documented} gap(s) documented in README.md`);
else fail('README.md has no "Homework Gaps" entries');

if (documented > 0 && codeGaps.length > documented) {
  warn('More markers in code than README entries', 'document the new gap(s)');
}

const testsReadme = read('tests/README.md');
if (/What's Missing \(Homework Gaps\)/.test(testsReadme)) pass('tests/README.md documents gaps');
else warn('tests/README.md missing its gap section');

/* ------------------------------------------------------------ 4. memory bank */
section('Memory bank');

const BANK = [
  'project_brief.md',
  'product_context.md',
  'tech_context.md',
  'active_context.md',
  'progress.md',
];

const missingBank = BANK.filter((f) => !existsSync(join(ROOT, 'memory-bank', f)));
if (missingBank.length === 0) pass('All 5 memory-bank files present');
else fail(`memory-bank incomplete`, `missing ${missingBank.join(', ')}`);

const oversized = BANK.filter((f) => read(`memory-bank/${f}`).split('\n').length > 200);
if (oversized.length === 0) pass('All under 200 lines');
else warn('Over 200 lines', oversized.join(', '));

// Episodic files should carry a recent date so stale memory is visible.
for (const f of ['active_context.md', 'progress.md']) {
  const m = read(`memory-bank/${f}`).match(/\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    warn(`${f} has no "Last updated" date`);
    continue;
  }
  const days = Math.floor((Date.now() - Date.parse(m[1])) / 86400000);
  if (days <= 30) pass(`${f} current`, `updated ${m[1]}`);
  else warn(`${f} may be stale`, `last updated ${m[1]} (${days}d ago)`);
}

/* ------------------------------------------------------------------ 5. hooks */
section('Hooks');

const settingsRaw = read('.claude/settings.json');
let settings = null;
if (!settingsRaw) {
  fail('.claude/settings.json missing');
} else {
  try {
    settings = JSON.parse(settingsRaw);
    pass('.claude/settings.json parses');
  } catch (e) {
    fail('.claude/settings.json is invalid JSON', e.message);
  }
}

const hookPath = join(ROOT, '.claude/hooks/protect-gaps.mjs');
if (existsSync(hookPath)) {
  pass('protect-gaps hook present');

  // Fire the hook for real: a payload that deletes a marker must be blocked,
  // and a benign payload must pass. This is the "hooks responding" check.
  const fire = (toolInput) =>
    spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: toolInput,
      }),
      encoding: 'utf8',
    });

  const blocked = fire({
    file_path: 'src/routes/books.ts',
    old_string: '// This is a deliberate homework gap - agents should implement it',
    new_string: '// implemented',
  });
  if (blocked.status === 2) pass('hook blocks gap removal', 'exit 2');
  else fail('hook did NOT block gap removal', `exit ${blocked.status}`);

  const allowed = fire({
    file_path: 'src/routes/books.ts',
    old_string: 'const router = Router();',
    new_string: 'const router = Router(); // note',
  });
  if (allowed.status === 0) pass('hook allows ordinary edits', 'exit 0');
  else fail('hook wrongly blocked an ordinary edit', `exit ${allowed.status}`);
  // Bash surface: shell writes to a guarded file must be blocked, reads must not.
  const fireBash = (command) =>
    spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }),
      encoding: 'utf8',
    });

  const guarded = codeGaps[0] || 'src/routes/books.ts';
  const inPlace = ['sed', '-i', "''", "'s/x/y/'", guarded].join(' ');
  const shellWrite = fireBash(inPlace);
  if (shellWrite.status === 2) pass('hook blocks shell writes to a gap file', 'in-place edit');
  else fail('hook did NOT block a shell write', `exit ${shellWrite.status}`);

  const shellRead = fireBash(`grep -n TODO ${guarded} > /tmp/verify-out.txt`);
  if (shellRead.status === 0) pass('hook allows shell reads of a gap file', 'redirect elsewhere');
  else fail('hook wrongly blocked a shell read', `exit ${shellRead.status}`);
} else {
  fail('.claude/hooks/protect-gaps.mjs missing');
}

const stopHook = join(ROOT, '.claude/hooks/session-end.mjs');
if (existsSync(stopHook)) {
  const r = spawnSync(process.execPath, [stopHook], {
    input: JSON.stringify({ hook_event_name: 'Stop' }),
    encoding: 'utf8',
    timeout: 40000,
  });
  if (r.status === 0) pass('session-end (Stop) hook runs', 'never blocks');
  else fail('session-end hook failed', `exit ${r.status}`);
} else {
  fail('.claude/hooks/session-end.mjs missing');
}

const CMDS = ['commit.md', 'review.md', 'debug.md'];
const missingCmds = CMDS.filter((f) => !existsSync(join(ROOT, '.claude/commands', f)));
if (missingCmds.length === 0) pass('slash commands present', CMDS.map((c) => '/' + c.replace('.md', '')).join(' '));
else warn('slash commands missing', missingCmds.join(', '));

if (existsSync(join(ROOT, '.claude/skills/self-improve/SKILL.md'))) pass('self-improve skill present');
else warn('self-improve skill missing');

/* --------------------------------------------------- 6. self-improvement loop */
section('Self-improvement');

const rulesRaw = read('.claude/rules.md');
if (!rulesRaw) {
  fail('.claude/rules.md missing');
} else {
  const blocks = rulesRaw.split(/\n## /).slice(1).filter((b) => /^R\d+\s+·/.test(b));
  const by = (st) => blocks.filter((b) => new RegExp(`^- \\*\\*state:\\*\\*\\s*${st}\\s*$`, 'm').test(b)).length;
  pass('rules.md parses', `${blocks.length} rule(s): ${by('accepted')} accepted, ${by('proposed')} proposed, ${by('archived')} archived`);

  const injector = join(ROOT, '.claude/hooks/inject-rules.mjs');
  if (!existsSync(injector)) {
    fail('inject-rules hook missing');
  } else {
    const fireInject = (prompt) =>
      spawnSync(process.execPath, [injector], {
        input: JSON.stringify({ prompt }),
        encoding: 'utf8',
        env: { ...process.env, RULES_DRY_RUN: '1' },
      });

    // Pull a real trigger word off the first accepted rule, if there is one.
    const accepted = blocks.find((b) => /^- \*\*state:\*\*\s*accepted\s*$/m.test(b));
    const trigger = accepted?.match(/^- \*\*triggers:\*\*\s*([^,\n]+)/m)?.[1]?.trim();

    if (trigger) {
      const hit = fireInject(`please help me with ${trigger}`);
      if (hit.status === 0 && hit.stdout.includes('Learned rules')) pass('injector fires on a matching prompt', `trigger "${trigger}"`);
      else fail('injector did not fire on a matching prompt', `trigger "${trigger}"`);
    } else {
      warn('No accepted rules yet', 'injector match path not exercised');
    }

    const miss = fireInject('qqzzxx nonsense prompt with no triggers');
    if (miss.status === 0 && !miss.stdout.trim()) pass('injector silent on unrelated prompts');
    else fail('injector emitted output for an unrelated prompt');
  }
}

/* ------------------------------------------------------------------ 7. tests */
section('Tests');

const vitest = spawnSync('npx', ['vitest', 'run', '--reporter=dot'], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const out = `${vitest.stdout ?? ''}${vitest.stderr ?? ''}`;
const tally = out.match(/Tests\s+(\d+)\s+passed/);

if (vitest.status === 0) pass('Test suite passes', tally ? `${tally[1]} tests` : '');
else fail('Test suite failing', 'run: npm run test:run');

/* ----------------------------------------------------------------- summary */
const label = failed > 0 ? `${C.r}${failed} failed${C.x}` : `${C.g}all green${C.x}`;
console.log(`\n${label}${warned ? ` ${C.y}· ${warned} warning(s)${C.x}` : ''}\n`);

process.exit(failed > 0 ? 1 : 0);
