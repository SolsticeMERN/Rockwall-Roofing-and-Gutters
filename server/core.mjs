import { createHash, timingSafeEqual } from 'node:crypto';

export const statuses = ['new', 'contact_attempted', 'connected', 'inspection_scheduled', 'inspection_completed', 'estimate_sent', 'won', 'lost', 'do_not_contact'];
export const closed = ['won', 'lost', 'do_not_contact'];
export function authorized(header, key) {
  if (!key || key.length < 32) return false;
  const digest = value => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header || ''), digest(`Bearer ${key}`));
}
export function validateLead(input) {
  const text = (key, max) => typeof input[key] === 'string' ? input[key].trim().slice(0, max) : '';
  const phone = text('phone', 30).replace(/\D/g, '');
  const name = text('name', 100);
  const zip = text('zip', 20);
  const requestId = text('request_id', 50);
  if (text('_honey', 100)) return null;
  if (!name || !/^(?:1)?\d{10}$/.test(phone) || !/^\d{5}$/.test(zip) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new Error('Please provide a name, valid US phone number, and five-digit ZIP code.');
  const service = text('service', 100);
  if (!['Free roof inspection', 'Roof repair', 'Roof replacement', 'Storm damage', 'Gutters', 'Not sure — I’d like an inspection'].includes(service)) throw new Error('Please select a roofing concern.');
  const attribution = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid']) {
    const value = text(key, 500); if (value) attribution[key] = value;
  }
  return { id: requestId, name, phone: `+1${phone.slice(-10)}`, zip, service, message: text('message', 1500), placement: text('placement', 30) || 'unknown', attribution };
}
export function validateUpdate(input) {
  if (!statuses.includes(input.status)) throw new Error('Invalid lead status.');
  const next = closed.includes(input.status) ? null : input.follow_up_at || null;
  if (next && (!Number.isFinite(Date.parse(next)) || Date.parse(next) < Date.now() - 60000)) throw new Error('Choose a future follow-up time.');
  const inspection = input.inspection_at || null;
  if (inspection && !Number.isFinite(Date.parse(inspection))) throw new Error('Invalid inspection time.');
  if (input.status === 'inspection_scheduled' && !inspection) throw new Error('A confirmed inspection needs an appointment time.');
  return { status: input.status, notes: typeof input.notes === 'string' ? input.notes.slice(0, 5000) : '', follow_up_at: closed.includes(input.status) ? null : next, inspection_at: inspection, updated_at: new Date().toISOString() };
}
export function notification(lead, kind) {
  return { subject: kind === 'new' ? 'New roof inspection request' : 'Roofing lead needs follow-up', text: `${kind === 'new' ? 'A new website inquiry was saved.' : 'This lead has a callback task due.'}\n\nName: ${lead.name}\nPhone: ${lead.phone}\nZIP: ${lead.zip}\nConcern: ${lead.service}\nMessage: ${lead.message || '(none)'}\nStatus: ${lead.status}\n\nOpen the owner dashboard to review and arrange the next step. An inquiry is not a confirmed appointment.` };
}
