// Builds dist/ from data/ + site/. Uses sharp for local image processing. Deterministic: same inputs, same bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { processPhotos } from './photos.mjs';
import { ROOT, loadData, readJson } from './validate.mjs';

const CFG = readJson('site-config.json');
const ORIGIN = (process.env.SITE_ORIGIN || CFG.origin).replace(/\/$/, '');
const SISTER = 'https://mypod.pages.dev';
const EMAIL = 'myshop@lovelace.yv3.uk';
const DIST = path.join(ROOT, 'dist');
const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha10 = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 10);

const { shops, reviews, errs } = loadData();
if (errs.length) { console.error('Data errors:\n - ' + errs.join('\n - ')); process.exit(1); }
const shopById = new Map(shops.map((s) => [s.id, s]));
const published = reviews.filter((r) => r.reviewed).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.shopId < b.shopId ? -1 : 1));
const reviewedIds = new Set(published.map((r) => r.shopId));
const waiting = shops.filter((s) => !reviewedIds.has(s.id));

fs.rmSync(DIST, { recursive: true, force: true });
const out = (p, data) => { const f = path.join(DIST, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };

const photoMap = new Map();
for (const r of reviews) photoMap.set(r.shopId, await processPhotos(ROOT, DIST, r.shopId, r.photos));

// ---------- artwork: mypod's specimen-dot style (concentric rings + soft highlight + ink border), tinted per shop ----------
const TONES = ['#7f93b0', '#c27e4a', '#b0654a', '#c9a24a', '#5f9d73', '#c47aa0', '#7a6fa3'];
const CREMA = '#b8470c';
const dotSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="h" cx=".32" cy=".28" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="${c}"/><circle cx="32" cy="32" r="10.9" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="1.8"/><circle cx="32" cy="32" r="21.7" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1.8"/><circle cx="32" cy="32" r="30" fill="url(#h)"/><circle cx="32" cy="32" r="30" fill="none" stroke="#12161a" stroke-width="2"/></svg>\n`;
const dotFile = (c) => `/art/dot-${c.slice(1)}.svg`;
for (const c of [...TONES, CREMA]) out(dotFile(c).slice(1), dotSvg(c));
const toneFor = (id) => TONES[parseInt(sha10(id).slice(0, 6), 16) % TONES.length];
fs.copyFileSync(path.join(ROOT, 'site/art/mypod-capsule-192.png'), (fs.mkdirSync(path.join(DIST, 'art'), { recursive: true }), path.join(DIST, 'art/mypod-capsule-192.png')));
for (const f of fs.readdirSync(path.join(ROOT, 'site/fonts'))) { fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'site/fonts', f), path.join(DIST, 'fonts', f)); }

// ---------- css: strict CSP means no inline styles, so bar values are generated classes ----------
let css = fs.readFileSync(path.join(ROOT, 'site/style.css'), 'utf8');
css += '\n/* generated value classes */\n';
for (let v = 0; v <= 100; v++) css += `.v${v}{--v:${v}}`;
for (let p = -100; p <= 100; p++) css += `.p${p < 0 ? 'n' + -p : p}{--l:${p >= 0 ? 50 : +(50 + p / 2).toFixed(1)};--w:${+(Math.abs(p) / 2).toFixed(1)}}`;
for (let n = 0; n <= 12; n++) css += `.n${n}{--n:${n}}`;
const cssName = `style.${sha10(css)}.css`; out('assets/' + cssName, css);
const wjs = fs.readFileSync(path.join(ROOT, 'site/writer.js'));
const wName = `writer.${sha10(wjs)}.js`; out('assets/' + wName, wjs);

// ---------- html helpers ----------
const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const money = (n) => '£' + Number(n).toFixed(2);
const NAV = [['/', 'Visits'], ['/method/', 'Method'], ['/about/', 'About']];

