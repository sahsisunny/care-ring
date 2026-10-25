import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadCta } from '@/components/DownloadCta';

export const metadata: Metadata = {
  title: 'Developers & Self-Hosting Portal — CareRing Private Cluster',
  description:
    'Complete engineering documentation for CareRing: PostgreSQL 16 + PostGIS, Docker Compose one-command cluster, WebSocket protocol, and REST endpoints.',
  keywords: [
    'CareRing self hosting',
    'CareRing Docker Compose',
    'CareRing architecture',
    'open source Life360 backend',
    'PostGIS location tracker',
    'private safety cluster',
    'WebSocket location streaming',
  ],
  alternates: {
    canonical: '/developers',
  },
};

export default function DevelopersPage() {
  const devDocSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'CareRing Self-Hosting & Architecture Portal',
    description: 'Engineering guide to deploy a sovereign CareRing safety cluster using Docker Compose, PostgreSQL 16, PostGIS 3.4, and WebSockets.',
    author: {
      '@type': 'Person',
      name: 'Sunny Sahsi',
      url: 'https://github.com/sahsisunny',
    },
    publisher: {
      '@type': 'Organization',
      name: 'CareRing Open Source',
    },
  };

  return (
    <div className="subpage-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(devDocSchema) }}
      />
      <div className="subpage-hero">
        <h1 className="subpage-title">Run Your Own Safety Cluster</h1>
        <p className="subpage-desc">
          Total data sovereignty. Deploy CareRing on your own cloud server, home lab, or private VPS in under 3 minutes with Docker Compose.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px', maxWidth: '960px', margin: '0 auto 80px' }}>
        {/* Architecture Stack */}
        <section id="architecture" className="dev-card">
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '14px' }}>
            Production Tech Stack &amp; Architecture
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            CareRing is engineered with battle-tested open-source primitives for extreme resilience and sub-50ms message propagation.
          </p>

          <div className="dev-stack-grid">
            <div id="database" className="dev-stack-item">
              <div style={{ fontSize: '11px', color: 'var(--emerald)', fontWeight: 800 }}>SPATIAL DATABASE</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '4px' }}>PostgreSQL 16</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>PostGIS 3.4 Spatial Indexing</div>
            </div>

            <div className="dev-stack-item">
              <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 800 }}>REAL-TIME STREAMING</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '4px' }}>WebSockets (WSS)</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Sub-50ms Heartbeat Broadcast</div>
            </div>

            <div className="dev-stack-item">
              <div style={{ fontSize: '11px', color: '#0284C7', fontWeight: 800 }}>MOBILE RUNTIME</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '4px' }}>React Native &amp; Expo</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Android &amp; iOS Native Fusion</div>
            </div>

            <div className="dev-stack-item">
              <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 800 }}>CONTAINER ORCHESTRATION</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '4px' }}>Docker Compose</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Automated Healthchecks</div>
            </div>
          </div>
        </section>

        {/* Quickstart Docker Compose */}
        <section id="docker" className="dev-card">
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '14px' }}>
            One-Command Self-Hosting (Docker Compose)
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
            Clone the repository and launch the containerized PostgreSQL 16 + PostGIS database and Node backend:
          </p>

          <pre
            style={{
              background: '#0B0F19',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              padding: '20px',
              fontSize: '13.5px',
              color: '#A5B4FC',
              fontFamily: 'monospace',
              overflowX: 'auto',
              lineHeight: 1.6,
            }}
          >
{`# 1. Clone the repository
git clone https://github.com/sahsisunny/care-ring.git
cd care-ring/backend

# 2. Configure environment
cp .env.example .env

# 3. Launch Docker stack
docker compose up -d

# 4. Verify cluster health
curl http://localhost:8080/health
# Response: {"status":"healthy","db":"connected","ws_clients":0}`}
          </pre>
        </section>

        {/* Linking Custom Server in Mobile App */}
        <section id="mobile-setup" className="dev-card">
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '14px' }}>
            Connecting the Mobile App to Your Server
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '20px' }}>
            The CareRing mobile app contains a built-in server switcher. You never need to rebuild or recompile the APK:
          </p>

          <ol style={{ paddingLeft: '24px', color: 'var(--text-secondary)', fontSize: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li>Install <strong>CareRing-latest.apk</strong> on your Android device.</li>
            <li>On the welcome screen or in <strong>Settings → Backend Server Connection</strong>, tap the server icon.</li>
            <li>Enter your self-hosted domain or IP (e.g. <code>wss://family.yourdomain.com</code>).</li>
            <li>The app will automatically test TLS connectivity and securely bind to your private server instance.</li>
          </ol>
        </section>

        {/* REST API & WebSocket Endpoints */}
        <section id="api" className="dev-card">
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '14px' }}>
            Core API &amp; WebSocket Endpoints
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="api-endpoint-row">
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--emerald)', background: 'var(--emerald-light)', padding: '2px 7px', borderRadius: '4px', marginRight: '8px' }}>GET</span>
                <code style={{ fontSize: '13px', color: 'var(--text-highlight)', fontWeight: 600 }}>/health</code>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cluster &amp; PostGIS healthcheck</span>
            </div>

            <div id="websockets" className="api-endpoint-row" style={{ scrollMarginTop: '100px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 7px', borderRadius: '4px', marginRight: '8px' }}>WSS</span>
                <code style={{ fontSize: '13px', color: 'var(--text-highlight)', fontWeight: 600 }}>/ws?token=Bearer...</code>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Real-time location &amp; radar telemetry</span>
            </div>

            <div className="api-endpoint-row">
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284C7', background: 'rgba(2, 132, 199, 0.12)', padding: '2px 7px', borderRadius: '4px', marginRight: '8px' }}>POST</span>
                <code style={{ fontSize: '13px', color: 'var(--text-highlight)', fontWeight: 600 }}>/api/v1/circles</code>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Circle creation &amp; 6-char invite generation</span>
            </div>

            <div className="api-endpoint-row">
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--coral)', background: 'var(--coral-light)', padding: '2px 7px', borderRadius: '4px', marginRight: '8px' }}>POST</span>
                <code style={{ fontSize: '13px', color: 'var(--text-highlight)', fontWeight: 600 }}>/api/v1/sos/trigger</code>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>High-priority circle panic broadcast</span>
            </div>
          </div>
        </section>
      </div>

      <DownloadCta />
    </div>
  );
}
