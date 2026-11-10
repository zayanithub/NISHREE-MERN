import { createHash } from 'node:crypto';
import path from 'node:path';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const frontendRoot = fileURLToPath(new URL('../', import.meta.url));
const images = [
  {
    key: '/assets/saree girls image.jpg',
    input: 'src/assets/saree girls image.jpg',
    name: 'product-hub/hero',
    widths: [320, 480, 640, 768, 1024],
  },
  {
    key: '/assets/Regal Blush Saree in a Floral Arch.webp',
    input: 'src/assets/Regal Blush Saree in a Floral Arch.webp',
    name: 'account/dashboard-hero',
    widths: [320, 480, 640, 768, 1024, 1280, 1440],
    avifQuality: 52,
  },
  {
    key: '/assets/Opulent Indian Bridal Portrait.webp',
    input: 'src/assets/Opulent Indian Bridal Portrait.webp',
    name: 'account/campaign',
    widths: [320, 480, 640, 768, 1024, 1280],
    avifQuality: 52,
  },
  {
    key: '/homepage-images/showroom.png',
    input: 'public/homepage-images/showroom.png',
    name: 'homepage/showroom',
    widths: [480, 768, 1024, 1280, 1440, 1600],
    avifQuality: 46,
  },
  ...[
    'celestial-mandala',
    'heavenly-dancer',
    'neon-carnival',
    'blush-arch',
    'glass-reflections',
    'palace-editorial',
  ].map((name) => ({
    key: `/homepage-images/${name}.png`,
    input: `public/homepage-images/${name}.png`,
    name: `homepage/${name}`,
    widths: [480, 768, 1024, 1280, 1440, 1600],
  })),
  {
    key: '/assets/Nishree Attire Navbar Logo.png',
    input: 'src/assets/Nishree Attire Navbar Logo.png',
    name: 'brand/navbar-logo',
    widths: [64, 72, 84, 126, 144, 168, 180, 216, 252],
    logo: true,
  },
  ...[
    ['drape-detail', 1856, 2304],
    ['saree-flatlay', 940, 940],
    ['folded-silk', 1000, 1000],
    ['red-saree', 533, 659],
  ].map(([name, width, height]) => ({
    key: `/homepage-images/${name}.jpg`,
    input: `public/homepage-images/${name}.jpg`,
    name: `homepage/${name}`,
    widths: [320, 480, 640, 768, Math.min(960, width)],
    height,
  })),
  ...['033', '038', '043', '046', '048', '049', '050'].map((number) => ({
    key: `/catalogue-preview/NIA-SAMPLE-${number}.jpg`,
    input: `public/catalogue-preview/NIA-SAMPLE-${number}.jpg`,
    name: `catalogue/NIA-SAMPLE-${number}`,
    widths: [320, 480, 640, 800, 960],
  })),
];

const manifest = {};
const totals = new Map();

for (const image of images) {
  const inputPath = path.join(frontendRoot, image.input);
  const originalBytes = (await stat(inputPath)).size;
  const metadata = await sharp(inputPath).metadata();
  const widths = [...new Set(image.widths.filter((width) => width < metadata.width))];
  if (!widths.includes(metadata.width)) widths.push(metadata.width);

  manifest[image.key] = { avif: [], webp: [] };
  for (const width of widths.sort((a, b) => a - b)) {
    const resized = sharp(inputPath)
      .rotate()
      .resize({ width, fit: 'inside', withoutEnlargement: true });

    for (const format of ['avif', 'webp']) {
      const buffer = format === 'avif'
        ? await resized.clone().avif({ quality: image.logo ? 72 : image.avifQuality || 56, effort: 6 }).toBuffer()
        : await resized.clone().webp({ quality: image.logo ? 90 : 82, effort: 5 }).toBuffer();
      const contentHash = createHash('sha256').update(buffer).digest('hex').slice(0, 8);
      const fileName = `${path.basename(image.name)}-${width}-${contentHash}.${format}`;
      const outputPath = path.join(frontendRoot, 'public/optimized', image.name, fileName);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, buffer);

      manifest[image.key][format].push({
        src: `/optimized/${image.name}/${fileName}`,
        width,
      });
      totals.set(format, (totals.get(format) || 0) + buffer.byteLength);
    }
  }
  console.log(`${image.key}: ${originalBytes} bytes -> ${manifest[image.key].avif.length} responsive AVIF/WebP pairs`);
}

await writeFile(
  path.join(frontendRoot, 'src/utils/responsiveImageManifest.json'),
  `${JSON.stringify(manifest)}\n`,
);

for (const relativePath of [
  'public/homepage-images/showroom.png',
  'public/homepage-images/celestial-mandala.png',
  'public/homepage-images/heavenly-dancer.png',
  'public/homepage-images/neon-carnival.png',
  'public/homepage-images/blush-arch.png',
  'public/homepage-images/glass-reflections.png',
  'public/homepage-images/palace-editorial.png',
  'src/assets/saree showroom images.png',
  'src/assets/Royal Blue and Ivory Palace Wedding Editorial.png',
  'src/assets/Regal Blush Saree in a Floral Arch.png',
  'src/assets/Maroon Saree in a Festive Bridal Showroom.png',
  'src/assets/Opulent Indian Bridal Portrait.png',
  'src/assets/Royal Diwali Saree by the Palace.png',
  'src/assets/Nishree Attire Navbar Logo.png',
  'src/assets/Nishree Attaire Company Logo HD_640x640.png',
]) {
  const inputPath = path.join(frontendRoot, relativePath);
  const outputPath = inputPath.replace(/\.png$/i, '.webp');
  const isLogo = relativePath.includes('Logo');
  const result = await sharp(inputPath)
    .rotate()
    .resize({
      width: isLogo ? 640 : 1920,
      height: isLogo ? 640 : 1920,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: isLogo ? 88 : 82, effort: 5 })
    .toFile(outputPath);
  const originalBytes = (await stat(inputPath)).size;
  console.log(`${path.basename(relativePath)}: ${originalBytes} -> ${result.size} bytes`);
}

console.log(`Responsive output totals: AVIF ${totals.get('avif')} bytes, WebP ${totals.get('webp')} bytes`);
