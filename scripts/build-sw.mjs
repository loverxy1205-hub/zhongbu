import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets")).map((x) => `assets/${x}`);
const files = ["./", "index.html", "favicon.svg", ...assets];
const hash = createHash("sha256");
for (const f of files.filter((f) => f !== "./"))
  hash.update(await readFile(`dist/${f}`));
const revision = hash.digest("hex").slice(0, 16);
await writeFile(
  "dist/sw.js",
  `// Generated at build time. No remote APIs.
const PREFIX='zhongbu-'+self.registration.scope;
const CACHE=PREFIX+'-${revision}';
const FILES=${JSON.stringify(files)}.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(self.registration.scope))return;e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request,{ignoreVary:true});if(hit)return hit;try{return await fetch(e.request);}catch(error){if(e.request.mode==='navigate')return (await c.match(new URL('index.html',self.registration.scope).href,{ignoreVary:true}))||Response.error();throw error;}}));});
`,
);
console.log(`Offline bundle ${revision}: ${files.length} local resources`);
