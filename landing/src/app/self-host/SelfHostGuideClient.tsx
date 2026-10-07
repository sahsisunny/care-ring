"use client";

import React, { useState } from "react";
import Link from "next/link";

type DeploymentPlatform = "docker" | "render" | "vps" | "homelab";

export default function SelfHostGuideClient() {
  const [platform, setPlatform] = useState<DeploymentPlatform>("docker");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testUrlInput, setTestUrlInput] = useState<string>("https://family.mycustomdomain.com");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2200);
  };

  const getDerivedEndpoints = (raw: string) => {
    const clean = raw.trim().replace(/\/+$/, "");
    if (!clean) return { http: "https://family.mycustomdomain.com", ws: "wss://family.mycustomdomain.com" };
    let http = clean;
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      http = `https://${clean}`;
    }
    const isSsl = http.startsWith("https://");
    const ws = http.replace(/^https?:\/\//i, isSsl ? "wss://" : "ws://");
    return { http, ws };
  };

  const endpoints = getDerivedEndpoints(testUrlInput);

  const dockerComposeCode = `services:
  postgres:
    image: postgis/postgis:16-3.4
    container_name: carering_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: carering
      POSTGRES_USER: carering_user
      POSTGRES_PASSWORD: my_super_secret_db_password
    volumes:
      - carering_pgdata:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/init.sql:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U carering_user -d carering"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    image: node:20-alpine
    container_name: carering_api
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./server:/app
    command: sh -c "npm install && npm run build && npm run start"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PORT: 4000
      HOST: "0.0.0.0"
      DATABASE_URL: postgresql://carering_user:my_super_secret_db_password@postgres:5432/carering
      GEOCODING_PROVIDER: nominatim
      STATIONARY_RADIUS_METERS: 50
      STATIONARY_DURATION_THRESHOLD_MS: 180000
    ports:
      - "4000:4000"

volumes:
  carering_pgdata:`;

  const envFileCode = `# Network Binding
PORT=4000
HOST=0.0.0.0

# Database Connection (PostgreSQL 16 with PostGIS 3.4)
DATABASE_URL=postgresql://carering_user:my_super_secret_db_password@postgres:5432/carering

# Reverse Geocoding (Zero API Key Required - OpenStreetMap Nominatim)
GEOCODING_PROVIDER=nominatim

# Stationary Detection Sensor Thresholds
STATIONARY_RADIUS_METERS=50
STATIONARY_DURATION_THRESHOLD_MS=180000`;

  const caddyfileCode = `family.mycustomdomain.com {
    # Automatic HTTPS with Let's Encrypt
    reverse_proxy localhost:4000 {
        # WebSocket upgrade is handled automatically by Caddy
        header_up Host {host}
        header_up X-Real-IP {remote}
    }
}`;

  const nginxCode = `server {
    server_name family.mycustomdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;

        # Crucial for CareRing Sub-50ms WebSocket streaming
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    listen 443 ssl; # Managed by Certbot
    # ssl_certificate ...
}`;

  const testCurlCode = `curl -s http://localhost:4000/health | jq .
# Expected Output:
# {
#   "status": "ok",
#   "database": "connected",
#   "postgis": "3.4 USE_GEOS=1",
#   "timestamp": "2026-10-07T10:30:00.000Z"
# }`;

  return (
    <div className="self-host-container">
      {/* 1. HERO HEADER */}
      <section className="self-host-hero">
        <div className="hero-pill-badge" style={{ marginBottom: "16px" }}>
          <span>🛡️ 100% Data Sovereignty</span>
          <span>•</span>
          <span>Docker Ready</span>
          <span>•</span>
          <span>No Data Brokers</span>
        </div>

        <h1 className="self-host-title">
          Self-Host Your CareRing Backend &amp;{" "}
          <span className="gradient-text">Connect the Mobile APK</span>
        </h1>

        <p className="self-host-subtitle">
          Run your own encrypted family telemetry cloud on your own hardware or VPS in 5 minutes.
          Zero subscription fees, zero third-party cloud reliance, and 100% private PostGIS spatial storage.
        </p>

        {/* Feature Highlights Grid */}
        <div className="self-host-stats-grid">
          <div className="self-host-stat-card">
            <span className="stat-icon">⏱️</span>
            <div className="stat-label">Setup Time</div>
            <div className="stat-val">&lt; 5 Minutes</div>
          </div>
          <div className="self-host-stat-card">
            <span className="stat-icon">🐳</span>
            <div className="stat-label">Deployment</div>
            <div className="stat-val">Docker Compose</div>
          </div>
          <div className="self-host-stat-card">
            <span className="stat-icon">📱</span>
            <div className="stat-label">APK Support</div>
            <div className="stat-val">v1.0.4+ Built-in</div>
          </div>
          <div className="self-host-stat-card">
            <span className="stat-icon">💰</span>
            <div className="stat-label">Hosting Cost</div>
            <div className="stat-val">$0 Home / ~$4 VPS</div>
          </div>
        </div>
      </section>

      {/* 2. ARCHITECTURE DIAGRAM */}
      <section className="self-host-section">
        <div className="section-label">System Topology</div>
        <h2 className="section-title">How Self-Hosted Telemetry Works</h2>
        <p className="section-subtitle">
          Your mobile devices communicate directly with your private server. No coordinates ever touch commercial servers.
        </p>

        <div className="topology-card">
          <div className="topology-grid">
            <div className="topology-node">
              <div className="node-icon">📱</div>
              <div className="node-title">CareRing Android APK</div>
              <div className="node-desc">Runs on family phones. Captures motion, GPS, battery &amp; driving scores.</div>
              <span className="node-pill">Mobile Client</span>
            </div>

            <div className="topology-arrow">
              <span className="arrow-line"></span>
              <span className="arrow-label">TLS 1.3 / WSS</span>
            </div>

            <div className="topology-node highlight-node">
              <div className="node-icon">⚡</div>
              <div className="node-title">Your Fastify Gateway</div>
              <div className="node-desc">Port 4000. Handles sub-50ms WebSocket room fan-out and authenticated REST APIs.</div>
              <span className="node-pill highlight-pill">Docker :4000</span>
            </div>

            <div className="topology-arrow">
              <span className="arrow-line"></span>
              <span className="arrow-label">Internal Network</span>
            </div>

            <div className="topology-node">
              <div className="node-icon">🐘</div>
              <div className="node-title">PostGIS Database</div>
              <div className="node-desc">PostgreSQL 16 + PostGIS 3.4. Computes ST_DWithin geofences &amp; unbounded history.</div>
              <span className="node-pill">Docker :5432</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PLATFORM SELECTION GUIDE */}
      <section className="self-host-section" id="deployment-guide">
        <div className="section-label">Step 1: Deploy Backend</div>
        <h2 className="section-title">Choose Your Deployment Target</h2>
        <p className="section-subtitle">
          Select the platform that fits your setup. Docker Compose works out-of-the-box on VPS, Mac, Windows, and Linux.
        </p>

        {/* Platform Tabs */}
        <div className="platform-tabs-row">
          <button
            type="button"
            className={`platform-tab-btn ${platform === "docker" ? "active" : ""}`}
            onClick={() => setPlatform("docker")}
          >
            <span>🐳</span> Docker Compose (Recommended)
          </button>
          <button
            type="button"
            className={`platform-tab-btn ${platform === "vps" ? "active" : ""}`}
            onClick={() => setPlatform("vps")}
          >
            <span>🖥️</span> VPS + Domain + SSL
          </button>
          <button
            type="button"
            className={`platform-tab-btn ${platform === "homelab" ? "active" : ""}`}
            onClick={() => setPlatform("homelab")}
          >
            <span>🍓</span> Raspberry Pi / Tailscale
          </button>
          <button
            type="button"
            className={`platform-tab-btn ${platform === "render" ? "active" : ""}`}
            onClick={() => setPlatform("render")}
          >
            <span>☁️</span> 1-Click Render.com PaaS
          </button>
        </div>

        {/* Tab Content 1: Docker Compose */}
        {platform === "docker" && (
          <div className="platform-guide-content">
            <div className="guide-step-card">
              <div className="step-badge">Step 1.1</div>
              <h3 className="step-title">Clone the Repository &amp; Create Directory</h3>
              <p className="step-desc">
                Download the official open-source repository to your server or local machine:
              </p>
              <div className="code-block-wrapper">
                <div className="code-header">
                  <span>Terminal</span>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => copyToClipboard("clone", "git clone https://github.com/sahsisunny/care-ring.git\ncd care-ring")}
                  >
                    {copiedKey === "clone" ? "✓ Copied!" : "Copy Command"}
                  </button>
                </div>
                <pre className="code-block">
                  <code>{`git clone https://github.com/sahsisunny/care-ring.git
cd care-ring`}</code>
                </pre>
              </div>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.2</div>
              <h3 className="step-title">Review or Customize Environment (.env)</h3>
              <p className="step-desc">
                Create a <code>server/.env</code> file (or adjust your passwords in the configuration):
              </p>
              <div className="code-block-wrapper">
                <div className="code-header">
                  <span>server/.env</span>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => copyToClipboard("env", envFileCode)}
                  >
                    {copiedKey === "env" ? "✓ Copied!" : "Copy .env"}
                  </button>
                </div>
                <pre className="code-block">
                  <code>{envFileCode}</code>
                </pre>
              </div>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.3</div>
              <h3 className="step-title">Start the Full Stack with Docker Compose</h3>
              <p className="step-desc">
                Launch both the PostGIS 16 database and the Fastify gateway simultaneously in the background:
              </p>
              <div className="code-block-wrapper">
                <div className="code-header">
                  <span>Terminal</span>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => copyToClipboard("up", "docker compose up -d")}
                  >
                    {copiedKey === "up" ? "✓ Copied!" : "Copy Command"}
                  </button>
                </div>
                <pre className="code-block">
                  <code>{`docker compose up -d`}</code>
                </pre>
              </div>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.4</div>
              <h3 className="step-title">Verify Backend Health</h3>
              <p className="step-desc">
                Query your newly spawned instance to ensure spatial queries and database tables are ready:
              </p>
              <div className="code-block-wrapper">
                <div className="code-header">
                  <span>Terminal</span>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => copyToClipboard("curl", testCurlCode)}
                  >
                    {copiedKey === "curl" ? "✓ Copied!" : "Copy Test"}
                  </button>
                </div>
                <pre className="code-block">
                  <code>{testCurlCode}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: VPS + Domain + SSL */}
        {platform === "vps" && (
          <div className="platform-guide-content">
            <div className="guide-step-card">
              <div className="step-badge">Step 1.1</div>
              <h3 className="step-title">Point Your Subdomain (DNS A Record)</h3>
              <p className="step-desc">
                Create an <strong>A Record</strong> at your domain registrar pointing to your server&apos;s public IP address (e.g. <code>family.mycustomdomain.com → 198.51.100.42</code>).
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.2</div>
              <h3 className="step-title">Option A: Automatic HTTPS with Caddy (Simplest)</h3>
              <p className="step-desc">
                Caddy automatically requests and renews Let&apos;s Encrypt SSL certificates with zero manual cron jobs:
              </p>
              <div className="code-block-wrapper">
                <div className="code-header">
                  <span>/etc/caddy/Caddyfile</span>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => copyToClipboard("caddy", caddyfileCode)}
                  >
                    {copiedKey === "caddy" ? "✓ Copied!" : "Copy Caddyfile"}
                  </button>
                </div>
                <pre className="code-block">
                  <code>{caddyfileCode}</code>
                </pre>
              </div>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.3</div>
              <h3 className="step-title">Option B: Nginx Reverse Proxy with WebSocket Upgrades</h3>
              <p className="step-desc">
                If you use Nginx, ensure the WebSocket headers are declared so sub-second GPS streaming functions properly:
              </p>
              <div className="code-block-wrapper">
                <div className="code-header">
                  <span>/etc/nginx/sites-available/carering</span>
                  <button
                    type="button"
                    className="copy-code-btn"
                    onClick={() => copyToClipboard("nginx", nginxCode)}
                  >
                    {copiedKey === "nginx" ? "✓ Copied!" : "Copy Nginx Config"}
                  </button>
                </div>
                <pre className="code-block">
                  <code>{nginxCode}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: Home Lab / Raspberry Pi */}
        {platform === "homelab" && (
          <div className="platform-guide-content">
            <div className="guide-step-card">
              <div className="step-badge">Step 1.1</div>
              <h3 className="step-title">Install on Raspberry Pi 4 / 5 or Home Server</h3>
              <p className="step-desc">
                CareRing supports ARM64 natively! Run Docker Compose on your Raspberry Pi OS (64-bit) or Ubuntu Server.
                Performance uses under 250 MB of RAM total.
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.2</div>
              <h3 className="step-title">Zero Port-Forwarding with Tailscale Mesh VPN</h3>
              <p className="step-desc">
                If you have Carrier-Grade NAT (CGNAT) or do not want to open router ports, install Tailscale on your Raspberry Pi and family phones.
                Simply enter your Pi&apos;s Tailscale IP (e.g. <code>http://100.82.44.12:4000</code>) inside the APK!
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.3</div>
              <h3 className="step-title">Alternative: Cloudflare Tunnels (Free Public SSL)</h3>
              <p className="step-desc">
                Run <code>cloudflared tunnel run carering</code> to securely route public traffic to your local port 4000 with free SSL without exposing your home IP.
              </p>
            </div>
          </div>
        )}

        {/* Tab Content 4: Render.com */}
        {platform === "render" && (
          <div className="platform-guide-content">
            <div className="guide-step-card">
              <div className="step-badge">Step 1.1</div>
              <h3 className="step-title">Fork the Repository on GitHub</h3>
              <p className="step-desc">
                Fork <a href="https://github.com/sahsisunny/care-ring" target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan)", textDecoration: "underline" }}>github.com/sahsisunny/care-ring</a> to your own GitHub account.
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.2</div>
              <h3 className="step-title">Create PostgreSQL Database with PostGIS</h3>
              <p className="step-desc">
                On Render.com, create a new <strong>PostgreSQL Database</strong>. Once provisioned, execute <code>CREATE EXTENSION IF NOT EXISTS postgis;</code> in the database query console, then run the statements from <code>database/schema.sql</code>.
              </p>
            </div>

            <div className="guide-step-card">
              <div className="step-badge">Step 1.3</div>
              <h3 className="step-title">Deploy Web Service</h3>
              <p className="step-desc">
                Create a new <strong>Web Service</strong> pointing to your repository, set Root Directory to <code>server</code>, build command to <code>npm install &amp;&amp; npm run build</code>, and start command to <code>npm run start</code>.
                Set Environment Variable <code>DATABASE_URL</code> to your database internal connection string.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 4. CONNECTING THE ANDROID APK */}
      <section className="self-host-section" id="apk-connection">
        <div className="section-label">Step 2: Connect APK</div>
        <h2 className="section-title">Connect Your CareRing APK in 4 Steps</h2>
        <p className="section-subtitle">
          Every CareRing Android APK build comes with a built-in Server Configuration utility that lets you switch between cloud and self-hosted backends with zero app re-compilation.
        </p>

        {/* 4 Steps Grid */}
        <div className="apk-steps-grid">
          <div className="apk-step-card">
            <div className="apk-step-num">1</div>
            <div className="apk-step-icon">⚙️</div>
            <h3 className="apk-step-title">Open Server Configuration</h3>
            <p className="apk-step-desc">
              On the <strong>Login / Register</strong> screen, tap the <strong>Cloud Status Pill or Server Icon</strong> in the top-right corner.
              (Or navigate to <code>Settings &gt; Developer &amp; Self-Hosting &gt; Custom Server Backend</code>).
            </p>
          </div>

          <div className="apk-step-card">
            <div className="apk-step-num">2</div>
            <div className="apk-step-icon">🔀</div>
            <h3 className="apk-step-title">Select &quot;Custom (Self-Hosted)&quot;</h3>
            <p className="apk-step-desc">
              Toggle the mode from <em>Cloud (Official Instance)</em> to <strong>Custom (Self-Hosted Instance)</strong>.
            </p>
          </div>

          <div className="apk-step-card">
            <div className="apk-step-num">3</div>
            <div className="apk-step-icon">🌐</div>
            <h3 className="apk-step-title">Enter Your Server URL</h3>
            <p className="apk-step-desc">
              Type your server address (e.g. <code>https://family.mycustomdomain.com</code> or <code>http://192.168.1.150:4000</code>).
              CareRing automatically handles both REST and WebSocket protocols!
            </p>
          </div>

          <div className="apk-step-card">
            <div className="apk-step-num">4</div>
            <div className="apk-step-icon">✅</div>
            <h3 className="apk-step-title">Test &amp; Save</h3>
            <p className="apk-step-desc">
              Tap <strong>Test Connection</strong> to verify round-trip ping latency and database health.
              Tap <strong>Save &amp; Apply</strong>. The app immediately connects to your private server!
            </p>
          </div>
        </div>

        {/* Live URL Formatter Sandbox */}
        <div className="url-sandbox-card">
          <div className="url-sandbox-header">
            <span style={{ fontSize: "20px" }}>🧪</span>
            <div>
              <h4 style={{ fontSize: "16px", fontWeight: 700 }}>Interactive Server URL Format Helper</h4>
              <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                Test your server URL below to see how CareRing automatically derives secure WebSocket (WSS) and REST endpoints:
              </p>
            </div>
          </div>

          <div className="url-input-wrap">
            <input
              type="text"
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              placeholder="e.g. https://family.mycustomdomain.com or http://192.168.1.50:4000"
              className="url-test-input"
            />
          </div>

          <div className="derived-endpoints-grid">
            <div className="derived-card">
              <span className="derived-label">REST API Endpoint (Auth, Places, Timelines)</span>
              <code className="derived-code">{endpoints.http}</code>
            </div>
            <div className="derived-card">
              <span className="derived-label">WebSocket Telemetry Gateway (Sub-50ms Fanout)</span>
              <code className="derived-code" style={{ color: "var(--cyan)" }}>{endpoints.ws}</code>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PRODUCTION CHECKLIST */}
      <section className="self-host-section">
        <div className="section-label">Best Practices</div>
        <h2 className="section-title">Production Hardening Checklist</h2>
        <p className="section-subtitle">
          Ensure your family safety cloud is resilient, backed up, and secure from external intrusion.
        </p>

        <div className="checklist-grid">
          <div className="checklist-card">
            <span className="check-icon">🔒</span>
            <h4 className="check-title">Firewall &amp; Port Exposure</h4>
            <p className="check-desc">
              Only expose ports <strong>80</strong> and <strong>443</strong> through your reverse proxy. Keep PostgreSQL port <strong>5432</strong> closed to the public internet.
            </p>
          </div>

          <div className="checklist-card">
            <span className="check-icon">💾</span>
            <h4 className="check-title">Automated Database Backups</h4>
            <p className="check-desc">
              Set up a daily cron job running <code>docker exec carering_db pg_dump -U carering_user carering | gzip &gt; /backup/carering_$(date +%F).sql.gz</code>.
            </p>
          </div>

          <div className="checklist-card">
            <span className="check-icon">🔄</span>
            <h4 className="check-title">Zero-Downtime Updates</h4>
            <p className="check-desc">
              When new CareRing releases arrive, update effortlessly with: <code>git pull &amp;&amp; docker compose up -d --build</code>. Data volumes remain untouched.
            </p>
          </div>

          <div className="checklist-card">
            <span className="check-icon">🚫</span>
            <h4 className="check-title">Zero Third-Party Leaks</h4>
            <p className="check-desc">
              Reverse geocoding queries run directly against open OpenStreetMap Nominatim instances with zero Google Maps API keys or third-party tracking cookies.
            </p>
          </div>
        </div>
      </section>

      {/* 6. FAQ & TROUBLESHOOTING */}
      <section className="self-host-section">
        <div className="section-label">Common Questions</div>
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-subtitle">
          Everything you need to know about self-hosting CareRing.
        </p>

        <div className="faq-list">
          {[
            {
              q: "Can all my family members connect to my self-hosted server?",
              a: "Yes! Once you point each family phone's CareRing APK to your server URL, you create circles and share 6-character invite codes just like normal. All accounts, location streaming, and chat will live exclusively on your private server.",
            },
            {
              q: "Do I need a static IP address to host at home?",
              a: "No. You can use free Dynamic DNS services (like DuckDNS, No-IP), Cloudflare Tunnels, or private mesh networks like Tailscale. Tailscale is especially popular because it requires zero open ports on your home router.",
            },
            {
              q: "Why does the 'Test Connection' button in the APK fail?",
              a: "Common causes include: (1) Missing SSL/TLS certificate if using an https:// address, (2) Firewall blocking port 4000, or (3) Your reverse proxy missing WebSocket upgrade headers (Upgrade $http_upgrade). Verify that visiting http://your-ip:4000/health in a mobile browser returns a JSON status.",
            },
            {
              q: "Can I switch back to the official cloud instance anytime?",
              a: "Yes! In the Server Configuration modal, simply tap 'Reset to Default Cloud' and CareRing will immediately switch back to the official high-availability cloud cluster.",
            },
            {
              q: "Is there any commercial tracking or phone-home code in CareRing?",
              a: "Zero. CareRing is 100% open-source under the MIT License. The code is completely auditable on GitHub, has no Google Analytics, no Firebase Crashlytics, and no data broker SDKs.",
            },
          ].map((item, idx) => (
            <div key={item.q} className="faq-item">
              <button
                type="button"
                className="faq-question-btn"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
              >
                <span>{item.q}</span>
                <span className="faq-toggle-icon">{openFaq === idx ? "−" : "+"}</span>
              </button>
              {openFaq === idx && (
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 7. CTA / DOWNLOAD */}
      <section className="self-host-cta-section">
        <div className="self-host-cta-card">
          <h2 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "12px" }}>
            Ready to Take 100% Control of Your Family Privacy?
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto 28px auto", fontSize: "15px" }}>
            Download the official CareRing v1.0.4 standalone Android APK, configure your private server in seconds, and protect your loved ones with complete digital sovereignty.
          </p>

          <div className="hero-cta-group">
            <a
              href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk"
              className="btn-primary"
              download
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download APK (v1.0.4)</span>
            </a>

            <a
              href="https://github.com/sahsisunny/care-ring"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <span>View Source on GitHub</span>
            </a>

            <Link href="/" className="btn-secondary">
              <span>← Back to Showcase</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
