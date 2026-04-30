import './load-env.js';
import { discover } from './discover.js';
import { filterAll } from './filter.js';
import { screenshotAll } from './screenshot.js';
import { scoreAll } from './score.js';
import { writeReport } from './report.js';
import { listLeadsInBatch, updateLead } from './db.js';

// Default tech-age threshold: 5 = "at least one strong old-tech signal".
// This is the smart default for finding sites worth rebuilding. Override with
// --explore (turn off filtering) or --strict (raise to 12).
const DEFAULT_MIN_TECH_AGE = 5;
const STRICT_MIN_TECH_AGE = 12;
const STRICT_MIN_AWFUL = 7;

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    query: null,
    count: 30,
    skipScore: false,
    batchId: null,
    // null means "use the smart default"; an explicit number overrides
    minTechAge: null,
    minAwful: null,
    explore: false,
    strict: false,
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-score' || a === '--skip-score') opts.skipScore = true;
    else if (a === '--count') opts.count = parseInt(args[++i], 10);
    else if (a === '--batch') opts.batchId = parseInt(args[++i], 10);
    else if (a === '--min-tech-age') opts.minTechAge = parseInt(args[++i], 10);
    else if (a === '--explore') opts.explore = true;
    else if (a === '--strict') opts.strict = true;
    // Legacy aliases — kept so existing reports / muscle memory still work
    else if (a === '--ancient') opts.minTechAge = 8;
    else if (a === '--very-ancient') opts.minTechAge = STRICT_MIN_TECH_AGE;
    else if (!a.startsWith('--')) positional.push(a);
  }

  // Resolve effective filters from flags
  if (opts.explore) {
    opts.minTechAge = 0;     // no tech-age gate
    opts.minAwful = null;    // no post-score filter
  } else if (opts.strict) {
    opts.minTechAge = STRICT_MIN_TECH_AGE;
    opts.minAwful = STRICT_MIN_AWFUL;
  } else if (opts.minTechAge == null) {
    opts.minTechAge = DEFAULT_MIN_TECH_AGE;  // smart default
  }

  if (positional[0]) opts.query = positional[0];
  if (positional[1]) opts.count = parseInt(positional[1], 10);
  return opts;
}

async function run() {
  const opts = parseArgs(process.argv);

  if (!opts.query) {
    console.error('Usage: node index.js "<query>" [count] [flags]');
    console.error('');
    console.error('Default behavior surfaces high-conversion-likelihood candidates only.');
    console.error('No flags needed for the common case.');
    console.error('');
    console.error('Flags (only when defaults are wrong):');
    console.error('  --explore               turn OFF filtering — see all discovery');
    console.error('  --strict                highest-conviction only (tech ≥ 12 + awful ≥ 7)');
    console.error('  --no-score              skip vision-LLM scoring (saves ~$0.03/100)');
    console.error('  --min-tech-age N        manual tech-age threshold');
    console.error('');
    console.error('High-conversion-prone preset queries:');
    console.error('  /find-leads "funeral homes Mississippi" 50');
    console.error('  /find-leads "well drilling Kentucky" 50');
    console.error('  /find-leads "small-firm attorneys West Virginia" 50');
    console.error('  /find-leads "septic services rural Iowa" 50');
    console.error('  /find-leads "monument & headstone shops Mississippi" 30');
    process.exit(1);
  }

  console.log(`[config] minTechAge=${opts.minTechAge}${opts.minAwful != null ? ` minAwful=${opts.minAwful}` : ''}${opts.explore ? ' EXPLORE' : ''}${opts.strict ? ' STRICT' : ''}`);

  console.log('━━━ STAGE 1: DISCOVER ━━━');
  const { batch } = await discover(opts.query, opts.count);

  console.log('\n━━━ STAGE 2: FILTER ━━━');
  await filterAll({ batchId: batch.id, minTechAge: opts.minTechAge });

  console.log('\n━━━ STAGE 3: SCREENSHOT ━━━');
  await screenshotAll();

  if (!opts.skipScore) {
    console.log('\n━━━ STAGE 4: SCORE ━━━');
    await scoreAll();

    // Post-scoring filter: --strict drops leads below the awfulness floor
    if (opts.minAwful != null) {
      const inBatch = listLeadsInBatch(batch.id);
      let demoted = 0;
      for (const lead of inBatch) {
        if (lead.filter_status === 'passed'
          && lead.awfulness_score != null
          && lead.awfulness_score < opts.minAwful) {
          updateLead(lead.id, {
            filter_status: 'rejected',
            filter_reason: `awful_below_${opts.minAwful}`,
          });
          demoted++;
        }
      }
      if (demoted) console.log(`[strict] demoted ${demoted} leads with awful < ${opts.minAwful}`);
    }
  } else {
    console.log('\n━━━ STAGE 4: SCORE (skipped via --no-score) ━━━');
  }

  console.log('\n━━━ STAGE 5: REPORT ━━━');
  const reportPath = writeReport(batch.id);

  console.log(`\n✓ done. batch #${batch.id} → ${reportPath}`);
}

run().catch(err => {
  console.error('FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
});
