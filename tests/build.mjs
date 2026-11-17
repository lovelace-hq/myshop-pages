// Build output: empty state, a fixture build with reviews, newest-first order, 404s, no unresolved files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../tools/validate.mjs';
const dist = path.join(ROOT, 'dist');
const read = (p) => fs.readFileSync(path.join(dist, p), 'utf8');
const real = JSON.parse(fs.readFileSync(ROOT + '/data/shops.json', 'utf8')).length === 0;
if (real) {
  const h = read('index.html');
  assert.match(h, /No visits yet\./); assert.match(h, /Nothing tasted\. Nothing scored\./);
  assert.ok(!fs.existsSync(path.join(dist, 'review')), 'no review pages with zero reviews');
  assert.match(read('feed.xml'), /<feed /); assert.ok(!/<entry>/.test(read('feed.xml')));
}
for (const p of ['index.html', 'method/index.html', 'about/index.html', 'contact/index.html', 'privacy/index.html', 'write/index.html', '404.html', 'sitemap.xml', 'robots.txt', 'llms.txt', '_headers'])
  assert.ok(fs.existsSync(path.join(dist, p)), p + ' exists');
assert.ok(!read('sitemap.xml').includes('/write/'), 'writer not in sitemap'); assert.match(read('write/index.html'), /noindex/);
assert.match(read('robots.txt'), /Disallow: \/write\//);
// every local href/src resolves
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(dist).filter((f) => f.endsWith('.html'))) {
  for (const [, u] of fs.readFileSync(f, 'utf8').matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const t = path.join(dist, u); const ok = fs.existsSync(t) && (fs.statSync(t).isFile() || fs.existsSync(path.join(t, 'index.html')));
    assert.ok(ok, `${path.relative(dist, f)}: broken link ${u}`);
  }
}
// Fixture build in a temp copy: two reviews, newest first, unvisited shop listed, null shown as not recorded.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myshop-test-'));
try {
  for (const d of ['tools', 'site', 'data', 'docs']) fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
  fs.copyFileSync(ROOT + '/package.json', tmp + '/package.json'); fs.copyFileSync(ROOT + '/site-config.json', tmp + '/site-config.json');
  const ex = JSON.parse(fs.readFileSync(ROOT + '/docs/example-review.json', 'utf8'));
  const shops = [{ id: 'old-one', name: 'Old One', area: 'Leith' }, { id: 'new-one', name: 'New One', area: 'Stockbridge' }, { id: 'later', name: 'Later', area: 'Glasgow' }];
  fs.writeFileSync(tmp + '/data/shops.json', JSON.stringify(shops));
  for (const [id, date, o] of [['old-one', '2026-10-01', 55], ['new-one', '2026-11-05', 88]]) {
    const r = structuredClone(ex); r.shopId = id; r.date = date; r.overall = o; if (id === 'old-one') { r.coffee.score = null; r.coffee.aroma.quantity = null; }
    fs.writeFileSync(`${tmp}/data/reviews/${id}.json`, JSON.stringify(r));
  }
  execFileSync('node', ['tools/build.mjs'], { cwd: tmp, stdio: 'pipe' });
  const home = fs.readFileSync(tmp + '/dist/index.html', 'utf8');
  assert.ok(home.indexOf('New One') < home.indexOf('Old One'), 'newest first');
  assert.match(home, /On the list/); assert.match(home, /Later/); assert.match(home, /not visited yet/);
  const old = fs.readFileSync(tmp + '/dist/review/old-one/index.html', 'utf8');
  assert.match(old, /Coffee: not recorded/); assert.match(old, /Aroma quantity: not recorded/);
  assert.match(old, /"@type":"Review"/); assert.match(old, /"ratingValue":55/);
  assert.ok(!fs.existsSync(tmp + '/dist/review/later'), 'unvisited shop has no review page');
  const feed = fs.readFileSync(tmp + '/dist/feed.xml', 'utf8');
  assert.ok(feed.indexOf('New One') < feed.indexOf('Old One'), 'feed newest first');
  // placeholder reviews (reviewed:false) stay unpublished
  const ph = structuredClone(ex); ph.shopId = 'later'; ph.reviewed = false; ph.date = null; ph.overall = null;
  fs.writeFileSync(tmp + '/data/reviews/later.json', JSON.stringify(ph));
  execFileSync('node', ['tools/build.mjs'], { cwd: tmp, stdio: 'pipe' });
  assert.ok(!fs.existsSync(tmp + '/dist/review/later'), 'reviewed:false not published');
  // bad data fails the build
  fs.writeFileSync(tmp + '/data/reviews/later.json', JSON.stringify({ ...ph, notes: 'phone 0131 496 0123' }));
  assert.throws(() => execFileSync('node', ['tools/build.mjs'], { cwd: tmp, stdio: 'pipe' }), /./);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log('build ok');
