// Generates responsive AVIF + WebP variants for every source image in a folder.
// Usage: node scripts/build-images.mjs <source-folder>
// Sources are pre-sized at roughly 2x their largest display size. Output goes to
// public/img/ and a manifest (sizes, widths, alpha) goes to src/data/images.json.
import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';

const SRC = process.argv[2];
if (!SRC) throw new Error('Pass the source folder');
const OUT = 'public/img';
const STEPS = [400, 640, 828, 1080, 1440, 1920, 2624];
// Figma captures of UI pieces (screens, panels, type) keep text crisp with a higher quality setting.
const UI = /^(atlas-(colour|logo-system|card-|app|send|website|applications|chip-crop|concept|construction|newcard|anim)|home-pog-social|pog-thumb|pog-ohno)/;

await mkdir(OUT, { recursive: true });
const manifest = {};
const files = (await readdir(SRC)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();

for (const file of files) {
  const name = parse(file).name;
  const input = sharp(join(SRC, file));
  const meta = await input.metadata();
  const alpha = meta.hasAlpha && (await input.stats()).channels[3]?.min < 255;
  const widths = STEPS.filter((w) => w < meta.width * 0.92);
  widths.push(meta.width);
  const ui = UI.test(name);
  for (const w of widths) {
    const base = sharp(join(SRC, file)).resize({ width: w, withoutEnlargement: true });
    await base.clone().avif({ quality: ui ? 70 : 58, effort: 5, chromaSubsampling: ui ? '4:4:4' : '4:2:0' }).toFile(join(OUT, `${name}-${w}.avif`));
    await base.clone().webp({ quality: ui ? 88 : 80, effort: 5, alphaQuality: 90 }).toFile(join(OUT, `${name}-${w}.webp`));
  }
  const { dominant } = await sharp(join(SRC, file)).stats();
  manifest[name] = {
    width: meta.width,
    height: meta.height,
    widths,
    alpha: Boolean(alpha),
    color: `rgb(${dominant.r},${dominant.g},${dominant.b})`,
  };
  console.log(name, meta.width, 'x', meta.height, widths.join(','));
}

await writeFile('src/data/images.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Done: ${files.length} images`);
