import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const recipient = process.env.FORM_RECIPIENT_EMAIL || 'rockwallroofingandgutters@gmail.com';
if (!/^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(recipient)) throw new Error('FORM_RECIPIENT_EMAIL must be a valid email address.');
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const site = process.env.SITE_URL || (vercelHost ? 'https://' + vercelHost : 'http://localhost:4173');
const siteUrl = new URL(site);
if (!['https:', 'http:'].includes(siteUrl.protocol) || siteUrl.username || siteUrl.password || siteUrl.pathname !== '/' || siteUrl.search || siteUrl.hash) throw new Error('SITE_URL must be an HTTP(S) origin without credentials, a path, query, or fragment.');
const output = path.join(root, 'dist');
rmSync(output, { recursive: true, force: true });
cpSync(path.join(root, 'src'), output, { recursive: true });
function processFiles(dir) {
 for (const entry of readdirSync(dir, {withFileTypes:true})) {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) processFiles(file);
  else if (/\.(html|js)$/.test(file)) {
   let text=readFileSync(file, 'utf8');
   text=text.replaceAll('rockwallroofingandgutters@gmail.com',recipient).replaceAll('https://rockwall-dallas-roofing.heartyhaven9.chatgpt.site', siteUrl.origin);
   writeFileSync(file,text);
  }
 }
}
processFiles(output);
for (const asset of ['index.html','app.js','styles.css','privacy.html','thanks.html']) if (!existsSync(path.join(output, asset))) throw new Error('Missing output: '+asset);
const html=readFileSync(path.join(output,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){
 const target=match[1];
 if(!target.includes('://')&&!target.startsWith('mailto:')&&!target.startsWith('tel:')&&!existsSync(path.join(output,target))) throw new Error('Missing local asset: '+target);
}
console.log('Built static site in dist/.');
