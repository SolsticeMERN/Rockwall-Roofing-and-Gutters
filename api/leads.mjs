import { createHash } from 'node:crypto';
import { authorized, validateLead, validateUpdate, notification, closed } from '../server/core.mjs';
import { createStore } from '../server/store.mjs';

const store = createStore();
export async function sendNotifications(storage = store, env = process.env) {
  if (storage.local || !env.RESEND_API_KEY || !env.NOTIFICATION_FROM || !env.OWNER_NOTIFICATION_EMAIL) return { sent: 0, configured: false };
  const jobs = await storage.jobs();
  let sent = 0;
  for (const job of jobs) {
    const lead = await storage.get(job.lead_id);
    if (!lead || (job.kind === 'followup' && (closed.includes(lead.status) || !lead.follow_up_at || lead.follow_up_at !== job.created_at))) { await storage.markSent(job.id); continue; }
    const content = notification(job.snapshot || lead, job.kind);
    // The stable key deduplicates concurrent attempts at the provider.
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': createHash('sha256').update(job.id).digest('hex') }, body: JSON.stringify({ from: env.NOTIFICATION_FROM, to: [env.OWNER_NOTIFICATION_EMAIL], ...content }), signal: AbortSignal.timeout(10000) });
    if (response.ok) { await storage.markSent(job.id); sent++; }
  }
  return { sent, configured: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const reply = (status, data) => res.status(status).json(data);
  const action = req.query?.action || new URL(req.url, 'http://localhost').searchParams.get('action');
  if (req.method === 'GET' && action === 'cron') {
    if (!authorized(req.headers.authorization, process.env.CRON_SECRET)) return reply(401, { error: 'Unauthorized.' });
    try { return reply(200, await sendNotifications()); } catch { return reply(503, { error: 'Notification processing failed.' }); }
  }
  if (req.method === 'GET' || req.method === 'PATCH') {
    if (!authorized(req.headers.authorization, process.env.OWNER_ACCESS_KEY)) return reply(401, { error: 'Enter a valid owner access key.' });
    try {
      if (req.method === 'GET') return reply(200, { leads: await store.list(), demo: store.local });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body || !/^[0-9a-f-]{36}$/i.test(body.id) || !Number.isInteger(body.version)) return reply(400, { error: 'Invalid update.' });
      let patch; try { patch = validateUpdate(body); } catch(e) { return reply(400, { error: e.message }); }
      const result = await store.update(body.id, patch, body.version);
      if (result.missing) return reply(404, { error: 'Lead not found.' });
      if (result.conflict) return reply(409, { error: 'This lead changed. Refresh and try again.' });
      return reply(200, result);
    } catch { return reply(503, { error: 'Lead storage is unavailable.' }); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST, PATCH'); return reply(405, { error: 'Method not allowed.' }); }
  if (!store.local && (process.env.LEAD_CAPTURE_ENABLED !== 'true' || !process.env.RATE_LIMIT_SALT)) return reply(503, { error: 'Custom capture is not enabled. Please call us directly.' });
  if (Number(req.headers['content-length'] || 0) > 12000) return reply(413, { error: 'Request too large.' });
  const origin = req.headers.origin;
  const permitted = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!store.local && (!origin || !permitted.includes(origin))) return reply(403, { error: 'This website is not authorized to submit requests.' });
  let lead;
  try { lead = validateLead(typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}); } catch(e) { return reply(400, { error: e.message }); }
  if (!lead) return reply(200, { success: true });
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    const fingerprint = createHash('sha256').update(`${process.env.RATE_LIMIT_SALT || 'local'}:${ip}`).digest('hex');
    const result = await store.capture(lead, fingerprint);
    if (result.limited) return reply(429, { error: 'Too many requests. Please call us directly.' });
    // Storage success is independent of email success. The durable job is retried by cron.
    try { await sendNotifications(); } catch { /* Keep the captured lead and pending notification. */ }
    return reply(200, { success: true, request_id: lead.id });
  } catch { return reply(503, { error: 'We could not save your request. Please call or try again.' }); }
}
