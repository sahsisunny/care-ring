import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Download CareRing APK for Android (Official Release v1.0.5)',
  description:
    'Download CareRing-latest.apk (83.36 MB). Production-signed Android release with zero subscriptions, zero ads, sub-50ms live GPS sync, and verified APK hash.',
  keywords: [
    'download CareRing APK',
    'CareRing-latest.apk',
    'CareRing APK download',
    'CareRing Android APK',
    'CareRing v1.0.5',
    'family safety APK download',
    'free Life360 APK alternative',
    'private GPS tracker APK',
    'install CareRing Android',
  ],
  alternates: {
    canonical: '/download',
  },
};

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

export default function DownloadPage() {
  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Download and Install CareRing APK on Android',
    description: 'Step-by-step instructions to install the official signed CareRing APK without Google Play Store.',
    totalTime: 'PT1M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Download the APK',
        text: 'Download the official production-signed CareRing-latest.apk file directly onto your Android device.',
        url: LATEST_APK_URL,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Enable Install Unknown Apps',
        text: 'When prompted by Android security, open Settings and allow installation from your browser source.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Install & Launch CareRing',
        text: 'Tap Install. Once complete, open CareRing and create or join your private family circle.',
      },
    ],
  };

  return (
    <div className="subpage-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />
      <div className="subpage-hero">
        <h1 className="subpage-title">Download CareRing for Android</h1>
        <p className="subpage-desc">
          Get the latest production-signed release APK directly onto your phone. No Google Play account required. 100% free forever.
        </p>
      </div>

      <div style={{ maxWidth: '820px', margin: '0 auto 80px', display: 'flex', flexDirection: 'column', gap: '36px' }}>
        {/* Main Download Card */}
        <div className="download-hub-card">
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            }}
          >
            🛡️
          </div>

          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-highlight)', marginBottom: '6px' }}>
              CareRing v1.0.5 (Production)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
              Release Artifact: <code>CareRing-latest.apk</code> • File Size: <strong>83.36 MB</strong>
            </p>
          </div>

          <a
            href={LATEST_APK_URL}
            download
            className="btn-primary"
            style={{
              padding: '16px 36px',
              fontSize: '16px',
              borderRadius: '16px',
              boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download CareRing-latest.apk</span>
          </a>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '18px',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}
          >
            <span>✓ Verified Signed Release</span>
            <span>✓ Android 8.0 (Oreo) to Android 15</span>
            <span>✓ Zero Advertisements</span>
          </div>
        </div>

        {/* 3 Step Installation Guide */}
        <div className="download-steps-card">
          <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '20px' }}>
            Quick 3-Step Android Installation
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                1
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '4px' }}>
                  Download the APK
                </h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tap the download button above from your Android browser (Chrome, Firefox, or Brave). Your device will notify you when <code>CareRing-latest.apk</code> is saved.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                2
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '4px' }}>
                  Enable "Install Unknown Apps"
                </h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  When prompted by Android security, tap <strong>Settings</strong> and toggle on <em>"Allow from this source"</em> for your browser. This standard prompt appears for all standalone APKs.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                3
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '4px' }}>
                  Launch &amp; Join Your Circle
                </h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tap <strong>Install</strong>. Once complete, open CareRing, sign in with Google or Apple, and create your first family circle or enter an invite code!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* External Mirrors */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '24px',
            padding: '24px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)' }}>
              Prefer GitHub Releases?
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Inspect the source commit, release notes, and tagged releases directly on GitHub.
            </p>
          </div>
          <a
            href="https://github.com/sahsisunny/care-ring/releases/tag/v1.0.5"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '8px 18px', fontSize: '13.5px' }}
          >
            <span>View Release on GitHub ↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
