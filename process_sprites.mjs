import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const SRC = 'c:/Users/camer/OneDrive/Desktop/Digital Earl/Earl Visual assets';
const DST1 = 'c:/Users/camer/OneDrive/Desktop/Digital Earl/earl/assets/sprites';
const DST2 = 'c:/Users/camer/OneDrive/Desktop/Digital Earl/earl/src/assets/sprites';
const SIZE = 128;

// Map source filename -> target filename(s)
const sprites = [
  { src: 'Pouty.png',          dst: 'pouty.png' },
  { src: 'Puffed up.png',      dst: 'puffed_up.png' },
  { src: 'huffy.png',          dst: 'huffy.png' },
  { src: 'Tantrum stomp.png',  dst: 'tantrum_stomp.png' },
  { src: 'Wall bump.png',      dst: 'wall_bump.png' },
  { src: 'Dizzy.png',          dst: 'dizzy.png' },
  { src: 'Tumble.png',         dst: 'tumble.png' },
  { src: 'Run step 1.jpg',     dst: 'run_step1.png' },
];

// Also create mirrored versions for these
const mirrorSprites = [
  { src: 'run_step1.png', dst: 'run_step1_left.png' },
];

async function processSprite(srcPath, dstName) {
  console.log(`Processing ${path.basename(srcPath)} -> ${dstName}`);

  // Read image, resize to 128x128, ensure PNG with alpha
  let img = sharp(srcPath)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();

  let buf = await img.toBuffer();

  // Remove white/near-white background pixels using raw pixel manipulation
  const raw = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const pixels = Buffer.from(data);

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
    if (a === 0) continue;

    // Detect white/near-white background
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
    const bright = maxC / 255;

    // Remove pure white / near-white with low saturation
    if (bright > 0.92 && sat < 0.08) {
      pixels[i+3] = 0; // make transparent
    }
    // Clean up semi-transparent low-sat fringe
    else if (a < 180 && sat < 0.15 && bright > 0.7) {
      pixels[i+3] = 0;
    }
    // Kill very low alpha fringe
    else if (a < 30) {
      pixels[i+3] = 0;
    }
  }

  // Rebuild PNG from cleaned pixels
  buf = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  // Write to both destinations
  const dst1 = path.join(DST1, dstName);
  const dst2 = path.join(DST2, dstName);
  fs.writeFileSync(dst1, buf);
  fs.writeFileSync(dst2, buf);
  console.log(`  -> ${dst1}`);
  console.log(`  -> ${dst2}`);

  return buf;
}

async function mirrorSprite(srcName, dstName) {
  console.log(`Mirroring ${srcName} -> ${dstName}`);
  const srcBuf = fs.readFileSync(path.join(DST2, srcName));
  const buf = await sharp(srcBuf).flop().png().toBuffer();
  fs.writeFileSync(path.join(DST1, dstName), buf);
  fs.writeFileSync(path.join(DST2, dstName), buf);
  console.log(`  -> done`);
}

async function main() {
  for (const s of sprites) {
    await processSprite(path.join(SRC, s.src), s.dst);
  }
  for (const m of mirrorSprites) {
    await mirrorSprite(m.src, m.dst);
  }
  console.log('\nAll sprites processed!');
}

main().catch(e => { console.error(e); process.exit(1); });
