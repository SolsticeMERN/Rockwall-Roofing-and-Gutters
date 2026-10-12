import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {transformWithOxc} from 'vite';

const tsSource = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const {code} = await transformWithOxc(tsSource, 'app.ts');
const source = code.replace(/export\s+/g, '');
async function run({accepted=true,fail=false,phone='9728327618',honey='',placement='hero'}={}) {
 const handlers={};const status={textContent:''};const button={disabled:false};let reset=false,requests=0,invalid='';
 const form={dataset:{placement},phone:{value:phone,setCustomValidity(v){invalid=v},reportValidity(){},addEventListener(){}},reportValidity(){return true},addEventListener(n,fn){handlers[n]=fn},querySelector(s){return s.includes("status")?status:button},reset(){reset=true}};
 const win={dataLayer:[]};
 const context={window:win,document:{querySelectorAll(s){return s==='form[data-inspection-form]'?[form]:[]},querySelector(){return null}},URLSearchParams,location:{search:'?utm_source=google&gclid=test-id',origin:'https://example.com',pathname:'/'},crypto:{randomUUID(){return 'request-123'}},FormData:class {constructor() {return [['name','Test'],['phone',phone],['zip','75201'],['service','Roof repair'],['_honey',honey]]}},AbortSignal:{timeout(){}},fetch:async (url,options)=>{requests++; const body=JSON.parse(options.body);assert.equal(body.utm_source,'google');assert.equal(body.request_id,'request-123');if(fail)throw Error('offline');return {ok:true,json:async()=>({success:accepted})}}};
 vm.runInNewContext(source,context);await handlers.submit({preventDefault(){}});
 return {status,button,reset,requests,invalid,events:win.dataLayer};
}
for (const placement of ['hero','contact']) {const result=await run({placement});assert.equal(result.events[0].placement,placement);assert.equal(result.reset,true);}
const success=await run();assert.equal(success.reset,true);assert.equal(success.button.disabled,false);assert.equal(success.events[0].event,'inspection_request_accepted');assert.ok(!('phone' in success.events[0]));
for(const opts of [{accepted:false},{fail:true}]){const r=await run(opts);assert.equal(r.reset,false);assert.match(r.status.textContent,/couldn’t confirm/);assert.equal(r.events[0].event,'inspection_form_error');assert.equal(r.button.disabled,false)}
const bad=await run({phone:'123'});assert.equal(bad.requests,0);assert.ok(bad.invalid);
const spam=await run({honey:'bot'});assert.equal(spam.requests,0);
console.log('Passed: provider acceptance, provider rejection, network failure, invalid phone, spam field, attribution, no PII in conversion event.');
