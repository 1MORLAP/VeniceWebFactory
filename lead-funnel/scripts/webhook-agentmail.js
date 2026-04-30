// AgentMail webhook handler — receives delivery / open / bounce / reply
// events and writes them into the lead-funnel.
//
// Run locally:
//   node scripts/webhook-agentmail.js
//   # then expose via ngrok / cloudflared / Vercel deploy
//
// Configure AgentMail console → Webhooks → URL = https://<your-host>/agentmail
//
// Payload assumptions (adjust here if AgentMail's actual format differs):
//   {
//     "event_type": "message.delivered" | "message.opened" | "message.bounced" |
//                   "message.complained" | "message.rejected" | "message.received",
//     "data": {
//       "message_id":    "msg_...",         // links back to leads.outreach_message_id
//       "to":            "owner@example.com",
//       "from":          "webfactory@agentmail.to",
//       "subject":       "...",
//       "received_at":   "2026-04-29T...",  // for inbound replies
//       "bounce_reason": "...",             // for bounces
//       "thread_id":     "thr_...",         // for thread tracking
//     }
//   }
//
// All event handlers are idempotent and tolerant of partial payloads. If a
// real event arrives with a different shape, only the affected handler
// breaks — the rest keep working.

import '../load-env.js';
import http from 'node:http';
import db, { updateLead, getLeadByMessageId } from '../db.js';

const PORT = parseInt(process.env.WEBHOOK_PORT || '3030', 10);
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/agentmail';
const SECRET = process.env.AGENTMAIL_WEBHOOK_SECRET || null;  // optional shared secret
const SECRET_HEADER = 'x-agentmail-signature';

// ---- Event handlers -------------------------------------------------------

function handleDelivered(data) {
  // Mostly informational — we already set outreach_sent_at on send. We could
  // record a `outreach_delivered_at` if useful; skipping for now.
  return { handled: 'delivered' };
}

function handleOpened(data) {
  const lead = getLeadByMessageId(data.message_id);
  if (!lead) return { handled: 'opened', skipped: 'no_lead_for_message' };
  // First-open wins; later opens overwrite (track last-open if you want).
  if (!lead.outreach_opened_at) {
    updateLead(lead.id, {
      outreach_opened_at: new Date().toISOString(),
      status: 'email_opened',
      status_changed_at: new Date().toISOString(),
    });
  }
  return { handled: 'opened', lead_id: lead.id };
}

function handleBounced(data) {
  const lead = getLeadByMessageId(data.message_id);
  if (!lead) return { handled: 'bounced', skipped: 'no_lead_for_message' };
  updateLead(lead.id, {
    dead_at: new Date().toISOString(),
    dead_reason: `bounced${data.bounce_reason ? ': ' + String(data.bounce_reason).slice(0, 100) : ''}`,
    status: 'dead',
    status_changed_at: new Date().toISOString(),
  });
  return { handled: 'bounced', lead_id: lead.id };
}

function handleComplained(data) {
  // Spam complaint — terminal, treat as dead with a separate reason.
  const lead = getLeadByMessageId(data.message_id);
  if (!lead) return { handled: 'complained', skipped: 'no_lead_for_message' };
  updateLead(lead.id, {
    dead_at: new Date().toISOString(),
    dead_reason: 'complained',
    status: 'dead',
    status_changed_at: new Date().toISOString(),
  });
  return { handled: 'complained', lead_id: lead.id };
}

function handleRejected(data) {
  // Provider-side rejection (suppression list, invalid address, etc.).
  const lead = getLeadByMessageId(data.message_id);
  if (!lead) return { handled: 'rejected', skipped: 'no_lead_for_message' };
  updateLead(lead.id, {
    dead_at: new Date().toISOString(),
    dead_reason: `rejected${data.reject_reason ? ': ' + String(data.reject_reason).slice(0, 100) : ''}`,
    status: 'dead',
    status_changed_at: new Date().toISOString(),
  });
  return { handled: 'rejected', lead_id: lead.id };
}

function handleReceived(data) {
  // Inbound message — could be a reply to one of our outreach emails, or a
  // brand-new conversation. Try matching by message_id (if AgentMail threads),
  // then by recipient email address.
  let lead = getLeadByMessageId(data.in_reply_to || data.thread_id);
  if (!lead && data.from) {
    lead = db.prepare('SELECT * FROM leads WHERE outreach_email = ?').get(data.from.toLowerCase());
  }
  if (!lead) return { handled: 'received', skipped: 'no_lead_match' };

  // Mark as a reply received. Don't auto-mark as 'sold' — that's a manual
  // status update once we read the reply content.
  if (lead.status !== 'replied' && lead.status !== 'sold') {
    updateLead(lead.id, {
      status: 'replied',
      status_changed_at: new Date().toISOString(),
      notes: [lead.notes, `Reply received ${new Date().toISOString()}: ${(data.subject || '').slice(0, 80)}`].filter(Boolean).join('\n'),
    });
  }
  return { handled: 'received', lead_id: lead.id };
}

const HANDLERS = {
  'message.delivered':  handleDelivered,
  'message.opened':     handleOpened,
  'message.bounced':    handleBounced,
  'message.complained': handleComplained,
  'message.rejected':   handleRejected,
  'message.received':   handleReceived,
  // Provider may emit more event types in the future. Unknown events just
  // log and 200 — never fail the webhook.
};

// ---- HTTP server ----------------------------------------------------------

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function verifySignature(req, rawSecret) {
  if (!rawSecret) return true;  // optional
  const provided = req.headers[SECRET_HEADER];
  // V1: bearer-style shared secret. Replace with HMAC verification once
  // AgentMail publishes their signature scheme.
  return provided === rawSecret;
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'webhook-agentmail' }));
    return;
  }

  // The webhook itself
  if (req.method === 'POST' && (req.url === WEBHOOK_PATH || req.url?.startsWith(WEBHOOK_PATH + '?'))) {
    if (!verifySignature(req, SECRET)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_signature' }));
      return;
    }

    let body;
    try { body = await readJson(req); }
    catch { res.writeHead(400); res.end('bad json'); return; }

    const eventType = body.event_type || body.type || 'unknown';
    const data = body.data || body;

    const handler = HANDLERS[eventType];
    let result;
    try {
      result = handler ? handler(data) : { handled: 'noop', skipped: `unknown_event:${eventType}` };
    } catch (err) {
      console.error(`[webhook] handler error for ${eventType}:`, err.message);
      result = { handled: eventType, error: err.message };
    }

    console.log(`[webhook] ${eventType} → ${JSON.stringify(result)}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ received: true, ...result }));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[webhook-agentmail] listening on http://localhost:${PORT}${WEBHOOK_PATH}`);
  console.log(`[webhook-agentmail] health: http://localhost:${PORT}/health`);
  if (SECRET) console.log(`[webhook-agentmail] signature header: ${SECRET_HEADER}`);
  else console.log(`[webhook-agentmail] no AGENTMAIL_WEBHOOK_SECRET set — anyone can post to ${WEBHOOK_PATH}`);
});
