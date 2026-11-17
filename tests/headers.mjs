// _headers contract: parse it, no header set twice for the same URL, assets immutable + fingerprinted, strict CSP matches the markup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from '../tools/validate.mjs';
const dist = path.join(ROOT, 'dist');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(dist), rel = (f) => '/' + path.relative(dist, f).split(path.sep).join('/');
// parse _headers (Cloudflare Pages format)
const rules = []; let cur = null;
for (const line of fs.readFileSync(dist + '/_headers', 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; rules.push(cur); } else { const i = line.indexOf(':'); cur.headers.push([line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()]); }
}
const re = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
const match = (u) => rules.filter((r) => re(r.pattern).test(u));
const hdr = (u) => { const m = new Map(); for (const r of match(u)) for (const [k, v] of r.headers) { assert.ok(!m.has(k), `${u}: header ${k} set by two rules (Pages would join the values)`); m.set(k, v); } return m; };
const urls = new Set(['/']); for (const f of files) { const u = rel(f); urls.add(u); if (u.endsWith('/index.html')) urls.add(u.slice(0, -10)); }
for (const u of urls) hdr(u);
// security headers everywhere
for (const u of ['/', '/write/', '/404.html', '/feed.xml']) { const h = hdr(u); assert.equal(h.get('x-content-type-options'), 'nosniff', u); assert.ok(h.get('referrer-policy'), u); assert.ok(h.get('content-security-policy'), u); assert.equal(h.get('x-frame-options'), 'DENY'); }
assert.match(hdr('/write/').get('x-robots-tag'), /noindex/);
// CSP: no inline script/style allowed, and markup honours that
const csp = hdr('/').get('content-security-policy');
assert.match(csp, /default-src 'self'/); assert.ok(!/unsafe-inline|unsafe-eval/.test(csp), 'no unsafe-inline/eval'); assert.match(csp, /frame-ancestors 'none'/);
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const h = fs.readFileSync(f, 'utf8');
  assert.ok(!/<style[\s>]/.test(h), rel(f) + ': inline <style>');
  assert.ok(!/\sstyle="/.test(h), rel(f) + ': inline style attribute');
  assert.ok(!/\son[a-z]+="/.test(h), rel(f) + ': inline event handler');
  for (const m of h.matchAll(/<script\b([^>]*)>/g)) assert.ok(/type="application\/ld\+json"/.test(m[1]) || /src="\/assets\/writer\.[0-9a-f]{10}\.js"/.test(m[1]), rel(f) + ': unexpected script ' + m[1]);
}
// assets: fingerprinted = content hash, immutable cache
const assets = files.map(rel).filter((u) => u.startsWith('/assets/')); assert.ok(assets.length >= 2);
for (const u of assets) {
  assert.match(u, /^\/assets\/[a-z]+\.[0-9a-f]{10}\.(css|js)$/, u);
  assert.equal(hdr(u).get('cache-control'), 'public, max-age=31536000, immutable', u);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dist + u)).digest('hex').slice(0, 10), u.split('.')[1], 'fingerprint is the content hash');
}
for (const f of files.filter((f) => f.endsWith('.woff2'))) { assert.equal(hdr(rel(f)).get('cache-control'), 'public, max-age=31536000, immutable'); assert.ok(fs.statSync(f).size < 60000, 'font subset'); }
assert.deepEqual(files.filter((f) => /\.(ttf|otf)$/.test(f)), [], 'no TTF/OTF shipped');
// every font url in the css exists
const css = fs.readFileSync(dist + assets.find((a) => a.endsWith('.css')), 'utf8');
for (const [, u] of css.matchAll(/url\('([^']+)'\)/g)) assert.ok(fs.existsSync(dist + u), 'css url exists ' + u);
assert.equal(hdr('/feed.xml').get('content-type'), 'application/atom+xml; charset=utf-8');
console.log('headers ok (' + rules.length + ' rules, ' + assets.length + ' fingerprinted assets)');
