#!/usr/bin/env node
/**
 * Self-improvement loop for Agent Bookshelf.
 *
 *   extract  — scan this project's session transcripts for failure signals and
 *              propose rules from them
 *   status   — list rules by state, flag accepted-but-unused ones
 *   approve  — proposed -> accepted (refuses rules touching protected paths)
 *   reject   — proposed -> archived
 *   archive  — sweep unused -> archived
 *
 * Rules live in .claude/rules.md. Accepted rules are injected by
 * .claude/hooks/inject-rules.mjs on UserPromptSubmit.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = join(ROOT, '.claude/rules.md');
const MARK = '<!-- RULES BELOW — managed by scripts/self-improve.mjs, safe to hand-edit -->';
const UNUSED_DAYS = 60;
const PROTECTED = ['CLAUDE.md', '.claude/settings.json', '.claude/hooks/'];
// Autonomous mode only auto-accepts a pattern seen at least this many times.
const AUTO_THRESHOLD = Number(process.env.AUTO_THRESHOLD || 5);

const C = process.stdout.isTTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { g: '', r: '', y: '', c: '', d: '', b: '', x: '' };

const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (d) => Math.floor((Date.now() - Date.parse(d)) / 86400000);

/* ------------------------------------------------------------ rules file io */

function loadRules() {
  if (!existsSync(RULES)) return { header: '', rules: [] };
  const raw = readFileSync(RULES, 'utf8');
  const i = raw.indexOf(MARK);
  if (i === -1) return { header: raw, rules: [] };
  const header = raw.slice(0, i + MARK.length);
  const body = raw.slice(i + MARK.length);

  const rules = [];
  for (const chunk of body.split(/\n## /).slice(1)) {
    const [head, ...rest] = chunk.split('\n');
    const m = head.match(/^(R\d+)\s+·\s+(.*)$/);
    if (!m) continue;
    const text = rest.join('\n');
    const field = (name) => {
      const f = text.match(new RegExp(`^- \\*\\*${name}:\\*\\*\\s*(.*)$`, 'm'));
      return f ? f[1].trim() : '';
    };
    rules.push({
      id: m[1],
      title: m[2].trim(),
      state: field('state') || 'proposed',
      created: field('created') || today(),
      triggers: field('triggers').split(',').map((s) => s.trim()).filter(Boolean),
      evidence: field('evidence'),
      hits: Number(field('hits') || 0),
      lastHit: field('last-hit') || 'never',
      body: text.replace(/^- \*\*.*\*\*.*$/gm, '').trim(),
    });
  }
  return { header, rules };
}

function saveRules(header, rules) {
  const out = rules
    .map(
      (r) =>
        `\n## ${r.id} · ${r.title}\n\n` +
        `- **state:** ${r.state}\n` +
        `- **created:** ${r.created}\n` +
        `- **triggers:** ${r.triggers.join(', ')}\n` +
        `- **evidence:** ${r.evidence}\n` +
        `- **hits:** ${r.hits}\n` +
        `- **last-hit:** ${r.lastHit}\n\n` +
        `${r.body}\n`
    )
    .join('');
  writeFileSync(RULES, `${header}\n${out}`);
}

const nextId = (rules) =>
  'R' + String(rules.reduce((n, r) => Math.max(n, Number(r.id.slice(1))), 0) + 1).padStart(3, '0');

/* ------------------------------------------------------------- transcripts */

function transcriptDir() {
  const base = join(homedir(), '.claude', 'projects');
  // Claude Code slugifies the project path: every non-alphanumeric char becomes '-',
  // so /Users/x/Dev/agent_bookshelf -> -Users-x-Dev-agent-bookshelf
  const slug = ROOT.replace(/[^a-zA-Z0-9]/g, '-');
  const exact = join(base, slug);
  if (existsSync(exact)) return exact;
  // Fallback: match on the project directory name alone.
  if (existsSync(base)) {
    const leaf = basename(ROOT).replace(/[^a-zA-Z0-9]/g, '-');
    const hit = readdirSync(base).find((d) => d.endsWith(leaf));
    if (hit) return join(base, hit);
  }
  return exact;
}

function* entries() {
  const dir = transcriptDir();
  if (!existsSync(dir)) return;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
    const session = basename(f, '.jsonl').slice(0, 8);
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        yield { session, o: JSON.parse(line) };
      } catch {
        /* skip malformed line */
      }
    }
  }
}

/* --------------------------------------------------------------- detection */

const ERR_RE = /(command not found|no such file|permission denied|fatal:|error TS\d+|SyntaxError|ReferenceError|TypeError|npm ERR!|Cannot find module)/i;

