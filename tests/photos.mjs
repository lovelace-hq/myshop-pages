import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { processPhotos, photoSource } from '../tools/photos.mjs';
import { ROOT, checkReview, readJson } from '../tools/validate.mjs';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'myshop-photos-'));
try {
  fs.mkdirSync(tmp + '/data/photos/test', { recursive: true });
  const input = tmp + '/data/photos/test/sample.jpg';
  await sharp({ create: { width: 1900, height: 1100, channels: 3, background: '#b36945' } })
    .withExif({ IFD0: { Artist: 'PRIVATE ARTIST', Copyright: 'PRIVATE COPYRIGHT' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '54/1 20/1 1/1', GPSLongitudeRef: 'W', GPSLongitude: '2/1 10/1 1/1' } })
    .jpeg().toFile(input);
  assert.ok((await sharp(input).metadata()).exif, 'fixture really has EXIF');
  const p = {file:'data/photos/test/sample.jpg', alt:'Test photo', caption:'A caption'};
  const photos = await processPhotos(tmp, tmp + '/dist', 'test', [p]);
  assert.equal(photos.length, 1); assert.equal(photos[0].width, 1600);
  assert.deepEqual(photos[0].variants.map(v => v.width), [480, 960, 1600]);
  for (const v of photos[0].variants) for (const format of ['jpeg','webp']) {
    const f = path.join(tmp, 'dist', v[format]), meta = await sharp(f).metadata();
    assert.equal(meta.width, v.width); assert.equal(meta.height, v.height);
    for (const key of ['exif','xmp','iptc','icc']) assert.equal(meta[key], undefined, 'no ' + key);
    assert.ok(!fs.readFileSync(f).includes(Buffer.from('PRIVATE')));
  }
  assert.throws(() => photoSource(tmp, 'test', 'data/photos/test/../../escape.jpg'));
  assert.throws(() => photoSource(tmp, 'test', 'data/photos/other/sample.jpg'));
  fs.symlinkSync(input, tmp + '/data/photos/test/link.jpg');
  // Same-shop symlinks remain within trust boundary; outside symlinks are forbidden.
  fs.symlinkSync('/etc/passwd', tmp + '/data/photos/test/outside.jpg');
  assert.throws(() => photoSource(tmp, 'test', 'data/photos/test/outside.jpg'));
  const again = await processPhotos(tmp, tmp + '/again', 'test', [p]);
  assert.deepEqual(again, photos, 'stable names/output');
  await assert.rejects(() => processPhotos(tmp, tmp + '/dist', 'test', Array(13).fill(p)));
  const r = readJson('docs/example-review.json'), ids = new Set([r.shopId]);
  for (const photos of [[{...p, file:'https://evil.test/a.jpg'}], [{...p, alt:''}], Array(13).fill(p), [{...p, file:'data/photos/other/sample.jpg'}]]) {
    assert.ok(checkReview({...r,photos}, ids).length, 'reject malformed photos');
  }
  const html = fs.readFileSync(ROOT + '/dist/review/ramble-and-roast-oxn/index.html','utf8');
  assert.match(html, /<details class="photo">/); assert.match(html, /srcset=/);
  assert.match(html, /loading="lazy"/); assert.match(html, /width="1600" height="900"/);
  assert.ok(html.includes('"@type":"Review"'), 'owner supplied full review');
  assert.ok(!html.includes('undefined')); assert.match(html, /"ratingValue":95/);
  assert.match(html, /rel="canonical" href="https:\/\/mycoffeeshop.pages.dev\/review\/ramble-and-roast-oxn\/"/);
  assert.equal(JSON.parse(fs.readFileSync(ROOT+'/dist/api/photos.json'))[0].photos.length,2);
  assert.ok(!fs.existsSync(ROOT+'/dist/data/photos'), 'no originals exposed');
  assert.match(fs.readFileSync(ROOT+'/dist/review/ramble-and-roast-oxn/index.md','utf8'), /https:\/\/mycoffeeshop.pages.dev\/photos\//);
} finally { fs.rmSync(tmp, { recursive:true, force:true }); }
console.log('photos ok: EXIF/GPS stripped, variants, dimensions, deterministic, safe paths, limits, gallery/API/markdown');

assert.match(fs.readFileSync(ROOT + '/dist/_redirects', 'utf8'), /ramble-and-roast-coffee-bar\/ \/review\/ramble-and-roast-oxn\/ 301/);
