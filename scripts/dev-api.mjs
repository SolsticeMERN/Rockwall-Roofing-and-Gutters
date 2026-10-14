import http from 'node:http';
if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('The demo API is local development only.');
// Local only: credentials are deliberately development-only and email delivery is disabled.
process.env.LEADS_LOCAL_DEMO = 'true';
process.env.OWNER_ACCESS_KEY ||= 'local-demo-owner-key-change-before-launch';
const { default: handler } = await import('../api/leads.mjs');
http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4174');
  if(url.pathname!=='/api/leads'){res.writeHead(404);res.end();return;}
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000){res.writeHead(413);res.end();return;}}
  req.body=body;req.query=Object.fromEntries(url.searchParams);
  res.status=code=>{res.statusCode=code;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
  try{await handler(req,res);}catch{res.status(500).json({error:'Unexpected server error.'});}
}).listen(4174,'127.0.0.1',()=>console.log('Demo API on http://127.0.0.1:4174. Owner key: local-demo-owner-key-change-before-launch. No emails are sent.'));