function detect() {
  const incidents = [];
  const pendingTool = new Map(); // tool_use id -> {name, input}
  const cmdCount = new Map();

  for (const { session, o } of entries()) {
    const ts = (o.timestamp || '').slice(0, 10) || today();
    const msg = o.message || {};

    if (Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b?.type === 'tool_use') pendingTool.set(b.id, { name: b.name, input: b.input || {} });
        if (b?.type === 'tool_result' && b.is_error) {
          const t = pendingTool.get(b.tool_use_id) || {};
          incidents.push({
            kind: 'tool-error',
            session,
            ts,
            tool: t.name || 'unknown',
            target: t.input?.file_path || t.input?.command?.slice(0, 60) || '',
            detail: String(b.content || '').slice(0, 180),
          });
        }
      }
    }

    const r = o.toolUseResult;
    if (!r || typeof r !== 'object') continue;

    if (r.interrupted === true) {
      incidents.push({ kind: 'interrupted', session, ts, tool: 'Bash', target: '', detail: 'user interrupted the call' });
    }

    if (r.userModified === true) {
      incidents.push({
        kind: 'user-corrected',
        session,
        ts,
        tool: 'Edit/Write',
        target: r.filePath ? r.filePath.replace(ROOT + '/', '') : '',
        detail: 'user edited this file right after the agent wrote it',
      });
    }

    if (typeof r.stderr === 'string' && ERR_RE.test(r.stderr)) {
      incidents.push({
        kind: 'shell-error',
        session,
        ts,
        tool: 'Bash',
        target: '',
        detail: r.stderr.split('\n').find((l) => ERR_RE.test(l))?.slice(0, 180) || '',
      });
    }

    if (typeof r.stdout === 'string' && r.stdout.length) {
      // crude retry detection: identical command run many times across history
      const key = `${session}:${(r.stdout || '').slice(0, 40)}`;
      cmdCount.set(key, (cmdCount.get(key) || 0) + 1);
    }
  }

  for (const [key, n] of cmdCount) if (n >= 4) {
    const [session] = key.split(':');
    incidents.push({ kind: 'repetition', session, ts: today(), tool: 'Bash', target: '', detail: `identical output seen ${n}x — possible retry loop` });
  }

  return incidents;
}

/* ----------------------------------------------------------- session scoring */

const WEIGHTS = { 'tool-error': 3, 'shell-error': 2, 'user-corrected': 3, interrupted: 2, repetition: 1 };

function sessionStats() {
  const stats = new Map();
  const touch = (id) => {
    if (!stats.has(id)) stats.set(id, { id, toolCalls: 0, kinds: {}, penalty: 0, first: '', last: '' });
    return stats.get(id);
  };

  for (const { session, o } of entries()) {
    const st = touch(session);
    const ts = o.timestamp || '';
    if (ts) {
      if (!st.first || ts < st.first) st.first = ts;
      if (!st.last || ts > st.last) st.last = ts;
    }
    const c = (o.message || {}).content;
    if (Array.isArray(c)) for (const b of c) if (b?.type === 'tool_use') st.toolCalls++;
  }

  for (const i of detect()) {
    const st = touch(i.session);
    st.kinds[i.kind] = (st.kinds[i.kind] || 0) + 1;
    st.penalty += WEIGHTS[i.kind] || 1;
  }

  for (const st of stats.values()) {
    // Penalty per 100 tool calls, so a long clean session isn't punished for length.
    st.rate = st.toolCalls ? (st.penalty / st.toolCalls) * 100 : 0;
    st.grade = st.penalty === 0 ? 'clean' : st.rate < 5 ? 'good' : st.rate < 15 ? 'mixed' : 'poor';
  }
  return [...stats.values()].sort((a, b) => b.rate - a.rate);
}

function cmdScore() {
  const all = sessionStats();
  if (!all.length) { console.log(`${C.r}No transcripts found${C.x}`); process.exit(1); }
  const tint = { clean: C.g, good: C.g, mixed: C.y, poor: C.r };
  console.log(`\n${C.b}Session quality${C.x} ${C.d}penalty per 100 tool calls${C.x}\n`);
  for (const s of all) {
    const kinds = Object.entries(s.kinds).map(([k, n]) => `${k}×${n}`).join(' ') || 'no signals';
    console.log(
      `  ${tint[s.grade]}${s.grade.padEnd(6)}${C.x} ${s.id}  ${C.d}${String(s.toolCalls).padStart(3)} calls · rate ${s.rate.toFixed(1)} · ${kinds}${C.x}`
    );
  }
  const poor = all.filter((s) => s.grade === 'poor' || s.grade === 'mixed');
  console.log(`\n${C.d}${all.length} session(s), ${poor.length} with signals worth reviewing.${C.x}`);
  if (all.length < 10) {
    console.log(`${C.y}Low confidence${C.x} ${C.d}— grades over <10 sessions are indicative, not statistical.${C.x}`);
  }
  console.log('');
}

