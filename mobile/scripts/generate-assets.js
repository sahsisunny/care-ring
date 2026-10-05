const Jimp = require('jimp-compact');
const path = require('path');
const fs = require('fs');

const BG_COLOR_INT = Jimp.rgbaToInt(10, 15, 29, 255); // #0A0F1D
const MOBILE_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(MOBILE_ROOT, 'assets');
const RES_DIR = path.join(MOBILE_ROOT, 'android/app/src/main/res');

async function generateAll() {
  console.log('Loading source icon.png...');
  const icon = await Jimp.read(path.join(ASSETS_DIR, 'icon.png'));
  const w = icon.bitmap.width;
  const h = icon.bitmap.height;

  // 1. Extract clean transparent foreground of glowing rings
  const fg = icon.clone();
  const bgR = 10, bgG = 23, bgB = 48;

  fg.scan(0, 0, w, h, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const a = this.bitmap.data[idx + 3];

    if (a === 0) return;

    const diffR = Math.max(0, r - bgR);
    const diffG = Math.max(0, g - bgG);
    const diffB = Math.max(0, b - bgB);
    const maxDiff = Math.max(diffR, diffG, diffB);

    if (maxDiff < 3) {
      this.bitmap.data[idx + 3] = 0;
    } else {
      const alpha = Math.min(255, Math.round(maxDiff * 1.35));
      const newR = Math.min(255, Math.round(diffR * 255 / (alpha || 1)));
      const newG = Math.min(255, Math.round(diffG * 255 / (alpha || 1)));
      const newB = Math.min(255, Math.round(diffB * 255 / (alpha || 1)));
      this.bitmap.data[idx + 0] = newR;
      this.bitmap.data[idx + 1] = newG;
      this.bitmap.data[idx + 2] = newB;
      this.bitmap.data[idx + 3] = alpha;
    }
  });

  // 2. Create monochrome silhouette of rings
  const mono = fg.clone();
  mono.scan(0, 0, w, h, function (x, y, idx) {
    const a = this.bitmap.data[idx + 3];
    this.bitmap.data[idx + 0] = 255;
    this.bitmap.data[idx + 1] = 255;
    this.bitmap.data[idx + 2] = 255;
    this.bitmap.data[idx + 3] = a > 80 ? 255 : 0;
  });

  // Save updated assets/android-icon-foreground.png and assets/android-icon-monochrome.png
  console.log('Updating assets/ android-icon-foreground.png & android-icon-monochrome.png...');
  await fg.clone().resize(512, 512).writeAsync(path.join(ASSETS_DIR, 'android-icon-foreground.png'));
  await mono.clone().resize(432, 432).writeAsync(path.join(ASSETS_DIR, 'android-icon-monochrome.png'));

  // 3. Generate Android 12+ Splash screen logos (drawable-*)
  console.log('Generating drawable splashscreen_logo.png across densities...');
  const splashSizes = {
    'drawable-mdpi': 288,
    'drawable-hdpi': 432,
    'drawable-xhdpi': 576,
    'drawable-xxhdpi': 864,
    'drawable-xxxhdpi': 1152,
  };

  for (const [folder, size] of Object.entries(splashSizes)) {
    const canvas = new Jimp(size, size, 0x00000000);
    // Rings scaled to 62% of the canvas so it sits inside the Android 12 circular mask comfortably
    const logoSize = Math.round(size * 0.62);
    const scaledLogo = fg.clone().resize(logoSize, logoSize);
    const offset = Math.round((size - logoSize) / 2);
    canvas.composite(scaledLogo, offset, offset);

    const outPath = path.join(RES_DIR, folder, 'splashscreen_logo.png');
    await canvas.writeAsync(outPath);
  }

  // 4. Generate Mipmap densities
  console.log('Generating mipmap launcher icons across densities...');
  const mipmapDensities = {
    'mipmap-mdpi': { legacy: 48, adaptive: 108 },
    'mipmap-hdpi': { legacy: 72, adaptive: 162 },
    'mipmap-xhdpi': { legacy: 96, adaptive: 216 },
    'mipmap-xxhdpi': { legacy: 144, adaptive: 324 },
    'mipmap-xxxhdpi': { legacy: 192, adaptive: 432 },
  };

  for (const [folder, dims] of Object.entries(mipmapDensities)) {
    const targetDir = path.join(RES_DIR, folder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // A. ic_launcher_background.webp
    const bgAdaptive = new Jimp(dims.adaptive, dims.adaptive, BG_COLOR_INT);
    await bgAdaptive.writeAsync(path.join(targetDir, 'ic_launcher_background.webp'));

    // B. ic_launcher_foreground.webp
    const fgAdaptive = new Jimp(dims.adaptive, dims.adaptive, 0x00000000);
    const fgAdaptiveLogo = fg.clone().resize(dims.adaptive, dims.adaptive);
    fgAdaptive.composite(fgAdaptiveLogo, 0, 0);
    await fgAdaptive.writeAsync(path.join(targetDir, 'ic_launcher_foreground.webp'));

    // C. ic_launcher_monochrome.webp
    const monoAdaptive = new Jimp(dims.adaptive, dims.adaptive, 0x00000000);
    const monoAdaptiveLogo = mono.clone().resize(dims.adaptive, dims.adaptive);
    monoAdaptive.composite(monoAdaptiveLogo, 0, 0);
    await monoAdaptive.writeAsync(path.join(targetDir, 'ic_launcher_monochrome.webp'));

    // D. ic_launcher.webp (Legacy square/squircle)
    // Full icon: Dark background + centered glowing rings
    const legacyIcon = new Jimp(dims.legacy, dims.legacy, BG_COLOR_INT);
    const legacyLogo = fg.clone().resize(dims.legacy, dims.legacy);
    legacyIcon.composite(legacyLogo, 0, 0);
    await legacyIcon.writeAsync(path.join(targetDir, 'ic_launcher.webp'));

    // E. ic_launcher_round.webp (Legacy round)
    const roundIcon = new Jimp(dims.legacy, dims.legacy, 0x00000000);
    const r = dims.legacy / 2;
    legacyIcon.scan(0, 0, dims.legacy, dims.legacy, function (x, y, idx) {
      const dist = Math.sqrt(Math.pow(x - r + 0.5, 2) + Math.pow(y - r + 0.5, 2));
      if (dist <= r) {
        roundIcon.bitmap.data[idx + 0] = this.bitmap.data[idx + 0];
        roundIcon.bitmap.data[idx + 1] = this.bitmap.data[idx + 1];
        roundIcon.bitmap.data[idx + 2] = this.bitmap.data[idx + 2];
        roundIcon.bitmap.data[idx + 3] = this.bitmap.data[idx + 3];
      }
    });
    await roundIcon.writeAsync(path.join(targetDir, 'ic_launcher_round.webp'));
  }

  console.log('All launcher icons and splashscreen logos successfully generated!');
}

generateAll().catch(err => {
  console.error('Generation failed:', err);
  process.exit(1);
});
