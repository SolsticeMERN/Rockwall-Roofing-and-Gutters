import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { authorized, validateLead, validateUpdate } from '../server/core.mjs';
import { createStore } from '../server/store.mjs';

const key='a-strong-owner-key-at-least-32-characters';
assert.equal(authorized(`Bearer ${key}`,key),true);
assert.equal(authorized('Bearer wrong',key),false);
assert.equal(authorized('Bearer abc','abc'),false);
assert.equal(authorized('',undefined),false);
const input={request_id:randomUUID(),name:'Test Homeowner',phone:'9728327618',zip:'75201',service:'Roof repair',placement:'hero',utm_source:'google'};
assert.throws(()=>validateLead({...input,phone:'123'}));
assert.throws(()=>validateLead({...input,request_id:'bad'}));
assert.throws(()=>validateLead({...input,zip:'752011'}));
assert.equal(validateLead({...input,_honey:'bot'}),null);
assert.equal(validateLead(input).phone,'+19728327618');
assert.throws(()=>validateUpdate({status:'inspection_scheduled'}));
assert.equal(validateUpdate({status:'do_not_contact',follow_up_at:new Date(Date.now()+3600000).toISOString()}).follow_up_at,null);
assert.equal(validateUpdate({status:'do_not_contact',follow_up_at:'2020-01-01T00:00:00Z'}).follow_up_at,null);
const dir=await mkdtemp(join(tmpdir(),'rockwall-leads-test-')),cwd=process.cwd();
try {
 process.chdir(dir);
 const store=createStore({LEADS_LOCAL_DEMO:'true'});
 const lead=validateLead(input);
 await Promise.all([store.capture(lead,'ip'),store.capture(lead,'ip')]);
 assert.equal((await store.list()).length,1);
 assert.equal((await store.jobs()).length,1);
 assert.equal((await createStore({LEADS_LOCAL_DEMO:'true'}).list()).length,1,'Data persists across store instances');
 let update=await store.update(lead.id,validateUpdate({status:'contact_attempted',notes:'Called; no answer',follow_up_at:new Date(Date.now()+3600000).toISOString()}),1);
 assert.equal(update.lead.version,2);
 assert.equal((await store.update(lead.id,{status:'lost'},1)).conflict,true);
 await store.update(lead.id,validateUpdate({status:'do_not_contact'}),2);
 assert.equal((await store.get(lead.id)).follow_up_at,null);
 assert.equal((await store.jobs()).length,1,'Closed lead removes callback reminders, keeps initial notification');
 for(let i=0;i<9;i++)await store.capture({...lead,id:randomUUID()},'ip');
 assert.equal((await store.capture({...lead,id:randomUUID()},'ip')).limited,true);
 assert.equal(createStore({LEADS_LOCAL_DEMO:'true',VERCEL:'1'}).local,false,'Local demo cannot run on Vercel');

 process.env.LEADS_LOCAL_DEMO='true';process.env.OWNER_ACCESS_KEY=key;delete process.env.VERCEL;
 const {default:handler,sendNotifications}=await import('../api/leads.mjs');
 async function request(method,body,auth){let status,data;const res={setHeader(){},status(s){status=s;return this;},json(d){data=d;}};await handler({method,body,headers:{authorization:auth},url:'/api/leads',socket:{remoteAddress:'test'}},res);return {status,data};}
 assert.equal((await request('GET')).status,401);
 assert.equal((await request('PATCH',{id:lead.id})).status,401);
 const captured=await request('POST',{...input,request_id:randomUUID()});assert.equal(captured.status,200);
 assert.equal((await request('GET',undefined,`Bearer ${key}`)).data.demo,true);
 assert.equal((await request('POST',{...input,phone:'abc'})).status,400);
 let emails=0;const original=globalThis.fetch;
 const fakeLead={...lead,status:'new'};let marked=0;
 const mock={local:false,jobs:async()=>[{id:'notification-1',lead_id:lead.id,kind:'new'}],get:async()=>fakeLead,markSent:async()=>marked++};
 const env={RESEND_API_KEY:'test',NOTIFICATION_FROM:'Test <test@example.com>',OWNER_NOTIFICATION_EMAIL:'owner@example.com'};
 try {
  globalThis.fetch=async()=>{emails++;return {ok:false};};await sendNotifications(mock,env);assert.equal(marked,0,'Failed email remains queued');
  globalThis.fetch=async(_url,opts)=>{assert.ok(opts.headers['Idempotency-Key']);assert.deepEqual(JSON.parse(opts.body).to,['owner@example.com']);return {ok:true};};await sendNotifications(mock,env);assert.equal(marked,1);
  mock.jobs=async()=>[{id:'callback',lead_id:lead.id,kind:'followup',created_at:'2026-01-01T00:00:00Z'}];fakeLead.status='do_not_contact';
  globalThis.fetch=async()=>{throw Error('Must not send stopped reminder');};await sendNotifications(mock,env);assert.equal(marked,2);
 } finally {globalThis.fetch=original;}
 assert.equal(emails,1);
 console.log('Passed: owner authentication, validation, duplicate protection, persistence, optimistic updates, reminder cancellation, rate limit, API capture, and email failure/retry. No external messages sent.');
} finally {process.chdir(cwd);await rm(dir,{recursive:true,force:true});}
