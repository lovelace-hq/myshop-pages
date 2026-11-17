// Tiny JSON Schema validator for the subset used by data/*.schema.json.
// Keywords: type, enum, pattern, minimum, maximum, minLength, required, properties, additionalProperties, items, $ref (#/$defs/..).
// Returns an array of human-readable error strings; empty array = valid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const isType = (v, t) => (t === 'number' ? typeof v === 'number' && Number.isFinite(v) : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t);

export function validate(value, schema, root = schema, at = '$') {
  const errs = [];
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], root);
    if (!target) return [`${at}: unresolved ${schema.$ref}`];
    return validate(value, target, root, at);
  }
  if (schema.enum && !schema.enum.some((e) => e === value)) errs.push(`${at}: must be one of ${JSON.stringify(schema.enum)}`);
  if (schema.type) {
    const ts = [].concat(schema.type);
    if (!ts.some((t) => isType(value, t))) return [...errs, `${at}: expected ${ts.join('|')}, got ${typeOf(value)}`];
  }
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: does not match ${schema.pattern}`);
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${at}: too short`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errs.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errs.push(`${at}: above ${schema.maximum}`);
  }
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => errs.push(...validate(v, schema.items, root, `${at}[${i}]`)));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${at}.${k}: required`);
    for (const [k, s] of Object.entries(schema.properties || {})) if (k in value) errs.push(...validate(value[k], s, root, `${at}.${k}`));
    if (schema.additionalProperties === false) for (const k of Object.keys(value)) if (!(k in (schema.properties || {}))) errs.push(`${at}.${k}: unexpected field`);
  }
  return errs;
}

export const PHONE_LIKE = /(?:\+?\d[\d\s().-]{8,}\d)/;
export const BANNED_KEYS = /^(address|street|postcode|zip|phone|tel|telephone|mobile|email)$/i;

// Whole-data checks the schema cannot express: privacy rules, ids, reviewed/date coupling.
export function checkReview(r, shopIds) {
  const errs = validate(r, readJson('data/review.schema.json'));
  if (errs.length) return errs;
  if (!shopIds.has(r.shopId)) errs.push(`shopId ${r.shopId} is not in data/shops.json`);
  if (r.reviewed && !r.date) errs.push('reviewed reviews need a date');
  if (r.reviewed && r.overall === null) errs.push('reviewed reviews need an overall score');
  if (r.date && Number.isNaN(Date.parse(r.date + 'T00:00:00Z'))) errs.push(`date ${r.date} is not a real date`);
  errs.push(...privacy(r, `review ${r.shopId}`));
  return errs;
}

export function checkShops(shops) {
  const errs = validate(shops, readJson('data/shops.schema.json'));
  if (errs.length) return errs;
  const seen = new Set();
  for (const s of shops) {
    if (seen.has(s.id)) errs.push(`duplicate shop id ${s.id}`);
    seen.add(s.id);
    errs.push(...privacy(s, `shop ${s.id}`));
  }
  return errs;
}

// Never publish an address or phone number: no such keys, no phone-like digit runs in any string.
export function privacy(v, label, k = '') {
  const errs = [];
  if (k && BANNED_KEYS.test(k)) errs.push(`${label}: field "${k}" is not allowed (never publish address/phone)`);
  if (typeof v === 'string' && PHONE_LIKE.test(v.replace(/\d{4}-\d{2}-\d{2}/g, ''))) errs.push(`${label}: looks like a phone number: "${v.slice(0, 40)}"`);
  if (Array.isArray(v)) v.forEach((x) => errs.push(...privacy(x, label)));
  else if (v && typeof v === 'object') for (const [kk, x] of Object.entries(v)) errs.push(...privacy(x, label, kk));
  return errs;
}

export function loadData() {
  const shops = readJson('data/shops.json');
  const se = checkShops(shops);
  const ids = new Set(shops.map((s) => s.id));
  const reviews = [];
  const errs = [...se];
  const dir = path.join(ROOT, 'data/reviews');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (f !== `${r.shopId}.json`) errs.push(`${f}: file name must be <shopId>.json`);
    errs.push(...checkReview(r, ids).map((e) => `${f}: ${e}`));
    reviews.push(r);
  }
  return { shops, reviews, errs };
}
