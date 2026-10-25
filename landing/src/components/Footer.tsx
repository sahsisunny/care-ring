import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

export function Footer() {
  return (
    <footer className="footer-wrapper">
      <div className="footer">
        <div className="footer-multi-col">
          {/* Column 1: Brand & Identity (Left-aligned) */}
          <div className="footer-brand-info">
            <Link href="/" className="logo-brand">
              <Image
                src="/icon.png"
                alt="CareRing Logo"
                width={36}
                height={36}
                className="logo-image"
              />
              <span className="brand-text-title">CareRing</span>
              <span className="brand-text-badge">v1.0.5</span>
            </Link>

            <p className="footer-tagline">
              The private, open-source family safety alternative. Sub-50ms live radar, intelligent crash detection, and zero commercial data brokering.
            </p>

            <div className="footer-status-pill">
              <span className="live-dot" />
              <span>100% Free Forever • MIT Licensed</span>
            </div>
          </div>

          {/* Column 2: Product Capabilities */}
          <div className="footer-nav-col">
            <h4>Product</h4>
            <Link href="/features">All 16 Capabilities</Link>
            <Link href="/features#radar">Live Family Radar</Link>
            <Link href="/features#driving">Driving Safety &amp; Scores</Link>
            <Link href="/features#sos">Emergency Crash &amp; SOS</Link>
            <Link href="/features#geofences">Unlimited Safe Places</Link>
            <Link href="/features#ghost-mode">Ghost Mode &amp; Privacy</Link>
            <Link href="/download">Download Latest APK</Link>
          </div>

          {/* Column 3: Engineering & Self-Hosting */}
          <div className="footer-nav-col">
            <h4>Engineering</h4>
            <Link href="/developers">Self-Hosting Portal</Link>
            <Link href="/developers#docker">Docker Compose</Link>
            <Link href="/developers#database">PostgreSQL 16 &amp; PostGIS</Link>
            <Link href="/developers#websockets">WebSocket Protocol</Link>
            <Link href="/developers#api">REST Endpoints</Link>
            <a
              href="https://github.com/sahsisunny/care-ring"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Repository ↗
            </a>
          </div>

          {/* Column 4: Legal & Policies (Moved from header!) */}
          <div className="footer-nav-col">
            <h4>Legal &amp; Trust</h4>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/privacy#zero-broker">Zero-Monetization Pledge</Link>
            <Link href="/terms#mutual-consent">Mutual Circle Consent</Link>
            <a
              href="https://github.com/sahsisunny/care-ring/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT License ↗
            </a>
            <a
              href="https://github.com/sahsisunny/care-ring/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Security Disclosures ↗
            </a>
          </div>
        </div>

        {/* Bottom Bar (Left aligned credit, right aligned quick links) */}
        <div className="footer-bottom-row">
          <p className="footer-credit">
            © {new Date().getFullYear()} CareRing • Designed &amp; Engineered by{' '}
            <a
              href="https://github.com/sahsisunny"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontWeight: 700, color: 'var(--primary)' }}
            >
              Sunny Sahsi
            </a>          </p>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Link
              href="/download"
              style={{
                fontSize: '12.5px',
                color: 'var(--emerald)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Download CareRing-latest.apk (v1.0.5) ↓</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
