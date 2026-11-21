// Import a single writer bundle. No network requests, paths supplied by users are never trusted.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, checkReview, checkShops } from './validate.mjs';
const file = process.argv[2];
if (!file || fs.statSync(file).size > 40 * 1024 * 1024) throw new Error('Supply a writer JSON file up to 40 MB');
const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
const r = bundle.review, shop = bundle.shop;
if (!r || !shop || shop.id !== r.shopId || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(shop.id)) throw new Error('Invalid shop/review bundle');
const pending = [];
for (const p of r.photos || []) {
  if (!p.data) continue;
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.data) || p.data.length > 5 * 1024 * 1024) throw new Error('Invalid embedded JPEG');
  if (!new RegExp('^data/photos/' + shop.id + '/[a-z0-9][a-z0-9-]*\\.jpg$').test(p.file)) throw new Error('Unsafe photo path');
  const target = path.join(ROOT,p.file);
  let ancestor = path.dirname(target);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  if (fs.realpathSync(ancestor) !== ancestor || (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())) throw new Error('Symlinks are not allowed');
  const {data, info} = await sharp(Buffer.from(p.data.split(',')[1], 'base64'), {limitInputPixels:60000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).raw().toBuffer({resolveWithObject:true});
  const clean = await sharp(data,{raw:info}).jpeg({quality:90}).toBuffer();
  pending.push([target,clean]); delete p.data;
}
const shops = JSON.parse(fs.readFileSync(path.join(ROOT,'data/shops.json'),'utf8'));
const updated = [...shops.filter(s=>s.id!==shop.id),shop];
const errors = [...checkShops(updated),...checkReview(r,new Set(updated.map(s=>s.id)))];
if (errors.length) throw new Error(errors.join('\n'));
for (const [target,bytes] of pending) {fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
fs.writeFileSync(path.join(ROOT,'data/shops.json'),JSON.stringify(updated,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'data/reviews',r.shopId+'.json'),JSON.stringify(r,null,2)+'\n');
console.log('Imported '+r.shopId+' with '+pending.length+' cleaned embedded photos. Run npm test, commit all changes, then publish master.');
