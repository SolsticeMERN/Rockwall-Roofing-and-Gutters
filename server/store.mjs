import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

export function createStore(env = process.env) {
  const local = env.LEADS_LOCAL_DEMO === 'true' && !env.VERCEL && env.NODE_ENV !== 'production';
  let chain = Promise.resolve();
  const file = resolve('.data/leads.json');
  async function localEdit(fn) {
    const task = chain.then(async () => {
      await mkdir(resolve('.data'), { recursive: true, mode: 0o700 });
      let db; try { db = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; db = { leads: [], jobs: [], attempts: [] }; }
      const result = fn(db);
      await writeFile(`${file}.tmp`, JSON.stringify(db), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
      return result;
    });
    chain = task.catch(() => {}); return task;
  }
  async function rest(path, method = 'GET', body) {
    const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!env.SUPABASE_URL || !secret) throw new Error('Storage is not configured.');
    const headers = { apikey: secret, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Database operation failed.');
    return response.status === 204 ? null : response.json();
  }
  return {
    local,
    async capture(lead, fingerprint) {
      if (!local) return rest('rpc/capture_roofing_lead', 'POST', { payload: lead, fingerprint });
      return localEdit(db => {
        if (db.leads.some(item => item.id === lead.id)) return { duplicate: true };
        const now = Date.now(); db.attempts = db.attempts.filter(a => a.at > now - 3600000);
        if (db.attempts.filter(a => a.fingerprint === fingerprint).length >= 10) return { limited: true };
        db.attempts.push({ at: now, fingerprint });
        const created = new Date(now).toISOString();
        db.leads.push({ ...lead, status: 'new', notes: '', created_at: created, updated_at: created, follow_up_at: created, inspection_at: null, version: 1 });
        db.jobs.push({ id: `new:${lead.id}`, lead_id: lead.id, kind: 'new', snapshot: { ...lead, status: 'new' }, created_at: created, sent_at: null });
        return { duplicate: false };
      });
    },
    async list() { return local ? localEdit(db => [...db.leads].sort((a,b) => b.created_at.localeCompare(a.created_at))) : rest('roofing_leads?select=*&order=created_at.desc&limit=500'); },
    async get(id) { return local ? localEdit(db => db.leads.find(l => l.id === id)) : (await rest(`roofing_leads?id=eq.${encodeURIComponent(id)}&select=*`))[0]; },
    async update(id, patch, version) {
      if (!local) return rest('rpc/update_roofing_lead', 'POST', { lead_id: id, expected_version: version, changes: patch });
      return localEdit(db => {
        const lead = db.leads.find(l => l.id === id);
        if (!lead) return { missing: true };
        if (lead.version !== version) return { conflict: true };
        Object.assign(lead, patch, { version: version + 1 });
        db.jobs = db.jobs.filter(j => j.lead_id !== id || j.kind === 'new' || j.sent_at);
        if (patch.follow_up_at) db.jobs.push({ id: `followup:${id}:${lead.version}`, lead_id: id, kind: 'followup', snapshot: { ...lead }, created_at: patch.follow_up_at, sent_at: null });
        return { lead };
      });
    },
    async jobs() { return local ? localEdit(db => db.jobs.filter(j => !j.sent_at && Date.parse(j.created_at) <= Date.now())) : rest(`roofing_notifications?select=*&sent_at=is.null&created_at=lte.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc&limit=25`); },
    async markSent(id) { return local ? localEdit(db => { const j = db.jobs.find(j => j.id === id); if (j) j.sent_at = new Date().toISOString(); }) : rest(`roofing_notifications?id=eq.${encodeURIComponent(id)}`, 'PATCH', { sent_at: new Date().toISOString() }); },
  };
}
