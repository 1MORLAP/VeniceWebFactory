#!/usr/bin/env node
/**
 * detect-placeholders.cjs — Unified CMS-placeholder detection.
 *
 * The customer's original site often contains template-default "your content here"
 * placeholders served by Hibu, Wix, Squarespace, GoDaddy, Weebly, etc. — content
 * that LOOKS real to a scraper but represents stuff the customer never filled in.
 * Strict preservation of these placeholders ships the placeholders to production.
 *
 * This script runs AFTER scrape (Stage 1) and BEFORE the design brief (Stage 2).
 * It walks every page in the manifest and tags suspicious entries with
 *   `_placeholder: { kind, pattern, reason }`
 * so all downstream stages (design brief, build, QA) can see what's fake and
 * react with the appropriate fallback (favicon for logo, drop CTA for video,
 * skip section for empty copy, plain text for missing logo, etc.).
 *
 * Usage: node scripts/detect-placeholders.cjs <domain>
 *
 * Output: rewrites jobs/<domain>/manifest.json with `_placeholder` tags
 *         and writes jobs/<domain>/placeholder-report.json with a summary.
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// PATTERN CATALOG — single source of truth, used by every stage
// ============================================================

const PATTERNS = {
  // Image / file URLs from CMS platforms that ship default placeholder graphics
  imageUrl: [
    { rx: /\bgen-logo\b/i,            kind: 'logo-placeholder', source: 'Hibu' },
    { rx: /\bgenerated-logo\b/i,      kind: 'logo-placeholder', source: 'Hibu' },
    { rx: /\bplaceholder\b/i,         kind: 'image-placeholder', source: 'generic' },
    { rx: /\bdefault-logo\b/i,        kind: 'logo-placeholder', source: 'generic' },
    { rx: /\btemplate-logo\b/i,       kind: 'logo-placeholder', source: 'generic' },
    { rx: /\blogo-placeholder\b/i,    kind: 'logo-placeholder', source: 'generic' },
    { rx: /\blogo-default\b/i,        kind: 'logo-placeholder', source: 'generic' },
    { rx: /\byour-logo-here\b/i,      kind: 'logo-placeholder', source: 'generic' },
    { rx: /\bdefault-image\b/i,       kind: 'image-placeholder', source: 'generic' },
    { rx: /\bdefault-site-icon\b/i,   kind: 'logo-placeholder', source: 'generic' },
    { rx: /\bwix-default\b/i,         kind: 'image-placeholder', source: 'Wix' },
    { rx: /\bgodaddy-default\b/i,     kind: 'image-placeholder', source: 'GoDaddy' },
    { rx: /\bsq-default\b/i,          kind: 'image-placeholder', source: 'Squarespace' },
    { rx: /placehold\.co/i,           kind: 'image-placeholder', source: 'placehold.co CDN' },
    { rx: /via\.placeholder\.com/i,   kind: 'image-placeholder', source: 'via.placeholder.com CDN' },
    { rx: /lorempixel\.com/i,         kind: 'image-placeholder', source: 'lorempixel CDN' },
  ],

  // Page paths/slugs that indicate template-only pages (no real content)
  pageUrl: [
    { rx: /\/hibu-video-splash\b/i,   kind: 'page-placeholder', source: 'Hibu video splash template' },
    { rx: /\/call-or-text-pop\b/i,    kind: 'page-placeholder', source: 'Hibu call-or-text widget page' },
    { rx: /\/sample-page\b/i,         kind: 'page-placeholder', source: 'WordPress default sample page' },
    { rx: /\/test-page\b/i,           kind: 'page-placeholder', source: 'generic test page' },
    { rx: /\/your-(page|content)\b/i, kind: 'page-placeholder', source: 'generic placeholder page' },
    { rx: /\/lorem-ipsum\b/i,         kind: 'page-placeholder', source: 'lorem-ipsum content page' },
  ],

  // Body copy / heading text that's clearly placeholder, not real customer content
  copyText: [
    // Lorem ipsum and variants
    { rx: /\blorem\s+ipsum\s+dolor\b/i,                       kind: 'copy-lorem',    reason: 'Lorem ipsum text' },
    { rx: /\bsit\s+amet,?\s+consectetu/i,                     kind: 'copy-lorem',    reason: 'Lorem ipsum continuation' },

    // Common platform placeholder phrases
    { rx: /\bbusiness\s+tagline\s+(lorem|ipsum|here|goes)\b/i, kind: 'copy-tagline-placeholder', reason: 'Hibu/template tagline placeholder' },
    { rx: /\byour\s+(business\s+)?tagline\s+(here|goes\s+here)\b/i, kind: 'copy-tagline-placeholder', reason: 'Generic tagline placeholder' },
    { rx: /\bwelcome\s+to\s+your\s+new\s+(site|website|page|blog)\b/i, kind: 'copy-welcome-placeholder', reason: 'Generic CMS welcome message' },
    { rx: /\bclick\s+here\s+to\s+(add|edit|change)\b/i,       kind: 'copy-edit-placeholder', reason: 'Editable template prompt' },
    { rx: /\badd\s+your\s+(text|content|description|story)\s+here\b/i, kind: 'copy-edit-placeholder', reason: 'Editable template prompt' },
    { rx: /\bthis\s+is\s+a\s+(sample|placeholder|test)\b/i,   kind: 'copy-sample-text', reason: 'Sample text marker' },
    { rx: /\bcoming\s+soon\.{0,3}$/i,                          kind: 'copy-coming-soon', reason: '"Coming soon" stub' },
    { rx: /\bunder\s+construction\b/i,                         kind: 'copy-coming-soon', reason: '"Under construction" stub' },
    { rx: /\bpage\s+not\s+(yet\s+)?(written|created|filled)\b/i, kind: 'copy-empty-page', reason: 'Page placeholder text' },
    { rx: /\bsample\s+heading$/i,                              kind: 'copy-sample-heading', reason: 'Generic sample heading' },
  ],

  // Phone numbers that are reserved for fiction (555-0100 to 555-0199)
  phone: [
    { rx: /\b\(?555\)?[\s.-]?01\d{2}\b/,  kind: 'phone-fiction', reason: 'NANP fiction-reserved 555-01XX' },
    { rx: /\b123[\s.-]?456[\s.-]?7890\b/, kind: 'phone-placeholder', reason: '123-456-7890 placeholder' },
    { rx: /\b000[\s.-]?000[\s.-]?0000\b/, kind: 'phone-placeholder', reason: '000-000-0000 placeholder' },
  ],

  // Email addresses that are clearly placeholder
  email: [
    { rx: /\b(info|contact|hello|support|admin)@example\.(com|org|net)\b/i, kind: 'email-placeholder', reason: 'example.com domain' },
    { rx: /\b(your|email|name)@(domain|email|website|company|business)\.(com|org|net)\b/i, kind: 'email-placeholder', reason: 'placeholder email pattern' },
    { rx: /\byouremail@/i,                kind: 'email-placeholder', reason: 'youremail@ pattern' },
  ],

  // Addresses that are clearly placeholder
  address: [
    { rx: /\b123\s+main\s+(street|st\.?)\b/i, kind: 'address-placeholder', reason: '123 Main St placeholder' },
    { rx: /\byour\s+(street|address|city)\s+(here|goes\s+here)\b/i, kind: 'address-placeholder', reason: 'generic address placeholder' },
    { rx: /\b1234\s+anytown\b/i,           kind: 'address-placeholder', reason: '1234 Anytown placeholder' },
  ],
};

// ============================================================
// Walk + tag
// ============================================================

function checkAgainst(text, patterns) {
  if (!text || typeof text !== 'string') return null;
  for (const p of patterns) {
    if (p.rx.test(text)) {
      return { kind: p.kind, pattern: p.rx.toString(), source: p.source, reason: p.reason };
    }
  }
  return null;
}

function tagPage(page) {
  const tags = [];

  // Check page URL itself
  if (page.url) {
    const m = checkAgainst(page.url, PATTERNS.pageUrl);
    if (m) {
      page._placeholder = m;
      tags.push({ where: 'page.url', value: page.url, ...m });
    }
  }

  // Check images
  for (const img of page.images || []) {
    const m = checkAgainst(img.src, PATTERNS.imageUrl);
    if (m) {
      img._placeholder = m;
      tags.push({ where: `page ${page.url} image`, value: img.src, ...m });
    }
  }
  for (const bg of page.backgroundImages || []) {
    const m = checkAgainst(bg.src, PATTERNS.imageUrl);
    if (m) {
      bg._placeholder = m;
      tags.push({ where: `page ${page.url} bg`, value: bg.src, ...m });
    }
  }

  // Check section text content
  for (const section of page.sections || []) {
    if (section.heading) {
      const m = checkAgainst(section.heading, PATTERNS.copyText);
      if (m) {
        section._headingPlaceholder = m;
        tags.push({ where: `page ${page.url} heading`, value: section.heading, ...m });
      }
    }
    for (let i = 0; i < (section.paragraphs || []).length; i++) {
      const para = section.paragraphs[i];
      const m = checkAgainst(para, PATTERNS.copyText);
      if (m) {
        if (!section._paragraphPlaceholders) section._paragraphPlaceholders = {};
        section._paragraphPlaceholders[i] = m;
        tags.push({ where: `page ${page.url} para ${i}`, value: para.slice(0, 80), ...m });
      }
    }
  }

  return tags;
}

function tagBusiness(business) {
  const tags = [];
  if (business.phone) {
    const m = checkAgainst(business.phone, PATTERNS.phone);
    if (m) {
      business._phonePlaceholder = m;
      tags.push({ where: 'business.phone', value: business.phone, ...m });
    }
  }
  if (business.email) {
    const m = checkAgainst(business.email, PATTERNS.email);
    if (m) {
      business._emailPlaceholder = m;
      tags.push({ where: 'business.email', value: business.email, ...m });
    }
  }
  if (business.address) {
    const m = checkAgainst(business.address, PATTERNS.address);
    if (m) {
      business._addressPlaceholder = m;
      tags.push({ where: 'business.address', value: business.address, ...m });
    }
  }
  return tags;
}

// ============================================================
// Main
// ============================================================

function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error('Usage: node scripts/detect-placeholders.cjs <domain>');
    process.exit(1);
  }

  const jobDir = path.join('jobs', domain);
  const manifestPath = path.join(jobDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const allTags = [];

  // Walk pages
  for (const page of manifest.pages || []) {
    const t = tagPage(page);
    allTags.push(...t);
  }

  // Walk business info if present
  if (manifest.business) {
    allTags.push(...tagBusiness(manifest.business));
  }

  // Group tags by kind for the report
  const summary = {};
  for (const t of allTags) {
    summary[t.kind] = (summary[t.kind] || 0) + 1;
  }

  // Write enriched manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Write a separate report file for the operator
  const report = {
    domain,
    runAt: new Date().toISOString(),
    totalPlaceholdersFound: allTags.length,
    summary,
    placeholders: allTags,
  };
  const reportPath = path.join(jobDir, 'placeholder-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print loud summary for the operator
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PLACEHOLDER DETECTION — ${domain}`);
  console.log(`${'='.repeat(60)}`);
  if (allTags.length === 0) {
    console.log(`✓ No CMS placeholders detected. Customer's site is clean.`);
  } else {
    console.log(`⚠ ${allTags.length} placeholder content items found:`);
    for (const [kind, count] of Object.entries(summary)) {
      console.log(`    ${count.toString().padStart(3)}× ${kind}`);
    }
    console.log(`\nDownstream stages should react to these tags:`);
    console.log(`  - logo-placeholder         → use favicon fallback OR plain text business name`);
    console.log(`  - image-placeholder        → omit from build OR replace with manifest content`);
    console.log(`  - page-placeholder         → exclude page from nav and build`);
    console.log(`  - copy-tagline-placeholder → write a real tagline in Option B from manifest facts`);
    console.log(`  - copy-lorem               → omit; never ship lorem ipsum`);
    console.log(`  - copy-coming-soon         → omit section OR replace with real content`);
    console.log(`  - copy-edit-placeholder    → omit; was a CMS edit prompt, never real content`);
    console.log(`  - phone-fiction            → flag in final report; customer must provide real phone`);
    console.log(`  - email-placeholder        → flag in final report; customer must provide real email`);
    console.log(`  - address-placeholder      → flag in final report; customer must provide real address`);
  }
  console.log(`\nReport: ${reportPath}`);
  console.log(`${'='.repeat(60)}\n`);
}

main();
