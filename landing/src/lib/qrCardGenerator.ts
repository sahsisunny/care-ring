import QRCode from 'qrcode';

export interface QrCardOptions {
  title?: string;
  subtitle?: string;
  url?: string;
  filename?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

/**
 * Generates an 800x960 high-resolution branded share card with CareRing branding and scannable QR code.
 */
export async function generateQrCardBlob(options: QrCardOptions = {}): Promise<Blob> {
  const {
    title = 'CareRing',
    subtitle = 'Private Family GPS Radar & Safety',
    url = 'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk',
  } = options;

  // 1. Generate QR code data URL (480x480)
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: 440,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });

  // 2. Load QR image element
  const qrImage = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('Failed to load generated QR image'));
    qrImage.src = qrDataUrl;
  });

  // 3. Create high-resolution 2x Canvas (800 x 960)
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize canvas context');

  // Background base
  ctx.fillStyle = '#070A12';
  ctx.fillRect(0, 0, 800, 960);

  // Ambient Gradient Glow
  const radial = ctx.createRadialGradient(400, 220, 40, 400, 280, 440);
  radial.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
  radial.addColorStop(0.55, 'rgba(16, 185, 129, 0.14)');
  radial.addColorStop(1, 'rgba(7, 10, 18, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 800, 960);

  // Outer Border Frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  drawRoundedRect(ctx, 24, 24, 752, 912, 32);
  ctx.stroke();

  // Top Pill Badge
  const badgeText = '100% FREE & OPEN SOURCE';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 36;
  const badgeX = (800 - badgeWidth) / 2;

  ctx.fillStyle = 'rgba(99, 102, 241, 0.18)';
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  drawRoundedRect(ctx, badgeX, 64, badgeWidth, 34, 17);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#818CF8';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, 400, 87);

  // App Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 50px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(title, 400, 154);

  // Subtitle
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(subtitle, 400, 192);

  // White Card Container for QR Code
  const qrBoxX = 160;
  const qrBoxY = 236;
  const qrBoxSize = 480;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
  ctx.fill();

  // Draw QR Image inside
  ctx.drawImage(qrImage, qrBoxX + 20, qrBoxY + 20, 440, 440);

  // Instructional Headline
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Scan with Phone Camera to Install', 400, 765);

  // Highlights / Trust line
  ctx.fillStyle = '#34D399';
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Zero Subscriptions • Zero Ads • Strictly No Data Brokering', 400, 804);

  // Domain / Version
  ctx.fillStyle = '#818CF8';
  ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('care-ring.netlify.app • Android APK v1.0.5', 400, 850);

  // Convert to PNG Blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas to Blob conversion failed'));
    }, 'image/png');
  });
}

/**
 * Triggers a browser download of the generated QR share card PNG.
 */
export async function downloadQrCard(options: QrCardOptions = {}) {
  const blob = await generateQrCardBlob(options);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = options.filename || 'CareRing-Share-QR-Card.png';
  link.href = downloadUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
}

/**
 * Uses Web Share API if supported, or falls back to direct download.
 */
export async function shareQrCard(options: QrCardOptions = {}): Promise<'shared' | 'downloaded'> {
  const blob = await generateQrCardBlob(options);
  const file = new File([blob], options.filename || 'CareRing-Share-QR-Card.png', {
    type: 'image/png',
  });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: options.title || 'CareRing Family Radar',
        text: 'Scan this QR code with your phone camera to download CareRing free family GPS tracker!',
        files: [file],
      });
      return 'shared';
    } catch {
      // User cancelled share or share failed
      return 'downloaded';
    }
  }

  // Fallback to downloading image file
  await downloadQrCard(options);
  return 'downloaded';
}
