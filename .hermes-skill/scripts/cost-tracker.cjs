#!/usr/bin/env node
/**
 * cost-tracker.cjs — Venice DIEM/USD/BUNDLED_CREDITS cost tracking
 *
 * Venice uses three credit systems:
 *   - DIEM: Venice's native token (1 DIEM = 1 USD for pricing)
 *   - USD: Direct dollar pricing
 *   - BUNDLED_CREDITS: Package credits
 *
 * Accumulates costs per job in metrics.json.
 * Call after each stage to log token usage and cost.
 *
 * Usage:
 *   node scripts/cost-tracker.cjs <domain> <stage> <modelId> <inputTokens> <outputTokens>
 *
 * Example:
 *   node scripts/cost-tracker.cjs example.com scrape qwen-3-6-plus 12500 3400
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILL_ROOT = path.join(REPO_ROOT, '.hermes-skill');

// Load model pricing from config
const configPath = path.join(SKILL_ROOT, 'models', 'venice-model-config.json');
if (!fs.existsSync(configPath)) {
  console.error(`✗ Model config not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function calculateCost(modelId, inputTokens, outputTokens) {
  const def = config.modelDefinitions[modelId];
  if (!def || !def.pricing) {
    console.warn(`⚠ No pricing data for ${modelId}, returning 0`);
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }

  // Pricing is per 1M tokens
  const inputCost = (def.pricing.input * inputTokens) / 1000000;
  const outputCost = (def.pricing.output * outputTokens) / 1000000;
  
  return {
    inputCost: Math.round(inputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round((inputCost + outputCost) * 10000) / 10000
  };
}

// CLI args
const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('Usage: node scripts/cost-tracker.cjs <domain> <stage> <modelId> <inputTokens> <outputTokens>');
  console.error('   Or: node scripts/cost-tracker.cjs <domain> --report');
  process.exit(1);
}

const domain = args[0];

// Report mode
if (args[1] === '--report') {
  const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');
  if (!fs.existsSync(metricsPath)) {
    console.error(`✗ metrics.json not found for ${domain}`);
    process.exit(1);
  }

  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
  if (!metrics.cost) {
    console.log(`No cost data recorded for ${domain}`);
    process.exit(0);
  }

  console.log(`\nCost Report for ${domain}`);
  console.log(`Tier: ${metrics.costTier || 'unknown'}`);
  console.log(`Currency: ${metrics.cost.currency || 'USD'}`);
  console.log('=' .repeat(60));
  
  if (metrics.cost.perStage) {
    console.log(`\n${'Stage'.padEnd(20)} ${'Model'.padEnd(30)} ${'Input'.padEnd(10)} ${'Output'.padEnd(10)} ${'Cost'.padEnd(10)}`);
    console.log('-'.repeat(60));
    let totalInput = 0, totalOutput = 0, totalCost = 0;
    
    for (const [stage, data] of Object.entries(metrics.cost.perStage)) {
      console.log(`${stage.padEnd(20)} ${(data.model || '?').padEnd(30)} ${String(data.inputTokens || 0).padEnd(10)} ${String(data.outputTokens || 0).padEnd(10)} $${(data.cost || 0).toFixed(4).padEnd(8)}`);
      totalInput += data.inputTokens || 0;
      totalOutput += data.outputTokens || 0;
      totalCost += data.cost || 0;
    }
    
    console.log('-'.repeat(60));
    console.log(`${'TOTAL'.padEnd(20)} ${''.padEnd(30)} ${String(totalInput).padEnd(10)} ${String(totalOutput).padEnd(10)} $${totalCost.toFixed(4)}`);
  }
  
  if (metrics.cost.savings) {
    console.log(`\nSavings vs quality tier: $${metrics.cost.savings.toFixed(2)}`);
  }
  
  process.exit(0);
}

// Normal tracking mode
const stage = args[1];
const modelId = args[2];
const inputTokens = parseInt(args[3], 10);
const outputTokens = parseInt(args[4], 10);

if (isNaN(inputTokens) || isNaN(outputTokens)) {
  console.error('✗ inputTokens and outputTokens must be integers');
  process.exit(1);
}

const cost = calculateCost(modelId, inputTokens, outputTokens);

// Load metrics.json
const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`✗ metrics.json not found: ${metricsPath}`);
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
if (!metrics.cost) {
  metrics.cost = { currency: 'USD', perStage: {}, total: 0 };
}

metrics.cost.perStage[stage] = {
  model: modelId,
  inputTokens,
  outputTokens,
  cost: cost.totalCost,
  timestamp: new Date().toISOString()
};

// Recalculate total
let totalCost = 0;
for (const data of Object.values(metrics.cost.perStage)) {
  totalCost += data.cost;
}
metrics.cost.total = Math.round(totalCost * 10000) / 10000;

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

console.log(`✓ Cost tracked for ${domain}/${stage}: $${cost.totalCost.toFixed(4)} (${modelId}: ${inputTokens} in / ${outputTokens} out)`);
console.log(`  Running total: $${metrics.cost.total.toFixed(4)}`);

process.exit(0);
