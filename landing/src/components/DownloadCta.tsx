import React from 'react';
import Link from 'next/link';

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

export function DownloadCta() {
  return (
    <section className="download-section" id="download">
      <div className="download-cta-card">
        <div className="download-cta-content">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'var(--emerald-light)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: 'var(--emerald)',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '16px',
            }}
          >
            <span>●</span>
            <span>Latest Official Release • v1.0.5</span>
          </div>

          <h2>
            Ready to Protect What Matters Most?
          </h2>

          <p>
            Install the production-signed APK directly onto your Android device in under 30 seconds. Zero subscription fees, zero advertisements, and zero location brokering.
          </p>

          <div className="download-cta-actions">
            <a
              href={LATEST_APK_URL}
              download
              className="btn-primary"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download CareRing-latest.apk (v1.0.5)</span>
            </a>

            <Link
              href="/download"
              className="btn-secondary"
            >
              <span>Installation Guide &amp; Hash ↗</span>
            </Link>
          </div>

          <div style={{ marginTop: '22px', fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>✓ Android 8.0 to Android 15</span>
            <span>✓ 83.36 MB Signed Package</span>
            <span>✓ 100% Free &amp; Open Source</span>
          </div>
        </div>
      </div>
    </section>
  );
}
