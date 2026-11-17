// Compares dist/ (built from master) with the live site. Exit 1 on any difference.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './validate.mjs';
const origin = (process.env.LIVE_ORIGIN || JSON.parse(fs.readFileSync(ROOT + '/site-config.json', 'utf8')).origin).replace(/\/$/, '');
const dist = path.join(ROOT, 'dist');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const strip = (s) => s.replace(/<script[^>]*cloudflareinsights[^>]*><\/script>/g, '').replace(/<script[^>]*static\.cloudflareinsights[^>]*>[\s\S]*?<\/script>/g, '');
let bad = 0;
for (const f of walk(dist)) {
  const rel = path.relative(dist, f).split(path.sep).join('/');
  if (rel === '_headers') continue;
  const url = origin + '/' + rel.replace(/index\.html$/, '');
  const res = await fetch(url, { redirect: 'follow' });
  const live = Buffer.from(await res.arrayBuffer()), mine = fs.readFileSync(f);
  const same = /\.(html|xml|txt|css|js|svg)$/.test(rel) ? strip(live.toString()) === strip(mine.toString()) : live.equals(mine);
  if (!res.ok || !same) { bad++; console.log('DRIFT', res.status, rel); }
}
console.log(bad ? `${bad} file(s) differ from ${origin}` : `no drift against ${origin}`);
process.exit(bad ? 1 : 0);