const ldOrgs = [
  { '@type': 'Organization', '@id': 'https://lovelace.yv3.uk/#org', name: 'Lovelace', url: 'https://lovelace.yv3.uk', contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL } },
  { '@type': 'Organization', '@id': ORIGIN + '/#org', name: 'myshop', url: ORIGIN + '/', parentOrganization: { '@id': 'https://lovelace.yv3.uk/#org' }, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: EMAIL } },
  { '@type': 'WebSite', '@id': ORIGIN + '/#site', name: 'myshop', url: ORIGIN + '/', description: 'Coffee shop reviews: the cup, the space, the service and the value, with honest notes and one score.', publisher: { '@id': ORIGIN + '/#org' } },
];

function page({ title, desc, path: p, body, current, noindex, ld = [], mainClass = '' }) {
  const canon = ORIGIN + p;
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': [...ldOrgs, ...ld] }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><!-- Awin : We approve this site for @yv3.uk on ${CFG.awinApproved} --><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#12161a"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">${noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}<link rel="icon" href="${dotFile(CREMA)}" type="image/svg+xml"><link rel="alternate" type="application/atom+xml" title="myshop visits" href="/feed.xml"><meta property="og:type" content="website"><meta property="og:site_name" content="myshop"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}"><meta name="twitter:card" content="summary"><link rel="stylesheet" href="/assets/${cssName}"><script type="application/ld+json">${json}</script></head>
<body><a class="skip" href="#main">Skip to the receipt</a>
<div class="shell">
<header class="counter"><a class="mark" href="/" aria-label="myshop, home"><span class="my">my</span><span class="shop">shop</span></a><p class="tag">Coffee shops, itemised</p>
<nav aria-label="Main"><ul class="nav">${NAV.map(([h, l]) => `<li><a href="${h}"${current === h ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>
<a class="sister" href="${SISTER}" rel="noopener"><img src="/art/mypod-capsule-192.png" width="56" height="56" alt=""><span><small>Sister site</small><strong><span>my</span>pod</strong></span></a></header>
<div class="roll"><div class="slot" aria-hidden="true"></div>
<main id="main" class="receipt ${mainClass}">${body}</main>
<footer><div class="links"><a href="${SISTER}" rel="noopener">Sister site: mypod</a><a href="/method/">Method</a><a href="/about/">About</a><a href="/privacy/">Privacy</a><a href="/contact/">Contact</a><a href="/write/">Writer</a><a href="/feed.xml">Feed</a></div><p>Made by <a href="https://lovelace.yv3.uk">Kat Lovelace</a>. Honest notes, one score.</p><p class="fine">No cookies, no popups, no tracking.</p></footer></div></div>
</body></html>
`;
}

const barScore = (name, v, n) => (v === null
  ? `<div class="bar na" role="img" aria-label="${esc(name)}: not recorded"></div>`
  : `<div class="bar v${v} n${Math.min(n, 12)}" role="img" aria-label="${esc(name)}: ${v} out of 100"><i></i></div>`);
const barLine = (name, v, n) => {
  if (v === null) return `<div class="bar na" role="img" aria-label="${esc(name)}: not recorded"></div>`;
  const r = Math.round(v);
  return `<div class="bar line p${r < 0 ? 'n' + -r : r}${r < 0 ? ' neg' : ''} n${Math.min(n, 12)}" role="img" aria-label="${esc(name)}: position ${r} on a line from -100 to 100"><i></i></div>`;
};
const numScore = (v) => (v === null ? '<span class="nr">n/r</span>' : `${v}<small>/100</small>`);
const PILLARS = [['coffee', 'Coffee'], ['space', 'Space'], ['service', 'Service'], ['value', 'Value']];
const LINES = [['aroma', 'Aroma'], ['acidity', 'Acidity'], ['sweetness', 'Sweetness'], ['body', 'Body'], ['finish', 'Finish']];

function item(label, score, notes, n) {
  return `<li class="item"><div class="row"><span class="name">${label}</span><span class="dots" aria-hidden="true"></span><span class="num">${numScore(score)}</span></div>${barScore(label, score, n)}${notes ? `<p class="note">${esc(notes)}</p>` : ''}</li>`;
}

// ---------- pages ----------
function emptyItems() {
  return PILLARS.map(([, l]) => `<li class="item"><div class="row"><span class="name">${l}</span><span class="dots" aria-hidden="true"></span><span class="num"><span class="nr">not recorded</span></span></div><div class="bar na" role="img" aria-label="${l}: not recorded"></div></li>`).join('');
}

function entry(r) {
  const s = shopById.get(r.shopId);
  const mini = PILLARS.map(([k, l], i) => `<li><span class="name"><span>${l}</span><span>${r[k].score === null ? 'n/r' : r[k].score}</span></span>${barScore(l, r[k].score, i)}</li>`).join('');
  return `<li class="entry"><div class="head"><img src="${dotFile(toneFor(r.shopId))}" width="44" height="44" alt=""><div><p class="eyebrow">${esc(fmtDate(r.date))} · ${esc(s.area)}</p><h3><a href="/review/${r.shopId}/">${esc(s.name)}</a></h3></div><div class="sc" aria-label="Overall ${r.overall} out of 100">${r.overall}<small>/100</small></div></div><ul class="mini">${mini}</ul></li>`;
}

function home() {
  let body;
  if (!published.length) {
    body = `<div class="empty"><p class="eyebrow">Visit log · 0 visits</p><h1>No visits yet.</h1>
<p class="lede">The first coffee shop is still to be visited. When it is, the receipt prints here: the cup, the space, the service, the value, and one honest total.</p>
<hr class="rule"><ul class="items">${emptyItems()}</ul>
<div class="total"><span class="name">Total</span><span class="dots" aria-hidden="true"></span><span class="big"><span aria-label="no score yet">&ndash;</span><small>/100</small></span></div>
<p class="ghost">Nothing tasted. Nothing scored.</p>
<p class="body"><a class="button" href="/method/">How a visit is scored</a></p>
${waiting.length ? waitingList() : ''}</div>`;
  } else {
    body = `<p class="eyebrow">Visit log · ${published.length} visit${published.length === 1 ? '' : 's'} · newest first</p><h1>Coffee shops, itemised.</h1>
<p class="lede">The cup, the space, the service and the value, scored out of 100 with honest notes, then one total.</p>
<hr class="rule"><ol class="feed">${published.map(entry).join('')}</ol>${waiting.length ? waitingList() : ''}`;
  }
  return page({ title: 'myshop · coffee shop reviews, itemised', desc: 'Coffee shop reviews: the cup, the space, the service and the value, with honest notes and one score out of 100. Sister site of mypod.', path: '/', body, current: '/' });
}
function waitingList() {
  return `<h2>On the list</h2><ul class="shoplist">${waiting.map((s) => `<li><img src="${dotFile(toneFor(s.id))}" width="28" height="28" alt=""><span>${photoMap.get(s.id)?.length ? `<a href="/photos/${s.id}/">${esc(s.name)}</a>` : esc(s.name)} <span class="ghost">· ${esc(s.area)}</span></span><span class="st">${photoMap.get(s.id)?.length ? 'photos · not rated' : 'not visited yet'}</span></li>`).join('')}</ul>`;
}

function gallery(r) {
  const photos = photoMap.get(r.shopId) || [];
  if (!photos.length) return '';
  return '<section class="photos" aria-label="Visit photos"><h2>From the visit</h2><p class="note">Tap a photo to enlarge. Tap again to fold it away.</p><div class="photo-grid">' + photos.map(p => {
    const largest = p.variants.at(-1);
    const thumb = p.variants.find(v => v.width >= 480) || largest;
    return `<details class="photo"><summary><picture><source type="image/webp" srcset="${p.variants.map(v => v.webp + ' ' + v.width + 'w').join(', ')}" sizes="(max-width: 600px) 85vw, 320px"><img src="${thumb.jpeg}" srcset="${p.variants.map(v => v.jpeg + ' ' + v.width + 'w').join(', ')}" sizes="(max-width: 600px) 85vw, 320px" width="${p.width}" height="${p.height}" loading="lazy" decoding="async" alt="${esc(p.alt)}"></picture><span class="photo-label">${esc(p.caption || p.alt)} <span aria-hidden="true">＋</span></span></summary><picture class="photo-large"><source type="image/webp" srcset="${largest.webp}"><img src="${largest.jpeg}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}" loading="lazy" decoding="async"></picture></details>`;
  }).join('') + '</div></section>';
}

function reviewPage(r) {
  const s = shopById.get(r.shopId);
  const v = r.visit;
  const meta = [
    `<li>${esc(fmtDate(r.date))}</li>`, `<li>${esc(s.area)}</li>`,
    v.drink ? `<li>${esc(v.drink)}${v.priceGbp !== null ? ' · ' + money(v.priceGbp) : ''}</li>` : v.priceGbp !== null ? `<li>${money(v.priceGbp)}</li>` : '',
    v.seat ? `<li>${v.seat === 'in' ? 'Sat in' : 'Takeaway'}</li>` : '', v.when ? `<li>${esc(v.when)}</li>` : '', v.milk ? `<li>Milk: ${esc(v.milk)}</li>` : '',
  ].join('');
  const sheet = LINES.map(([k, l], i) => {
    const x = r.coffee[k];
    const row = (lab, val, j) => `<div class="pair"><span>${lab}</span>${barLine(`${l} ${lab.toLowerCase()}`, val, i * 2 + j)}<span class="num">${val === null ? 'n/r' : Math.round(val)}</span></div>`;
    return `<li class="item"><h3>${l}</h3>${row('Quantity', x.quantity, 0)}${row('Quality', x.quality, 1)}${x.notes ? `<p class="note">${esc(x.notes)}</p>` : ''}</li>`;
  }).join('');
  const body = `<p class="eyebrow"><a href="/">&larr; All visits</a></p>
<h1>${esc(s.name)}</h1><ul class="meta">${meta}</ul>${s.website ? `<p class="body"><a href="${esc(s.website)}" rel="noopener">${esc(s.website.replace(/^https:\/\//, '').replace(/\/$/, ''))}</a></p>` : ''}
${gallery(r)}<hr class="rule"><ul class="items">${PILLARS.map(([k, l], i) => item(l, r[k].score, r[k].notes, i)).join('')}</ul>
<details class="cup" open><summary>The cup, line by line</summary><p class="note">Tasting-sheet lines from -100 (left end) to 100 (right end), 0 at the centre tick. Blank means not recorded.</p><ul class="items">${sheet}</ul></details>
${r.flavour ? `<h2>Flavour</h2><p class="body">${esc(r.flavour)}</p>` : ''}
<div class="total"><span class="name">Total</span><span class="dots" aria-hidden="true"></span><span class="big" aria-label="Overall ${r.overall} out of 100">${r.overall}<small>/100</small></span></div>
<p class="body">${esc(r.notes)}</p><p class="ghost">The total is my own overall enjoyment, not an average of the lines above.</p>`;
  const ld = [{
    '@type': 'Review', '@id': `${ORIGIN}/review/${r.shopId}/#review`, url: `${ORIGIN}/review/${r.shopId}/`, datePublished: r.date,
    itemReviewed: { '@type': 'CafeOrCoffeeShop', name: s.name, ...(s.website ? { url: s.website } : {}) },
    reviewRating: { '@type': 'Rating', ratingValue: r.overall, bestRating: 100, worstRating: 0 },
    image: (photoMap.get(r.shopId) || []).map(p => ORIGIN + p.file),
    reviewBody: r.notes, author: { '@id': ORIGIN + '/#org' },
  }];
  return page({ title: `${s.name} · myshop review (${r.overall}/100)`, desc: `${s.name}, ${s.area}: ${r.overall}/100. ${r.notes}`.slice(0, 200), path: `/review/${r.shopId}/`, body, current: '/', ld });
}

const method = page({ title: 'Method · myshop', desc: 'How myshop scores a coffee shop: the cup on a tasting sheet, then space, service and value, then one honest total.', path: '/method/', current: '/method/', body: `<p class="eyebrow">The method</p><h1>One visit.<br>One receipt.</h1>
<p class="lede">I order a coffee, drink it while it is still a coffee, look around, and write it up the same day. Four lines and a total.</p>
<h2>The four lines</h2><ul class="body"><li><strong>Coffee</strong> is the cup itself, scored out of 100.</li><li><strong>Space</strong> is the room: seats, light, noise, whether I want to stay.</li><li><strong>Service</strong> is how it felt to order and be served.</li><li><strong>Value</strong> is whether the price felt right for what I got.</li></ul>
<p class="body">Each line gets a whole-number score out of 100 and a note. A blank means not recorded: it is never silently counted as 0.</p>
<h2>The cup, line by line</h2><p class="body">For the coffee I use the Prufrock tasting sheet, the same as on <a href="${SISTER}" rel="noopener">mypod</a>: aroma, acidity, sweetness, body and finish. Each has a quantity line and a quality line. The original sheet has unnumbered lines, so I record where I put each mark as a position from -100 (left end) to 100 (right end), with 0 at the centre. Flavour gets its own words.</p>
<h2>The total</h2><p class="body">The total is my own overall enjoyment out of 100. It is deliberately not an average, because a bad room can ruin a good coffee and the other way round.</p>
<h2>Nothing visited? Nothing scored.</h2><p class="body">A shop on the list that I have not visited shows as &ldquo;not visited yet&rdquo; with no score.</p>
<h2>About the source</h2><p class="body">The tasting lines are adapted with attribution from the Prufrock Coffee Tasting Guide. This site is independent and not endorsed by Prufrock. <a href="https://online.anyflip.com/svpga/rgww/mobile/index.html" rel="noopener">View the original sheet</a>.</p>
<p class="body"><a class="button" href="/">See the visits</a></p>` });

const about = page({ title: 'About · myshop', desc: 'myshop is a small independent site of coffee shop reviews, a sister site of mypod.', path: '/about/', current: '/about/', body: `<p class="eyebrow">About</p><h1>Small notes.<br>Big coffee.</h1>
<p class="lede">myshop reviews coffee shops: I visit, I score, I write it down honestly.</p>
<p class="body">It is the sister site of <a href="${SISTER}" rel="noopener">mypod</a>, which does the same for coffee pods. Same tasting sheet, different cup. Made by <a href="https://lovelace.yv3.uk">Kat Lovelace</a>.</p>
<p class="body">No cookies, no popups, no ads. Questions or corrections: <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>` });

const contact = page({ title: 'Contact · myshop', desc: 'Email myshop.', path: '/contact/', current: '', body: `<p class="eyebrow">Contact</p><h1>Say hello.</h1><p class="lede">Email is the only way to reach me: <a href="mailto:${EMAIL}">${EMAIL}</a>.</p><p class="body">Corrections to a review are welcome. I do not publish an address or a phone number.</p>` });

const privacy = page({ title: 'Privacy · myshop', desc: 'myshop sets no cookies and collects nothing.', path: '/privacy/', current: '', body: `<p class="eyebrow">Privacy</p><h1>Nothing collected.</h1><p class="lede">myshop sets no cookies, shows no popups and runs no tracking.</p><p class="body">If cookieless analytics is ever added (Cloudflare Web Analytics, which sets no cookies and does not fingerprint), this page will say so first. Email sent to <a href="mailto:${EMAIL}">${EMAIL}</a> is read by the site owner and not shared.</p><p class="body">The private writer form runs entirely in your browser. It sends nothing and stores nothing.</p>` });

function writerPage() {
  const sl = (key, label) => `<div class="slid untouched" data-key="${key}"><span aria-hidden="true">${label}</span><input type="range" min="-100" max="100" step="1" value="0" aria-label="${key.replace('.', ' ')}"><output aria-live="off">blank</output><button type="button" aria-label="Clear ${key.replace('.', ' ')}">Clear</button></div>`;
  const inp = (n, l, extra = '') => `<label>${l}<input name="${n}" ${extra}></label>`;
  const ta = (n, l, rows = 2) => `<label>${l}<textarea name="${n}" rows="${rows}"></textarea></label>`;
  const options = shops.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} · ${esc(s.area)}</option>`).join('');
  const body = `<p class="eyebrow"><span class="priv">Private writer</span></p><h1>Score a visit.</h1>
<p class="body">This form works only in your browser: nothing is sent or saved. Fill it in, make the JSON, and paste it into the repo (see <code>DATA.md</code>). Never include a street address or phone number.</p>
<noscript><p class="err">JavaScript is needed for the writer. You can edit the JSON files directly instead.</p></noscript>
<div class="writer"><form id="writer" novalidate>
<fieldset><legend>Import (optional)</legend><label for="import-json">Paste a review JSON to prefill every field</label><textarea id="import-json" rows="4" spellcheck="false" autocomplete="off"></textarea><div><button type="button" id="import-run">Import</button></div><div id="import-status" class="status" role="status"></div></fieldset>
<fieldset><legend>The shop</legend><label>Shop<select name="shop">${options}<option value="__new"${shops.length ? '' : ' selected'}>New shop&hellip;</option></select></label>
<div id="newshop" class="two" hidden>${inp('newName', 'Shop name', 'autocomplete="off"')}${inp('newId', 'Shop id (url slug)', 'autocomplete="off"')}${inp('newArea', 'Area (town or neighbourhood only)', 'autocomplete="off"')}${inp('newWebsite', 'Website (https://, optional)', 'type="url" autocomplete="off"')}</div>
</fieldset>
<fieldset><legend>The visit</legend><div class="two"><label>Date<input name="date" type="date"></label>${inp('drink', 'Drink')}${inp('price', 'Price paid, £', 'type="number" min="0" step="0.01" inputmode="decimal"')}${inp('when', 'When (free text)')}<label>Sat in or takeaway<select name="seat"><option value="">Not recorded</option><option value="in">Sat in</option><option value="takeaway">Takeaway</option></select></label>${inp('milk', 'Milk')}</div></fieldset>
<fieldset><legend>Coffee</legend>${inp('coffee.score', 'Coffee score, 0 to 100', 'type="number" min="0" max="100" step="1" inputmode="numeric"')}${ta('coffee.notes', 'Coffee notes')}
${LINES.map(([k, l]) => `<fieldset><legend>${l}</legend>${sl(k + '.quantity', 'Quantity')}${sl(k + '.quality', 'Quality')}${ta(k + '.notes', l + ' notes', 1)}</fieldset>`).join('')}
${ta('flavour', 'Flavour')}</fieldset>
${[['space', 'Space'], ['service', 'Service'], ['value', 'Value']].map(([k, l]) => `<fieldset><legend>${l}</legend>${inp(k + '.score', l + ' score, 0 to 100', 'type="number" min="0" max="100" step="1" inputmode="numeric"')}${ta(k + '.notes', l + ' notes')}</fieldset>`).join('')}
<fieldset><legend>Photos (optional)</legend><p class="note">JPEG, PNG, WebP or AVIF. Up to 12, 25 MB each. Photos stay on your device. Add an image description, then download each cleaned photo alongside the JSON. Only include photos you have permission to publish; check faces and visible personal details.</p><label>Attach photos<input id="photo-files" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple></label><div id="photo-fields"></div><p id="photo-status" role="status"></p></fieldset>
<fieldset><legend>The total</legend>${inp('overall', 'Overall enjoyment, 0 to 100 (required)', 'type="number" min="0" max="100" step="1" inputmode="numeric"')}${ta('notes', 'Overall notes (required)', 4)}</fieldset>
<ul id="errors" class="err" role="alert" tabindex="-1" hidden></ul>
<div><button class="primary" type="submit">Make the JSON</button></div><p id="result" class="status" role="status"></p>
<div id="outputs" hidden><p id="file-hint" class="body"></p>
<div id="shop-out" hidden><h3>Shop entry for data/shops.json</h3><pre id="out-shop" class="out"></pre><button type="button" data-copy="out-shop">Copy shop entry</button></div>
<h3>Review JSON</h3><pre id="out-review" class="out"></pre><button type="button" data-copy="out-review">Copy review JSON</button><button type="button" id="download-review">Download review JSON</button><div id="photo-downloads"></div></div>
</form></div><script src="/assets/${wName}" defer></script>`;
  return page({ title: 'Writer · myshop', desc: 'Private local form for scoring a coffee shop visit.', path: '/write/', current: '', noindex: true, body, mainClass: 'writer-page' });
}

const notFound = page({ title: 'Not found · myshop', desc: 'That page is not on the receipt.', path: '/404.html', current: '', noindex: true, body: `<p class="eyebrow">404</p><h1>Off the roll.</h1><p class="lede">That page is not on the receipt.</p><p class="body"><a class="button primary" href="/">Back to the visits</a></p>` });

// ---------- write pages ----------
out('index.html', home());
for (const r of reviews.filter(r => !r.reviewed && photoMap.get(r.shopId)?.length)) {
  const shop = shopById.get(r.shopId), photos = photoMap.get(r.shopId);
  out('photos/' + r.shopId + '/index.html', page({ title: shop.name + ' · Photos · myshop', desc: 'Photos of ' + shop.name + '. Not rated yet.', path: '/photos/' + r.shopId + '/', body: '<p class="eyebrow">PHOTO NOTES · NOT RATED</p><h1>' + esc(shop.name) + '</h1><p>' + esc(shop.area) + '</p><p>No review or scores yet.</p>' + gallery(r), ld: [{ '@type': 'ImageGallery', name: shop.name, image: photos.map(p => ORIGIN + p.file) }] }));
}
out('api/photos.json', JSON.stringify(reviews.filter(r => photoMap.get(r.shopId)?.length).map(r => ({ shopId: r.shopId, name: shopById.get(r.shopId).name, reviewed: r.reviewed, photos: photoMap.get(r.shopId).map(p => ({ ...p, file: ORIGIN + p.file, variants: p.variants.map(v => ({ ...v, jpeg: ORIGIN + v.jpeg, webp: ORIGIN + v.webp })) })) })), null, 2) + '\n');
for (const r of reviews.filter(r => !r.reviewed && photoMap.get(r.shopId)?.length)) out('photos/' + r.shopId + '/index.md', '# ' + shopById.get(r.shopId).name + '\n\nPhotos only. Not rated yet.\n\n' + photoMap.get(r.shopId).map(p => '![' + p.alt.replace(/[\[\]\n]/g, '') + '](' + ORIGIN + p.file + ')\n\n' + p.caption).join('\n\n') + '\n');
published.forEach((r) => out(`review/${r.shopId}/index.html`, reviewPage(r)));
out('method/index.html', method); out('about/index.html', about); out('contact/index.html', contact); out('privacy/index.html', privacy);
out('write/index.html', writerPage()); out('404.html', notFound);

out('api/reviews.json', JSON.stringify(published.map(r => ({ ...r, photos: (photoMap.get(r.shopId) || []).map(p => ({ ...p, file: ORIGIN + p.file, variants: p.variants.map(v => ({ ...v, jpeg: ORIGIN + v.jpeg, webp: ORIGIN + v.webp })) })) })), null, 2) + '\n');
for (const r of published) out('review/' + r.shopId + '/index.md', '# ' + shopById.get(r.shopId).name + '\n\n' + r.notes + '\n\n' + (photoMap.get(r.shopId) || []).map(p => '![' + p.alt.replace(/[\[\]\n]/g, '') + '](' + ORIGIN + p.file + ')' + (p.caption ? '\n\n' + p.caption : '')).join('\n\n') + '\n');
// ---------- feeds, sitemap, robots, llms ----------
const updated = (published[0]?.date || CFG.launched) + 'T00:00:00Z';
out('feed.xml', `<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><title>myshop visits</title><subtitle>Coffee shop reviews, newest first</subtitle><link href="${ORIGIN}/feed.xml" rel="self"/><link href="${ORIGIN}/"/><id>${ORIGIN}/</id><updated>${updated}</updated><author><name>myshop</name></author>${published.map((r) => { const s = shopById.get(r.shopId); return `<entry><title>${esc(s.name)} (${r.overall}/100)</title><link href="${ORIGIN}/review/${r.shopId}/"/><id>${ORIGIN}/review/${r.shopId}/</id><updated>${r.date}T00:00:00Z</updated><summary>${esc(r.notes)}</summary></entry>`; }).join('')}</feed>\n`);
const urls = [['/', updated.slice(0, 10), '1.0'], ['/method/', null, '0.5'], ['/about/', null, '0.3'], ['/contact/', null, '0.2'], ['/privacy/', null, '0.2'], ...published.map((r) => [`/review/${r.shopId}/`, r.date, '0.8']), ...reviews.filter(r => !r.reviewed && photoMap.get(r.shopId)?.length).map(r => [`/photos/${r.shopId}/`, null, '0.5'])];
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, d, pr]) => `<url><loc>${ORIGIN}${u}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}<priority>${pr}</priority></url>`).join('')}</urlset>\n`);
out('robots.txt', `User-agent: *\n# Content-Signal: search=yes, ai-input=yes, ai-train=no\nAllow: /\nDisallow: /write/\nSitemap: ${ORIGIN}/sitemap.xml\n`);
out('llms.txt', `# myshop\n\n> Coffee shop reviews: the cup, the space, the service and the value, scored out of 100 with honest notes. Sister site of mypod (${SISTER}).\n\n## Pages\n\n- [Visits](${ORIGIN}/): newest first (${published.length} so far)\n- [Method](${ORIGIN}/method/): how a visit is scored\n- [Feed](${ORIGIN}/feed.xml): Atom\n${published.map((r) => `- [${shopById.get(r.shopId).name}](${ORIGIN}/review/${r.shopId}/): ${r.overall}/100`).join('\n')}\n\nContact: ${EMAIL}\n`);

// ---------- headers (strict CSP: no inline script or style; add Cloudflare Web Analytics hosts here if it is ever enabled) ----------
out('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/fonts/*.woff2
  Cache-Control: public, max-age=31536000, immutable
/art/*
  Cache-Control: public, max-age=86400
/feed.xml
  Content-Type: application/atom+xml; charset=utf-8
/sitemap.xml
  Content-Type: application/xml; charset=utf-8
/llms.txt
  Content-Type: text/plain; charset=utf-8
/write/*
  X-Robots-Tag: noindex, nofollow
`);
console.log(`built ${published.length} review(s), ${shops.length} shop(s) -> dist/ (origin ${ORIGIN})`);

// Permanent redirects for the original photo-note identifier.
out('_redirects', '/photos/ramble-and-roast-coffee-bar/ /photos/ramble-and-roast-oxn/ 301\n/photos/ramble-and-roast-coffee-bar/* /photos/ramble-and-roast-oxn/:splat 301\n/review/ramble-and-roast-coffee-bar/ /photos/ramble-and-roast-oxn/ 301\n');
