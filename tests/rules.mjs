// Rules carried over from mypod, checked on every built HTML page and in the repo.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PHONE_LIKE } from '../tools/validate.mjs';
const dist = path.join(ROOT, 'dist');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const all = walk(dist), pages = all.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(dist, f);
assert.ok(pages.length >= 7);
const EMAIL = 'myshop@lovelace.yv3.uk';
for (const f of pages) {
  const h = fs.readFileSync(f, 'utf8'), n = rel(f);
  const head = h.slice(0, h.indexOf('</head>'));
  // Awin approval comment, in <head>, exact shape, UTC datetime
  assert.match(head, /<!-- Awin : We approve this site for @yv3\.uk on \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z -->/, n + ': Awin comment in head');
  // footer credit
  assert.match(h, /Made by <a href="https:\/\/lovelace\.yv3\.uk">Kat Lovelace<\/a>/, n + ': footer credit');
  // sister site cross-link
  assert.ok(h.includes('href="https://mypod.yv3.uk"'), n + ': sister link to mypod');
  assert.match(h, /Sister site/, n + ': sister label');
  // no cookie banner / popup / consent / third-party scripts / analytics yet
  assert.ok(!/cookie(?!s, no popups|s and collects| ?less|s\b)/i.test(h.replace(/No cookies, no popups, no tracking\./g, '').replace(/sets no cookies/g, '')), n + ': cookie wording');
  assert.ok(!/(consent|gdpr|modal|popup|dialog|newsletter)/i.test(h.replace(/no popups/gi, '').replace(/popups/gi, '')), n + ': banner/popup markup');
  assert.ok(!/document\.cookie|localStorage|sessionStorage/.test(h), n + ': storage');
  assert.ok(!/cloudflareinsights|google-analytics|gtag|googletagmanager|plausible|fbq\(/i.test(h), n + ': analytics not added yet');
  assert.ok(![...h.matchAll(/<script[^>]+src="([^"]+)"/g)].some(([, s]) => /^(https?:)?\/\//.test(s)), n + ': no external scripts');
  assert.ok(![...h.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"[^>]*\b(?:rel="stylesheet")/g)].length, n + ': no external stylesheets');
  // JSON-LD Organization: contact email only, no phone/address
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const orgs = ld['@graph'].filter((g) => g['@type'] === 'Organization');
  assert.ok(orgs.length >= 1);
  for (const o of orgs) { assert.equal(o.contactPoint.email, EMAIL, n); assert.ok(!('telephone' in o) && !('address' in o) && !('telephone' in o.contactPoint) && !('address' in o.contactPoint), n + ': org must not have phone/address'); assert.deepEqual(Object.keys(o.contactPoint).sort(), ['@type', 'contactType', 'email']); }
  const ldText = JSON.stringify(ld);
  assert.ok(!/"(telephone|faxNumber|address|streetAddress|postalCode)"/.test(ldText), n + ': no phone/address keys in JSON-LD');
  // visible text never contains a phone number
  const text = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' | ');
  assert.ok(!PHONE_LIKE.test(text.replace(/\d{4}-\d{2}-\d{2}/g, '').replace(/-?\d+ to -?\d+/g, '')), n + ': phone-like text: ' + (text.match(PHONE_LIKE) || [])[0]);
  // lowercase 'my' wordmark
  assert.match(h, /<span class="my">my<\/span><span class="shop">shop<\/span>/, n + ': wordmark');
  assert.match(h, /<meta name="viewport"/); assert.match(h, /<title>[^<]+<\/title>/);
}
// contact page offers the email, only the email
const contact = fs.readFileSync(dist + '/contact/index.html', 'utf8'); assert.ok(contact.includes(`mailto:${EMAIL}`));
// sister cross-link works both ways at the data level: mypod URL is the live sister
assert.ok(fs.readFileSync(dist + '/index.html', 'utf8').includes('/art/mypod-capsule-192.png'), 'uses real mypod artwork');
// artwork is reused, never homemade: only the mypod capsule PNG (byte-identical) and the dot-style SVGs generated from mypod's dot recipe
const mine = fs.readFileSync(dist + '/art/mypod-capsule-192.png'), theirs = '/home/diff/mypod-pages/icons/pod-192.png';
if (fs.existsSync(theirs)) assert.ok(mine.equals(fs.readFileSync(theirs)), 'capsule art is byte-identical to mypod icon');
// repo-level: no secrets, no env files, no address/phone in repo data, AGENTS rules present
const tracked = walk(ROOT).filter((f) => !/node_modules|\/\.git\/|\/dist\//.test(f));
for (const f of tracked) { const b = path.basename(f); assert.ok(!/^\.env($|\.)/.test(b) || b === '.env.example', 'no env file: ' + b); assert.ok(!/\.(pem|key)$/.test(b), 'no key file: ' + b); }
for (const f of tracked.filter((f) => /\.(json|md|mjs|yml|js|css)$/.test(f))) { const t = fs.readFileSync(f, 'utf8'); assert.ok(!/CLOUDFLARE_API_TOKEN\s*[=:]\s*['"]?[A-Za-z0-9_-]{20,}/.test(t), 'token literal in ' + path.relative(ROOT, f)); }
assert.ok(fs.existsSync(ROOT + '/AGENTS.md'));
console.log('rules ok on ' + pages.length + ' pages');
