const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const iconPath = path.join(workspaceRoot, 'public', 'icon.png');
const iconBase64 = fs.readFileSync(iconPath).toString('base64');
const iconDataUri = `data:image/png;base64,${iconBase64}`;

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
    }
    body {
      width: 1200px;
      height: 630px;
      overflow: hidden;
      background-color: #060911;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    /* Ambient background grid and glow */
    .bg-grid {
      position: absolute;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
      -webkit-mask-image: radial-gradient(circle at 50% 50%, black 40%, transparent 80%);
    }

    .ambient-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -55%);
      width: 650px;
      height: 450px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(6, 182, 212, 0.12) 45%, transparent 70%);
      filter: blur(50px);
      pointer-events: none;
    }

    /* Border highlight */
    .card-border {
      position: absolute;
      inset: 24px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 28px;
      pointer-events: none;
      box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.5);
    }

    .container {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 900px;
      padding: 0 40px;
    }

    /* Logo Styling */
    .logo-wrapper {
      position: relative;
      margin-bottom: 24px;
    }

    .logo-glow {
      position: absolute;
      inset: -12px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.5), rgba(6, 182, 212, 0.4));
      border-radius: 36px;
      filter: blur(20px);
      opacity: 0.6;
    }

    .logo-img {
      position: relative;
      width: 140px;
      height: 140px;
      border-radius: 30px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.18);
      display: block;
    }

    /* Title & Brand */
    .brand-title {
      font-size: 58px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 12px;
      background: linear-gradient(180deg, #FFFFFF 20%, #D1D5DB 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .tagline {
      font-size: 24px;
      font-weight: 400;
      color: #9CA3AF;
      letter-spacing: -0.01em;
      margin-bottom: 28px;
      max-width: 720px;
      line-height: 1.4;
    }

    .tagline strong {
      color: #10B981;
      font-weight: 600;
    }

    /* Badges */
    .badges-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 500;
      color: #E5E7EB;
      letter-spacing: 0.01em;
      backdrop-filter: blur(8px);
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #10B981;
      box-shadow: 0 0 8px #10B981;
    }

    /* Bottom footer watermark */
    .footer-bar {
      position: absolute;
      bottom: 40px;
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      font-weight: 500;
      color: #6B7280;
      letter-spacing: 0.02em;
    }

    .footer-bar span.accent {
      color: #10B981;
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>
  <div class="ambient-glow"></div>
  <div class="card-border"></div>

  <div class="container">
    <div class="logo-wrapper">
      <div class="logo-glow"></div>
      <img class="logo-img" src="${iconDataUri}" alt="CareRing Logo" />
    </div>

    <h1 class="brand-title">CareRing</h1>
    <p class="tagline">The <strong>open-source</strong>, private family safety & real-time location tracker</p>

    <div class="badges-row">
      <div class="badge">
        <span class="badge-dot"></span>
        100% Private & Open Source
      </div>
      <div class="badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        Real-Time GPS Telemetry
      </div>
      <div class="badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        Self-Hosted Server
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>care-ring.netlify.app</span>
    <span>•</span>
    <span>github.com/sahsisunny/care-ring</span>
    <span>•</span>
    <span class="accent">v1.0.0 Android APK</span>
  </div>
</body>
</html>`;

const templatePath = path.join(__dirname, 'og-template.html');
fs.writeFileSync(templatePath, htmlContent, 'utf-8');
console.log('Template written to:', templatePath);

const rawPngPath = path.join(__dirname, 'raw-og.png');
const chromeCmd = `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --screenshot="${rawPngPath}" --window-size=1200,630 "file://${templatePath}"`;

console.log('Rendering via Chrome headless...');
execSync(chromeCmd);

// Destination paths
const publicPng = path.join(workspaceRoot, 'public', 'og-image.png');
const publicJpg = path.join(workspaceRoot, 'public', 'og-image.jpg');
const appOgPng = path.join(workspaceRoot, 'src', 'app', 'opengraph-image.png');
const appTwitterPng = path.join(workspaceRoot, 'src', 'app', 'twitter-image.png');

console.log('Optimizing with sips...');
// Resize exact 1200x630
execSync(`sips -z 630 1200 "${rawPngPath}" --out "${publicPng}"`);
execSync(`sips -s format jpeg -s formatOptions 88 "${publicPng}" --out "${publicJpg}"`);

// Copy to app router conventions
fs.copyFileSync(publicPng, appOgPng);
fs.copyFileSync(publicPng, appTwitterPng);

console.log('Generated:');
console.log('  -', publicPng, `(${fs.statSync(publicPng).size} bytes)`);
console.log('  -', publicJpg, `(${fs.statSync(publicJpg).size} bytes)`);
console.log('  -', appOgPng);
console.log('  -', appTwitterPng);
