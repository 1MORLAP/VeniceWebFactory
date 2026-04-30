// Sends outreach emails via AgentMail and updates the funnel columns.
//
// Two modes:
//   - DRY-RUN (default if AGENTMAIL_API_KEY not set OR --dry flag): renders
//     emails to stdout / file, no actual sends. Used for QA before going live.
//   - LIVE (AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID set, no --dry): actually sends.
//
// Targets leads that:
//   - have marketplace_slug (otherwise the URL is missing)
//   - have status='published' (their rebuild is live on the marketplace)
//   - have an outreach_email or we extract one from the site (V2)
//   - have NOT already received outreach (outreach_sent_at IS NULL)
//
// CLI:
//   node send-outreach.js                # send to all eligible leads
//   node send-outreach.js --limit 10     # cap batch size
//   node send-outreach.js --dry          # render only, no send
//   node send-outreach.js --lead 42      # send to one specific lead by id
//
// AgentMail notes:
//   - Uses inbox webfactory@agentmail.to (set AGENTMAIL_INBOX_ID env var to its id)
//   - Webhooks at /webhooks/agentmail handle delivery / open / bounce events
//     and write back to outreach_opened_at / dead_at (separate file, not yet built)

import '../load-env.js';
import db, { updateLead } from '../db.js';
import { renderEmail } from './email-template.js';

const args = process.argv.slice(2);
let dryRun = !process.env.AGENTMAIL_API_KEY;
let limit = null;
let leadIdOnly = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dry' || a === '--dry-run') dryRun = true;
  else if (a === '--limit') limit = parseInt(args[++i], 10);
  else if (a === '--lead') leadIdOnly = parseInt(args[++i], 10);
}

function selectLeads() {
  // V1 eligibility: has slug + has email + hasn't been emailed yet.
  // We'll also allow status='identified' for now since the marketplace
  // isn't wired — set status='published' once /webfactory has rebuilt
  // and listed the site to be more conservative.
  let sql = `
    SELECT * FROM leads
    WHERE marketplace_slug IS NOT NULL
      AND outreach_sent_at IS NULL
      AND outreach_email IS NOT NULL
      AND outreach_email != ''
      AND filter_status = 'passed'
  `;
  const params = {};
  if (leadIdOnly != null) { sql += ' AND id = @id'; params.id = leadIdOnly; }
  sql += ' ORDER BY conversion_likelihood DESC NULLS LAST';
  if (limit) { sql += ' LIMIT @limit'; params.limit = limit; }
  return db.prepare(sql).all(params);
}

async function getClient() {
  if (dryRun) return null;
  const { AgentMailClient } = await import('agentmail');
  return new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
}

async function sendOne(client, lead) {
  const payload = renderEmail(lead);
  if (dryRun) {
    console.log(`\n=== DRY-RUN: ${lead.business_name} → ${lead.outreach_email} ===`);
    console.log(`Subject: ${payload.subject}`);
    console.log(`Marketplace URL: ${payload.marketplace_url}`);
    console.log(`---\n${payload.text}`);
    return { ok: true, dry: true };
  }

  const inboxId = process.env.AGENTMAIL_INBOX_ID;
  if (!inboxId) {
    return { ok: false, error: 'AGENTMAIL_INBOX_ID env var not set (id of webfactory@agentmail.to)' };
  }

  try {
    const result = await client.inboxes.messages.send(inboxId, {
      to: lead.outreach_email,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    const messageId = result?.messageId ?? result?.id ?? result?.message_id ?? null;
    updateLead(lead.id, {
      outreach_sent_at: new Date().toISOString(),
      outreach_message_id: messageId,
      status: 'outreach_sent',
      status_changed_at: new Date().toISOString(),
    });
    return { ok: true, message_id: messageId };
  } catch (err) {
    return { ok: false, error: err.message?.slice(0, 120) ?? 'send_failed' };
  }
}

async function main() {
  const leads = selectLeads();
  if (leads.length === 0) {
    console.log('[outreach] no eligible leads (need marketplace_slug + outreach_email + filter_status=passed + outreach_sent_at IS NULL)');
    return;
  }

  if (dryRun) {
    console.log(`[outreach] DRY-RUN — ${leads.length} email(s) would be sent`);
  } else {
    console.log(`[outreach] LIVE — sending ${leads.length} email(s) via AgentMail`);
  }

  const client = await getClient();
  let sent = 0, failed = 0;
  for (const lead of leads) {
    const result = await sendOne(client, lead);
    if (result.ok) {
      sent++;
      if (!result.dry) console.log(`[outreach] ✓ ${lead.business_name} → ${lead.outreach_email}`);
    } else {
      failed++;
      console.error(`[outreach] ✗ ${lead.business_name}: ${result.error}`);
    }
  }
  console.log(`[outreach] sent=${sent} failed=${failed}${dryRun ? ' (DRY-RUN)' : ''}`);
}

main().catch(err => {
  console.error('[outreach] FAILED:', err.message);
  process.exit(1);
});