function cmdIncidents() {
  // JSON dump consumed by the self-improve skill, which writes the real rule text.
  const groups = group(detect()).sort((a, b) => b.n - a.n);
  console.log(JSON.stringify(
    groups.map((g) => ({ kind: g.kind, target: g.target, tool: g.tool, count: g.n, sessions: [...g.sessions], sample: g.sample })),
    null, 2
  ));
}

/* ------------------------------------------------------- rule drafting */

const TEMPLATE = {
  'user-corrected': (g) => ({
    title: `Agent edits to ${g.target || 'this file'} needed human correction`,
    triggers: triggersFor(g.target),
    body:
      `The user edited \`${g.target}\` immediately after the agent wrote it, ${g.n} time(s).\n` +
      `That usually means the agent's version missed a project convention.\n\n` +
      `**Draft rule — rewrite this before approving:** re-read \`${g.target}\` and the\n` +
      `surrounding conventions before editing it; match the existing style rather than\n` +
      `rewriting wholesale.`,
  }),
  'shell-error': (g) => ({
    title: `Recurring shell failure: ${g.sample.slice(0, 50)}`,
    triggers: ['bash', 'command', 'npm', 'build'],
    body:
      `This shell error appeared ${g.n} time(s) across sessions:\n\n` +
      `> ${g.sample}\n\n` +
      `**Draft rule — rewrite this before approving:** check the precondition that causes\n` +
      `this failure before running the command.`,
  }),
  'tool-error': (g) => ({
    title: `Tool ${g.tool} failed repeatedly`,
    triggers: [String(g.tool).toLowerCase()],
    body:
      `\`${g.tool}\` returned an error ${g.n} time(s). Sample:\n\n> ${g.sample}\n\n` +
      `**Draft rule — rewrite this before approving:** state the precondition or argument\n` +
      `shape that avoids this failure.`,
  }),
  interrupted: (g) => ({
    title: `Work interrupted ${g.n} time(s) — check for over-autonomy`,
    triggers: ['run', 'long', 'watch'],
    body:
      `The user stopped a running call ${g.n} time(s). Often a sign the agent started\n` +
      `something long or unwanted without checking first.\n\n` +
      `**Draft rule — rewrite this before approving:** confirm before starting long-running\n` +
      `or watch-mode commands.`,
  }),
  repetition: (g) => ({
    title: `Possible retry loop detected`,
    triggers: ['bash'],
    body:
      `Identical output repeated ${g.n} time(s), suggesting a retry loop.\n\n` +
      `**Draft rule — rewrite this before approving:** add an explicit exit criterion before\n` +
      `re-running a failing command.`,
  }),
};

function triggersFor(target = '') {
  const t = [];
  if (/test/i.test(target)) t.push('test', 'vitest', 'spec');
  if (/route/i.test(target)) t.push('route', 'endpoint', 'express');
  if (/model/i.test(target)) t.push('model', 'query', 'sql');
  if (/\.ejs$/.test(target)) t.push('view', 'template', 'ejs');
  if (/\.css$/.test(target)) t.push('css', 'style');
  if (target) t.push(basename(target));
  return [...new Set(t)].slice(0, 6);
}

function group(incidents) {
  const by = new Map();
  for (const i of incidents) {
    const key = `${i.kind}::${i.target || i.tool}`;
    if (!by.has(key)) by.set(key, { ...i, n: 0, sessions: new Set(), sample: i.detail });
    const g = by.get(key);
    g.n++;
    g.sessions.add(i.session);
  }
  return [...by.values()];
}

/* ---------------------------------------------------------------- commands */

