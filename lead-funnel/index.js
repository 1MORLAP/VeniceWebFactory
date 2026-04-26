import './load-env.js';
import { discover } from './discover.js';
import { filterAll } from './filter.js';
import { screenshotAll } from './screenshot.js';
import { scoreAll } from './score.js';
import { writeReport } from './report.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { query: null, count: 30, skipScore: false, batchId: null };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--no-score' || a === '--skip-score') opts.skipScore = true;
    else if (a === '--count') opts.count = parseInt(args[++i], 10);
    else if (a === '--batch') opts.batchId = parseInt(args[++i], 10);
    else if (!a.startsWith('--')) positional.push(a);
  }

  if (positional[0]) opts.query = positional[0];
  if (positional[1]) opts.count = parseInt(positional[1], 10);
  return opts;
}

async function run() {
  const opts = parseArgs(process.argv);

  if (!opts.query) {
    console.error('Usage: node index.js "<query>" [count] [--no-score]');
    console.error('Example: node index.js "plumbers in Cleveland Ohio" 50');
    console.error('         node index.js "HVAC contractors Phoenix" 30 --no-score');
    process.exit(1);
  }

  console.log('━━━ STAGE 1: DISCOVER ━━━');
  const { batch } = await discover(opts.query, opts.count);

  console.log('\n━━━ STAGE 2: FILTER ━━━');
  await filterAll({ batchId: batch.id });

  console.log('\n━━━ STAGE 3: SCREENSHOT ━━━');
  await screenshotAll();

  if (!opts.skipScore) {
    console.log('\n━━━ STAGE 4: SCORE ━━━');
    await scoreAll();
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
