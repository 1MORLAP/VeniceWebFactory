#!/usr/bin/env node
/**
 * compare-visual-pass-verdicts.cjs — Phase K-narrow A/B comparison helper
 *
 * Built 2026-05-07. Loads visual-pass verdicts produced by all three variants
 * (Anthropic Opus, Anthropic Sonnet, Venice Qwen3-VL) for one or more domains
 * and computes:
 *
 *   - Verdict alignment    — did all 3 variants reach the same pass/fix/rebuild?
 *   - Catch rate (recall)  — of issues Opus flagged, what % did each cheaper
 *                            variant also flag? Pairing on (item, screenshot)
 *                            tuple — same item flagged at the same screenshot
 *                            counts as a match. Description text-similarity
 *                            is NOT used (would need fuzzy match; pair-on-
 *                            (item,screenshot) is more conservative).
 *   - Precision            — of issues each cheaper variant flagged, what %
 *                            were also flagged by Opus? (Inverse of false
 *                            positives.)
 *   - Per-customer summary table
 *   - Aggregate summary across all customers
 *
 * The aggregate decision (manual taste call by user) compares against:
 *   PASS thresholds:    Sonnet/Qwen3-VL ≥ 90% catch-rate, ≥ 80% precision,
 *                       ≥ 4/5 verdict-alignment with Opus
 *   MIXED:              Acceptable on some customers but not others — leads
 *                       to per-stage or per-option override
 *   FAIL:               Gap too big on quality dimension — keep Opus
 *
 * Verdict file naming convention (the harness writes these):
 *   jobs/{domain}/ab-results/visual-pass-verdict-opus-option-a.json
 *   jobs/{domain}/ab-results/visual-pass-verdict-sonnet-option-a.json
 *   jobs/{domain}/ab-results/visual-pass-verdict-venice-qwen3-vl-option-a.json
 *
 * Usage:
 *   node scripts/compare-visual-pass-verdicts.cjs <domain> [<domain> ...] [--option=a]
 *
 * Output:
 *   stdout — comparison tables (per-customer + aggregate)
 *   jobs/_ab-summary/phase-k-narrow-{timestamp}.md — markdown writeup for review
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const VARIANTS = ['opus', 'sonnet', 'venice-qwen3-vl'];

function parseArgs(argv) {
  const args = { domains: [], option: 'a' };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--option=')) args.option = a.split('=')[1];
    else if (!a.startsWith('--')) args.domains.push(a);
  }
  return args;
}

function loadVerdict(domain, variant, option) {
  const p = path.join(REPO_ROOT, 'jobs', domain, 'ab-results', `visual-pass-verdict-${variant}-option-${option}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return { ...JSON.parse(fs.readFileSync(p, 'utf8')), _path: p };
  } catch (e) {
    return { _error: e.message, _path: p };
  }
}

function issueKey(issue) {
  // Pair on (item, screenshot). Description text-fuzzy-match would be more
  // generous but harder to validate; (item,screenshot) is conservative —
  // counts only matches where both variants flag the SAME problem in the
  // SAME visual location.
  const item = (issue.item || '').toLowerCase().trim();
  const screenshot = (issue.screenshot || '').toLowerCase().trim();
  return `${item}::${screenshot}`;
}

function compareToReference(referenceIssues, candidateIssues) {
  // Returns { matches, refOnly, candOnly } as Sets of keys.
  const refKeys = new Set((referenceIssues || []).map(issueKey));
  const candKeys = new Set((candidateIssues || []).map(issueKey));
  const matches = new Set([...refKeys].filter(k => candKeys.has(k)));
  const refOnly = new Set([...refKeys].filter(k => !candKeys.has(k)));
  const candOnly = new Set([...candKeys].filter(k => !refKeys.has(k)));
  return { matches, refOnly, candOnly };
}

function pct(num, denom) {
  if (denom === 0) return '—';
  return `${((num / denom) * 100).toFixed(0)}%`;
}

function pad(s, n, align = 'left') {
  s = String(s);
  if (s.length >= n) return s.slice(0, n);
  const fill = ' '.repeat(n - s.length);
  return align === 'right' ? fill + s : s + fill;
}

function formatTokensCost(verdict) {
  const m = verdict._meta || {};
  if (!m.inputTokens && !m.outputTokens) return '—';
  return `in=${m.inputTokens || '?'} out=${m.outputTokens || '?'}`;
}

function comparePerCustomer(domain, option, verdicts) {
  const opus = verdicts.opus;
  const sonnet = verdicts.sonnet;
  const venice = verdicts['venice-qwen3-vl'];

  if (!opus || opus._error) return { error: `Missing or invalid Opus verdict: ${opus?._error || 'not found'}` };

  const out = {
    domain,
    option,
    opus: {
      verdict: opus.verdict,
      items_passed: opus.items_passed,
      issue_count: (opus.issues || []).length,
      tokens: formatTokensCost(opus),
    },
  };

  for (const variantName of ['sonnet', 'venice-qwen3-vl']) {
    const v = verdicts[variantName];
    if (!v || v._error) {
      out[variantName] = { error: v?._error || 'not found' };
      continue;
    }
    const cmp = compareToReference(opus.issues, v.issues);
    out[variantName] = {
      verdict: v.verdict,
      items_passed: v.items_passed,
      issue_count: (v.issues || []).length,
      catch_rate_num: cmp.matches.size,
      catch_rate_denom: (opus.issues || []).length,
      catch_rate: pct(cmp.matches.size, (opus.issues || []).length),
      precision_num: cmp.matches.size,
      precision_denom: (v.issues || []).length,
      precision: pct(cmp.matches.size, (v.issues || []).length),
      verdict_aligned: v.verdict === opus.verdict,
      missed_issues: [...cmp.refOnly],
      extra_issues: [...cmp.candOnly],
      tokens: formatTokensCost(v),
    };
  }

  return out;
}

function printPerCustomerTable(rows) {
  console.log('\n' + '═'.repeat(100));
  console.log('  PHASE K-NARROW — PER-CUSTOMER COMPARISON (vs Opus reference)');
  console.log('═'.repeat(100));
  console.log(`  ${pad('Customer', 36)} ${pad('Variant', 18)} ${pad('Verdict', 9)} ${pad('Issues', 7)} ${pad('Catch', 6, 'right')} ${pad('Precis', 7, 'right')} ${pad('Aligned?', 9)}`);
  console.log('  ' + '─'.repeat(96));
  for (const r of rows) {
    if (r.error) {
      console.log(`  ${pad(r.domain, 36)} ${pad('— ' + r.error.slice(0, 60), 80)}`);
      continue;
    }
    // Opus row (reference)
    console.log(`  ${pad(r.domain, 36)} ${pad('opus (ref)', 18)} ${pad(r.opus.verdict, 9)} ${pad(r.opus.issue_count, 7, 'right')} ${pad('—', 6, 'right')} ${pad('—', 7, 'right')} ${pad('—', 9)}`);
    // Each variant row
    for (const v of ['sonnet', 'venice-qwen3-vl']) {
      const x = r[v];
      if (!x || x.error) {
        console.log(`  ${pad('', 36)} ${pad(v, 18)} ${pad('ERROR: ' + (x?.error || ''), 60)}`);
        continue;
      }
      console.log(`  ${pad('', 36)} ${pad(v, 18)} ${pad(x.verdict, 9)} ${pad(x.issue_count, 7, 'right')} ${pad(x.catch_rate, 6, 'right')} ${pad(x.precision, 7, 'right')} ${pad(x.verdict_aligned ? '✓ yes' : '✗ no', 9)}`);
    }
    console.log('  ' + '·'.repeat(96));
  }
}

function aggregate(rows) {
  // Aggregate catch-rate / precision across customers (sum-then-divide so
  // bigger customers pull weight proportional to issue count, not an
  // unweighted average of percentages).
  const totals = {};
  for (const v of ['sonnet', 'venice-qwen3-vl']) {
    totals[v] = { catchNum: 0, catchDen: 0, precNum: 0, precDen: 0, aligned: 0, total: 0, errors: 0 };
  }
  for (const r of rows) {
    if (r.error) continue;
    for (const v of ['sonnet', 'venice-qwen3-vl']) {
      const x = r[v];
      if (!x || x.error) { totals[v].errors++; continue; }
      totals[v].catchNum += x.catch_rate_num;
      totals[v].catchDen += x.catch_rate_denom;
      totals[v].precNum += x.precision_num;
      totals[v].precDen += x.precision_denom;
      totals[v].aligned += x.verdict_aligned ? 1 : 0;
      totals[v].total++;
    }
  }
  return totals;
}

function printAggregate(totals) {
  console.log('\n' + '═'.repeat(100));
  console.log('  PHASE K-NARROW — AGGREGATE (vs Opus reference)');
  console.log('═'.repeat(100));
  console.log(`  ${pad('Variant', 22)} ${pad('Catch rate', 14, 'right')} ${pad('Precision', 14, 'right')} ${pad('Verdict aligned', 18, 'right')} ${pad('Errors', 8, 'right')}`);
  console.log('  ' + '─'.repeat(96));
  for (const v of ['sonnet', 'venice-qwen3-vl']) {
    const t = totals[v];
    const catchPct = pct(t.catchNum, t.catchDen);
    const precPct = pct(t.precNum, t.precDen);
    const alignedPct = t.total > 0 ? `${t.aligned}/${t.total} (${pct(t.aligned, t.total)})` : '—';
    console.log(`  ${pad(v, 22)} ${pad(catchPct, 14, 'right')} ${pad(precPct, 14, 'right')} ${pad(alignedPct, 18, 'right')} ${pad(t.errors, 8, 'right')}`);
  }

  console.log('\n  Pass thresholds (manual taste call):');
  console.log('    catch rate     ≥ 90%  → variant catches the issues Opus catches');
  console.log('    precision      ≥ 80%  → variant doesn\'t flag noise Opus didn\'t flag');
  console.log('    verdict aligned ≥ 4/5 → variant agrees with Opus on pass/fix/rebuild');
  console.log('  All three thresholds met → PASS (ship variant as default).');
  console.log('  Some met, some not → MIXED (per-option override).');
  console.log('  Catastrophic gap → FAIL (keep Opus).');
}

function writeMarkdownSummary(rows, totals, option) {
  const summaryDir = path.join(REPO_ROOT, 'jobs', '_ab-summary');
  if (!fs.existsSync(summaryDir)) fs.mkdirSync(summaryDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(summaryDir, `phase-k-narrow-${ts}.md`);

  const lines = [];
  lines.push(`# Phase K-narrow — Visual-pass A/B summary`);
  lines.push(``);
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push(`**Option**: ${option}`);
  lines.push(`**Customers**: ${rows.length}`);
  lines.push(`**Reference variant**: Anthropic Opus 4.7`);
  lines.push(`**Test variants**: Anthropic Sonnet 4.6, Venice Qwen3-VL 235B (\`qwen3-vl-235b-a22b\`)`);
  lines.push(``);
  lines.push(`## Aggregate`);
  lines.push(``);
  lines.push(`| Variant | Catch rate | Precision | Verdict aligned | Errors |`);
  lines.push(`|---|---|---|---|---|`);
  for (const v of ['sonnet', 'venice-qwen3-vl']) {
    const t = totals[v];
    const catchPct = pct(t.catchNum, t.catchDen);
    const precPct = pct(t.precNum, t.precDen);
    const alignedPct = t.total > 0 ? `${t.aligned}/${t.total} (${pct(t.aligned, t.total)})` : '—';
    lines.push(`| ${v} | ${catchPct} (${t.catchNum}/${t.catchDen}) | ${precPct} (${t.precNum}/${t.precDen}) | ${alignedPct} | ${t.errors} |`);
  }
  lines.push(``);
  lines.push(`## Per-customer detail`);
  lines.push(``);
  for (const r of rows) {
    lines.push(`### ${r.domain}`);
    lines.push(``);
    if (r.error) {
      lines.push(`**Error**: ${r.error}`);
      lines.push(``);
      continue;
    }
    lines.push(`| Variant | Verdict | Issues | Catch rate | Precision | Aligned? | Tokens |`);
    lines.push(`|---|---|---|---|---|---|---|`);
    lines.push(`| **opus (reference)** | ${r.opus.verdict} | ${r.opus.issue_count} | — | — | — | ${r.opus.tokens} |`);
    for (const v of ['sonnet', 'venice-qwen3-vl']) {
      const x = r[v];
      if (!x || x.error) {
        lines.push(`| ${v} | ERROR | — | — | — | — | ${x?.error || 'missing'} |`);
        continue;
      }
      lines.push(`| ${v} | ${x.verdict} | ${x.issue_count} | ${x.catch_rate} (${x.catch_rate_num}/${x.catch_rate_denom}) | ${x.precision} (${x.precision_num}/${x.precision_denom}) | ${x.verdict_aligned ? '✓' : '✗'} | ${x.tokens} |`);
    }
    lines.push(``);
    // Optional — list missed + extra issues for spot-checking
    for (const v of ['sonnet', 'venice-qwen3-vl']) {
      const x = r[v];
      if (!x || x.error) continue;
      if (x.missed_issues.length > 0 || x.extra_issues.length > 0) {
        lines.push(`#### ${v} diff vs opus`);
        if (x.missed_issues.length > 0) {
          lines.push(`- **Missed** (${x.missed_issues.length} issues Opus flagged but ${v} didn't):`);
          for (const k of x.missed_issues.slice(0, 6)) lines.push(`  - \`${k}\``);
          if (x.missed_issues.length > 6) lines.push(`  - … +${x.missed_issues.length - 6} more`);
        }
        if (x.extra_issues.length > 0) {
          lines.push(`- **Extra** (${x.extra_issues.length} issues ${v} flagged but Opus didn't):`);
          for (const k of x.extra_issues.slice(0, 6)) lines.push(`  - \`${k}\``);
          if (x.extra_issues.length > 6) lines.push(`  - … +${x.extra_issues.length - 6} more`);
        }
        lines.push(``);
      }
    }
  }
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\n  Markdown summary: ${outPath}`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.domains.length === 0) {
    console.error('Usage: node scripts/compare-visual-pass-verdicts.cjs <domain> [<domain> ...] [--option=a]');
    process.exit(1);
  }
  const rows = [];
  for (const domain of args.domains) {
    const verdicts = {};
    for (const v of VARIANTS) {
      verdicts[v] = loadVerdict(domain, v, args.option);
    }
    rows.push(comparePerCustomer(domain, args.option, verdicts));
  }
  printPerCustomerTable(rows);
  const totals = aggregate(rows);
  printAggregate(totals);
  writeMarkdownSummary(rows, totals, args.option);
}

main();
