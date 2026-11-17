// Schemas parse, the documented example validates, bad data is rejected, and the repo's real data is valid.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readJson, validate, checkReview, checkShops, loadData, ROOT } from '../tools/validate.mjs';
const rs = readJson('data/review.schema.json'), ss = readJson('data/shops.schema.json');
assert.equal(rs.type, 'object'); assert.equal(ss.type, 'array');
const ex = readJson('docs/example-review.json');
const ids = new Set([ex.shopId]);
assert.deepEqual(checkReview(ex, ids), [], 'documented example must validate');
// DATA.md example is the same JSON as docs/example-review.json
const md = fs.readFileSync(ROOT + '/DATA.md', 'utf8');
const mdJson = JSON.parse(md.split('## review file')[1].split('```json')[1].split('```')[0]);
assert.deepEqual(mdJson, ex, 'DATA.md example drifted from docs/example-review.json');
const bad = (mut, re) => { const r = structuredClone(ex); mut(r); const e = checkReview(r, ids); assert.ok(e.some((x) => re.test(x)), `expected ${re}, got ${JSON.stringify(e)}`); };
bad((r) => { r.coffee.aroma.quantity = 101; }, /above 100/);
bad((r) => { r.overall = 7.5; }, /expected integer/);
bad((r) => { r.space.score = -1; }, /below 0/);
bad((r) => { r.shopId = 'Bad Id'; }, /does not match/);
bad((r) => { r.visit.seat = 'floor'; }, /one of/);
bad((r) => { delete r.value; }, /value: required/);
bad((r) => { r.extra = 1; }, /unexpected field/);
bad((r) => { r.address = '1 High St'; }, /unexpected field/);
bad((r) => { r.notes = 'Ring them on 0131 496 0123'; }, /phone number/);
bad((r) => { r.reviewed = true; r.date = null; }, /expected string|need a date/);
bad((r) => { r.shopId = 'unknown-shop'; }, /not in data\/shops/);
bad((r) => { r.overall = null; }, /need an overall/);
// null means not recorded and is valid for pillars and lines
{ const r = structuredClone(ex); r.coffee.score = null; r.coffee.aroma.quantity = null; r.visit.priceGbp = null; assert.deepEqual(checkReview(r, ids), []); }
// shops
assert.deepEqual(checkShops([{ id: 'a-b', name: 'A', area: 'Leith' }]), []);
assert.ok(checkShops([{ id: 'a', name: 'A', area: 'x' }, { id: 'a', name: 'B', area: 'y' }]).some((e) => /duplicate/.test(e)));
assert.ok(checkShops([{ id: 'a', name: 'A', area: 'x', address: '1 High St' }]).length, 'address key rejected');
assert.ok(checkShops([{ id: 'a', name: 'A', area: 'x', website: 'http://x.com' }]).length, 'https only');
assert.ok(checkShops([{ id: 'a', name: 'A', area: 'Call 07700 900123' }]).some((e) => /phone/.test(e)));
// real data
const d = loadData(); assert.deepEqual(d.errs, [], d.errs.join('\n'));
// validator itself
assert.deepEqual(validate(null, { type: ['integer', 'null'] }), []);
console.log('schema ok: example valid, 13 rejections, real data valid (' + d.shops.length + ' shops, ' + d.reviews.length + ' reviews)');