function cmdExtract() {
  const dir = transcriptDir();
  if (!existsSync(dir)) {
    console.log(`${C.r}No transcripts found${C.x} at ${dir}`);
    process.exit(1);
  }

  const incidents = detect();
  const groups = group(incidents).filter((g) => g.n >= 2).sort((a, b) => b.n - a.n);

  console.log(`\n${C.b}Scanned${C.x} ${readdirSync(dir).filter((f) => f.endsWith('.jsonl')).length} session(s)`);
  console.log(`${C.b}Signals${C.x}  ${incidents.length} incident(s), ${groups.length} recurring pattern(s)\n`);

  if (incidents.length === 0) {
    console.log(`${C.d}No failure signals in this project's history. Nothing to propose.${C.x}`);
    console.log(`${C.d}That is a good outcome, not a broken script.${C.x}\n`);
    return;
  }

  const byKind = incidents.reduce((m, i) => ((m[i.kind] = (m[i.kind] || 0) + 1), m), {});
  for (const [k, n] of Object.entries(byKind)) console.log(`  ${C.c}${k}${C.x} ${C.d}×${n}${C.x}`);
  console.log('');

  if (groups.length === 0) {
    console.log(`${C.y}No pattern recurred often enough to propose a rule${C.x} ${C.d}(threshold: 2)${C.x}`);
    console.log(`${C.d}One-off failures are noise. Rules need repetition to be worth injecting.${C.x}\n`);
    return;
  }

  const { header, rules } = loadRules();
  let added = 0;

  for (const g of groups) {
    const tpl = TEMPLATE[g.kind];
    if (!tpl) continue;
    const draft = tpl(g);
    if (rules.some((r) => r.title === draft.title)) continue;
    const mode = process.env.APPROVAL_MODE || 'supervised';
    const auto = mode === 'autonomous' && g.n >= AUTO_THRESHOLD;
    rules.push({
      id: nextId(rules),
      title: draft.title,
      state: auto ? 'accepted' : 'proposed',
      created: today(),
      triggers: draft.triggers,
      evidence: `${g.n} incident(s) · ${g.kind} · session(s) ${[...g.sessions].join(', ')}`,
      hits: 0,
      lastHit: 'never',
      body: draft.body,
    });
    added++;
  }

  saveRules(header, rules);
  const mode = process.env.APPROVAL_MODE || 'supervised';
  console.log(`${C.g}Proposed ${added} rule(s)${C.x} → .claude/rules.md ${C.d}(mode: ${mode})${C.x}`);
  if (mode === 'autonomous') console.log(`${C.y}Autonomous${C.x} ${C.d}— patterns seen ≥${AUTO_THRESHOLD}× were auto-accepted.${C.x}`);
  if (added) console.log(`${C.d}Review them, rewrite the draft text, then: npm run self:approve <id>${C.x}`);
  console.log('');
}

function cmdStatus() {
  const { rules } = loadRules();
  if (!rules.length) {
    console.log(`\n${C.d}No rules yet. Run: npm run self:extract-insights${C.x}\n`);
    return;
  }
  const order = ['proposed', 'accepted', 'unused', 'archived'];
  const color = { proposed: C.y, accepted: C.g, unused: C.y, archived: C.d };
  console.log('');
  for (const state of order) {
    const set = rules.filter((r) => r.state === state);
    if (!set.length) continue;
    console.log(`${C.b}${state.toUpperCase()}${C.x} ${C.d}(${set.length})${C.x}`);
    for (const r of set) {
      const stale =
        state === 'accepted' && r.lastHit === 'never' && daysSince(r.created) > UNUSED_DAYS;
      console.log(
        `  ${color[state]}${r.id}${C.x} ${r.title}` +
          `${C.d} · hits ${r.hits}${stale ? ` · ${C.y}stale${C.d}` : ''}${C.x}`
      );
    }
    console.log('');
  }
}

function cmdSetState(id, state) {
  const { header, rules } = loadRules();
  const r = rules.find((x) => x.id.toLowerCase() === String(id).toLowerCase());
  if (!r) {
    console.log(`${C.r}No rule ${id}${C.x}`);
    process.exit(1);
  }
  if (state === 'accepted') {
    const hit = PROTECTED.find((p) => r.body.includes(p) || r.title.includes(p));
    if (hit) {
      console.log(`${C.r}Refused${C.x} — ${r.id} references a protected path (${hit}).`);
      console.log(`${C.d}Rules cannot modify CLAUDE.md, settings.json, or hooks. Edit the rule first.${C.x}`);
      process.exit(1);
    }
  }
  r.state = state;
  saveRules(header, rules);
  console.log(`${C.g}${r.id}${C.x} → ${state}  ${C.d}${r.title}${C.x}`);
  if (state === 'accepted') console.log(`${C.d}Commit as: chore(self-improve): accept ${r.id}${C.x}`);
}

function cmdArchive() {
  const { header, rules } = loadRules();
  let n = 0;
  for (const r of rules) {
    if (r.state === 'accepted' && r.lastHit === 'never' && daysSince(r.created) > UNUSED_DAYS) {
      r.state = 'archived';
      n++;
    }
  }
  saveRules(header, rules);
  console.log(n ? `${C.g}Archived ${n} unused rule(s)${C.x}` : `${C.d}Nothing to archive${C.x}`);
}

/* -------------------------------------------------------------------- main */

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case 'extract': cmdExtract(); break;
  case 'status': cmdStatus(); break;
  case 'approve': cmdSetState(arg, 'accepted'); break;
  case 'reject': cmdSetState(arg, 'archived'); break;
  case 'archive': cmdArchive(); break;
  case 'score': cmdScore(); break;
  case 'incidents': cmdIncidents(); break;
  default:
    console.log('usage: self-improve.mjs extract|status|score|incidents|approve <id>|reject <id>|archive');
    process.exit(1);
}
