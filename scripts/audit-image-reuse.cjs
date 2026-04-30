#!/usr/bin/env node
/**
 * Static image-reuse audit across all jobs/{domain}/option-a/dist builds.
 *
 * Computes the IMAGE REUSE RULE (from SKILL.md) ratio per customer WITHOUT
 * needing a running server: walks dist/**\/*.html and dist/**\/*.css for
 * <img src>, <source srcset>, style="background-image: url(...)", and
 * inline <style>{...url(...)...} references; compares to the must-reuse
 * pool from manifest.json after src-URL deduplication + classifier exclusions.
 *
 * Usage:
 *   node scripts/audit-image-reuse.cjs               # all domains
 *   node scripts/audit-image-reuse.cjs giffins.net   # one domain
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JOBS = path.join(ROOT, 'jobs');

const filterDomain = process.argv[2] || null;

function isMustReusePhoto(rec) {
  const w = rec.width || 0;
  const alt = (rec.alt || '').toLowerCase();
  const lp  = (rec.localPath || '').toLowerCase();
  const src = (rec.src || '').toLowerCase();
  if (w >= 1 && w < 100) return false;
  if (/bbb|better business|yelp|google review|trustpilot|angie|home advisor|verified by|accredited|certified by/.test(alt)) return false;
  if (/favicon|spinner|loading|placeholder|transparent.?bg|background.?pattern/.test(lp)) return false;
  if (w >= 1 && w < 400 && (/logo/.test(alt) || /logo/.test(lp))) return false;
  if (/blank|empty.*background|white\s+background|solid\s+background|transparent\s+bg/.test(alt)) return false;
  if (/tiles\.mapbox\.com|\.tiles\.|maps\.google|gstatic\.com\/maps/.test(src)) return false;
  return true;
}

function buildInventory(manifestPath) {
  if (!fs.existsSync(manifestPath)) return null;
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const srcToCanonical = new Map();
  for (const p of m.pages || []) {
    for (const imgs of [p.images || [], p.backgroundImages || []]) {
      for (const i of imgs) {
        if (!i || !i.localPath) continue;
        const basename = i.localPath.split('/').pop();
        if (!basename) continue;
        const key = i.src || `__no_src__:${basename}`;
        if (!srcToCanonical.has(key)) {
          srcToCanonical.set(key, {
            basename,
            localPath: i.localPath,
            src: i.src || '',
            width: i.width || 0,
            height: i.height || 0,
            alt: i.alt || '',
            aliases: new Set([basename]),
          });
        } else {
          srcToCanonical.get(key).aliases.add(basename);
        }
      }
    }
  }
  return [...srcToCanonical.values()];
}

function walkFiles(dir, exts, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walkFiles(p, exts, files);
    else if (exts.some(e => f.name.endsWith(e))) files.push(p);
  }
  return files;
}

function fromUrl(raw) {
  if (!raw) return null;
  const cleaned = raw.split('?')[0].split('#')[0];
  const segs = cleaned.split('/').filter(Boolean);
  if (!segs.length) return null;
  return segs[segs.length - 1];
}

function collectRendered(distDir) {
  const renderedBasenames = new Set();
  for (const f of walkFiles(distDir, ['.html', '.css'])) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) {
      const b = fromUrl(m[1]); if (b) renderedBasenames.add(b);
    }
    for (const m of text.matchAll(/<source[^>]+srcset=["']([^"']+)["']/g)) {
      for (const part of m[1].split(',')) {
        const u = part.trim().split(/\s+/)[0];
        const b = fromUrl(u); if (b) renderedBasenames.add(b);
      }
    }
    for (const m of text.matchAll(/url\(["']?([^"'\)]+)["']?\)/g)) {
      const b = fromUrl(m[1]); if (b) renderedBasenames.add(b);
    }
  }
  return renderedBasenames;
}

function auditDomain(domain) {
  const manifestPath = path.join(JOBS, domain, 'manifest.json');
  const distDir = path.join(JOBS, domain, 'option-a', 'dist');
  if (!fs.existsSync(manifestPath)) return { domain, status: 'no-manifest' };
  if (!fs.existsSync(distDir)) return { domain, status: 'no-dist' };
  const inventory = buildInventory(manifestPath);
  if (!inventory || inventory.length === 0) return { domain, status: 'empty-inventory' };
  const mustReuse = inventory.filter(isMustReusePhoto);
  const rendered = collectRendered(distDir);
  const renderedMustReuse = mustReuse.filter(r => {
    for (const a of r.aliases) if (rendered.has(a)) return true;
    return false;
  });
  const ratio = mustReuse.length === 0 ? 1 : renderedMustReuse.length / mustReuse.length;
  return {
    domain,
    status: 'ok',
    inventoryUnique: inventory.length,
    mustReuseCount: mustReuse.length,
    renderedCount: renderedMustReuse.length,
    ratio,
    pass: ratio >= 0.90,
  };
}

const allDomains = fs.readdirSync(JOBS, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
  .map(d => d.name)
  .sort();

const targets = filterDomain ? [filterDomain] : allDomains;
const results = targets.map(auditDomain).filter(r => r.status === 'ok');

results.sort((a, b) => a.ratio - b.ratio);

console.log('');
console.log(`IMAGE REUSE AUDIT — ${results.length} customers (Option A only)`);
console.log('==='.padEnd(80, '='));
console.log('');
console.log('  ratio  rendered/pool    domain');
console.log('  ' + '-'.repeat(76));
for (const r of results) {
  const pct = (r.ratio * 100).toFixed(1).padStart(5);
  const mark = r.pass ? '✓' : '✗';
  const fraction = `${r.renderedCount}/${r.mustReuseCount}`.padEnd(12);
  console.log(`  ${mark} ${pct}%  ${fraction}    ${r.domain}`);
}
console.log('');
const failing = results.filter(r => !r.pass);
const passing = results.filter(r => r.pass);
console.log(`  Summary: ${passing.length} pass / ${failing.length} fail (target ≥ 90%)`);
const median = results.length ? results[Math.floor(results.length / 2)].ratio : 0;
console.log(`  Median reuse ratio: ${(median * 100).toFixed(1)}%`);
console.log('');

const skipped = targets.filter(d => !results.find(r => r.domain === d));
if (skipped.length) {
  console.log(`  Skipped: ${skipped.length} (no manifest / no dist / empty inventory)`);
  for (const d of skipped) console.log(`    - ${d}`);
}
