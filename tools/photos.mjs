// Never copy originals to dist. Decode, orient and re-encode pixels without metadata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

export function photoSource(root, shopId, file) {
  if (!new RegExp('^data/photos/' + shopId + '/[a-z0-9][a-z0-9-]*\\.(jpg|jpeg|png|webp|avif)$').test(file)) throw new Error('Photo must belong to its shop, with a safe lowercase filename: ' + file);
  const base = path.resolve(root, 'data/photos', shopId);
  const source = path.resolve(root, file);
  if (!fs.realpathSync(source).startsWith(base + path.sep) || fs.realpathSync(base) !== base) throw new Error('Photo symlink escapes its shop');
  if (fs.statSync(source).size > 25 * 1024 * 1024) throw new Error('Photo exceeds 25 MB');
  return source;
}

export async function processPhotos(root, dist, shopId, photos = []) {
  if (photos.length > 12) throw new Error('At most 12 photos per review');
  const result = [];
  for (const photo of photos) {
    const source = photoSource(root, shopId, photo.file);
    const input = fs.readFileSync(source);
    const meta = await sharp(input, { limitInputPixels: 60000000 }).metadata();
    if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(meta.format) || (meta.pages || 1) > 1) throw new Error('Only still raster photos are supported');
    // Raw pixels form a hard metadata boundary, including EXIF, XMP, IPTC and GPS.
    const { data, info } = await sharp(input, { limitInputPixels: 60000000 }).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#fff' }).raw().toBuffer({ resolveWithObject: true });
    const hash = crypto.createHash('sha256').update(data).update(JSON.stringify(info)).digest('hex').slice(0, 12);
    const variants = [];
    for (const width of [...new Set([480, 960, info.width].map(w => Math.min(w, info.width)))].sort((a,b) => a-b)) {
      const variant = { width };
      for (const format of ['webp', 'jpeg']) {
        const url = '/photos/' + shopId + '/' + hash + '-' + width + (format === 'jpeg' ? '.jpg' : '.webp');
        const output = path.join(dist, url);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        const dimensions = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).resize({ width }).toFormat(format, { quality: format === 'webp' ? 82 : 85 }).toFile(output);
        variant[format] = url;
        variant.height = dimensions.height;
      }
      variants.push(variant);
    }
    const largest = variants.at(-1);
    result.push({ alt: photo.alt, caption: photo.caption || '', file: largest.jpeg, width: largest.width, height: largest.height, variants });
  }
  return result;
}
