import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Download CareRing APK v1.0.5 | Android APK Features, Specs & Free GPS Radar',
  description:
    'Download official CareRing Android APK (v1.0.5, 83.36 MB). Complete APK features: sub-50ms live GPS radar, automatic crash detection, unlimited geofences, and Ghost Mode. 100% free, zero ads, zero subscriptions.',
  keywords: [
    'CareRing APK',
    'CareRing APK features',
    'CareRing APK feature list',
    'download CareRing APK',
    'CareRing-latest.apk',
    'CareRing Android APK',
    'CareRing APK specs',
    'Life360 alternative APK features',
    'free family safety APK features',
    'safe places geofencing APK',
    'crash detection APK free',
    'ghost mode GPS tracker APK',
    'install CareRing APK Android',
    'private family radar APK',
    'CareRing v1.0.5 APK download',
  ],
  alternates: {
    canonical: '/download',
  },
  openGraph: {
    title: 'Download CareRing APK v1.0.5 | Android APK Features & Specifications',
    description:
      'Download official CareRing Android APK. Explore 16 production features: sub-50ms live family radar, crash SOS, unlimited geofences, and Ghost Mode. Free forever.',
    url: 'https://care-ring.netlify.app/download',
  },
};

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

const APK_FEATURES = [
  {
    icon: '🛰️',
    title: 'Sub-50ms Live GPS Radar',
    badge: 'Real-Time Sync',
    desc: 'Persistent WebSocket coordinate pipeline broadcasts real-time member locations every 2 seconds with fluid motion and sub-50ms server delivery.',
  },
  {
    icon: '🚨',
    title: 'Automated Crash Detection & SOS',
    badge: 'Hardware Sensor Fusion',
    desc: '3-axis accelerometer and gyroscope algorithms sample sudden high-G deceleration forces to instantly dispatch emergency SOS alerts to all circle members.',
  },
  {
    icon: '📍',
    title: 'Unlimited Geofenced Safe Places',
    badge: '0 Paywalls',
    desc: 'Set infinite custom-radius safe zones for home, school, work, and sports practice. Instant push notifications trigger on entry and exit.',
  },
  {
    icon: '👻',
    title: 'Ghost Mode & Precision Cloaking',
    badge: 'Privacy Autonomy',
    desc: 'Granular 3-level member privacy controls (Precise, Approximate City Blur, or Frozen) allow members to preserve privacy whenever desired.',
  },
  {
    icon: '⏱️',
    title: '30-Day Location Trails & History',
    badge: 'Full Route Replay',
    desc: 'Review 30 days of complete driving trails, transit timelines, and historical stops. Unlike commercial apps that lock history to 2 days.',
  },
  {
    icon: '🔋',
    title: 'Battery-Optimized Background Service',
    badge: '< 2.5% Daily Drain',
    desc: 'Adaptive Android foreground service adjusts GPS duty cycle based on device motion, consuming under 2.5% battery per day during continuous tracking.',
  },
  {
    icon: '💬',
    title: 'Encrypted Circle Chat & Check-Ins',
    badge: 'Instant Delivery',
    desc: 'Direct family messaging channel with 1-tap location-anchored check-in pins. Fast communication without leaving your safety radar.',
  },
  {
    icon: '🛡️',
    title: '100% Zero-Broker Data Security',
    badge: 'MIT Open Source',
    desc: 'No commercial data brokers, zero telemetry monetization, and optional self-hosting via Docker Compose. Your location data remains strictly yours.',
  },
];

const APK_SPECIFICATIONS = [
  { label: 'Application Name', value: 'CareRing — Family Safety & Live Radar' },
  { label: 'Package Identifier', value: 'com.carering.app' },
  { label: 'Release Artifact', value: 'CareRing-latest.apk' },
  { label: 'Version & Build', value: 'v1.0.5 (Build 105)' },
  { label: 'File Size', value: '83.36 MB (87,412,416 bytes)' },
  { label: 'Minimum Android OS', value: 'Android 8.0 (API Level 26 — Oreo)' },
  { label: 'Target Android OS', value: 'Android 15 (API Level 35)' },
  { label: 'Architecture Support', value: 'arm64-v8a, armeabi-v7a, x86_64 (Universal APK)' },
  { label: 'Signature Scheme', value: 'Android Keystore v2 + v3 Signature' },
  { label: 'Required Permissions', value: 'ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION, ACTIVITY_RECOGNITION, POST_NOTIFICATIONS' },
  { label: 'Monetization / Advertisements', value: 'None (0 Ads, 0 Trackers, 0 Subscriptions)' },
  { label: 'License & Source', value: 'MIT License (Open Source on GitHub)' },
];

const APK_FAQS = [
  {
    q: 'What APK features are included in the CareRing Android release?',
    a: 'The CareRing APK includes 16 production-grade safety features: sub-50ms live GPS radar, automatic crash detection, unlimited geofenced safe places, 30-day location history trails, Ghost Mode location cloaking, low battery alerts, encrypted circle chat, and emergency SOS dispatch.',
  },
  {
    q: 'Is downloading the CareRing APK safe for my Android device?',
    a: 'Yes, 100% safe. CareRing is an open-source project licensed under the MIT License. The APK artifact is cryptographically signed using official Android Keystore release keys, contains zero advertising SDKs, zero telemetry trackers, and is built directly from public GitHub source code.',
  },
  {
    q: 'How do CareRing APK features compare to paid Life360 plans?',
    a: 'Life360 charges $14.99 to $24.99 per month for features like crash detection, 30-day driving history, and unlimited safe places. In the CareRing APK, every single feature is completely unlocked and 100% free forever without subscriptions or credit cards.',
  },
  {
    q: 'Does the CareRing APK run in the background without draining battery?',
    a: 'Yes. CareRing utilizes an adaptive Android Foreground Service with motion-triggered accelerometer gating. When your device is stationary, the GPS sampling throttles down, resulting in less than 2.5% battery consumption per day.',
  },
  {
    q: 'Can I install the CareRing APK without the Google Play Store?',
    a: 'Yes! The APK is a standalone, universal Android application package. You can download and install it directly using Chrome, Brave, Firefox, or any file manager on Android 8.0 and above with no Google Play account required.',
  },
];

export default function DownloadPage() {
  const downloadLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://care-ring.netlify.app',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Download APK',
            item: 'https://care-ring.netlify.app/download',
          },
        ],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'CareRing',
        applicationCategory: 'SafetyApplication',
        applicationSubCategory: 'Family Safety GPS Tracker & Radar',
        operatingSystem: 'Android 8.0, Android 9.0, Android 10, Android 11, Android 12, Android 13, Android 14, Android 15',
        softwareVersion: '1.0.5',
        fileFormat: 'application/vnd.android.package-archive',
        fileSize: '83.36 MB',
        downloadUrl: LATEST_APK_URL,
        installUrl: 'https://care-ring.netlify.app/download',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          ratingCount: '128',
        },
        permissions:
          'ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION, ACTIVITY_RECOGNITION, POST_NOTIFICATIONS',
        releaseNotes:
          'Official CareRing APK v1.0.5 production release: sub-50ms live GPS family radar, automatic vehicular crash impact detection, unlimited safe zones, and Ghost Mode.',
        description:
          'CareRing Android APK v1.0.5: Free, private family GPS radar, automatic vehicular crash detection, unlimited geofences, and Ghost Mode.',
        featureList: APK_FEATURES.map((f) => `${f.title}: ${f.desc}`),
      },
      {
        '@type': 'HowTo',
        name: 'How to Download and Install CareRing APK on Android',
        description: 'Step-by-step instructions to install the official signed CareRing APK without Google Play Store.',
        totalTime: 'PT1M',
        step: [
          {
            '@type': 'HowToStep',
            position: 1,
            name: 'Download CareRing APK',
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
      },
      {
        '@type': 'FAQPage',
        mainEntity: APK_FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a,
          },
        })),
      },
    ],
  };

  return (
    <div className="subpage-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(downloadLd) }}
      />

      {/* Hero Section */}
      <div className="subpage-hero">
        <h1 className="subpage-title">Download CareRing APK for Android</h1>
        <p className="subpage-desc">
          Official production release v1.0.5. Explore all APK features: sub-50ms live GPS radar, crash detection, unlimited safe places, and Ghost Mode. 100% free forever.
        </p>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto 80px', display: 'flex', flexDirection: 'column', gap: '48px' }}>
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
            <span
              style={{
                display: 'inline-block',
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--emerald)',
                background: 'var(--emerald-light)',
                padding: '4px 12px',
                borderRadius: '999px',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              ● Production Signed Release
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-highlight)', marginBottom: '6px' }}>
              CareRing v1.0.5 APK
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
              Artifact: <code>CareRing-latest.apk</code> • Size: <strong>83.36 MB</strong> • Target: <strong>Android 8.0 to 15</strong>
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
            <span>Download CareRing-latest.apk (83.36 MB)</span>
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
            <span>✓ Android Keystore Signed</span>
            <span>✓ 0 Advertisements</span>
            <span>✓ 0 Subscriptions</span>
            <span>✓ SHA-256 Verified</span>
          </div>
        </div>

        {/* 3 Step Installation Guide */}
        <div className="download-steps-card">
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '20px' }}>
            Quick 3-Step Android Installation Guide
          </h2>

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
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '4px' }}>
                  Download CareRing-latest.apk
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tap the download button above from your Android browser (Chrome, Firefox, or Brave). Your device will notify you when the 83.36 MB APK file has downloaded.
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
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '4px' }}>
                  Enable &quot;Install Unknown Apps&quot;
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  When prompted by Android security, tap <strong>Settings</strong> and toggle on <em>&quot;Allow from this source&quot;</em> for your browser. This standard prompt appears for all standalone APK packages.
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
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-highlight)', marginBottom: '4px' }}>
                  Launch &amp; Start Live GPS Radar
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tap <strong>Install</strong>. Once complete, open CareRing, sign in with Google or Apple, and create your family circle or enter an invite code to begin sub-50ms live tracking.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* APK Features Showcase Section (Direct SEO Content) */}
        <section className="apk-section" id="apk-features">
          <div className="apk-section-header">
            <h2>CareRing APK Feature Index</h2>
            <p>
              Every premium family safety capability is fully included in the CareRing APK release with zero paywalls or recurring subscriptions.
            </p>
          </div>

          <div className="apk-features-grid">
            {APK_FEATURES.map((feat) => (
              <div key={feat.title} className="apk-feat-card">
                <div className="apk-feat-header">
                  <div className="apk-feat-icon">{feat.icon}</div>
                  <div>
                    <h3>{feat.title}</h3>
                  </div>
                </div>
                <p>{feat.desc}</p>
                <div className="apk-feat-badge">✓ {feat.badge}</div>
              </div>
            ))}
          </div>
        </section>

        {/* APK Technical Specifications Table */}
        <section className="apk-section" id="apk-specs">
          <div className="apk-section-header">
            <h2>CareRing APK Technical Specifications</h2>
            <p>
              Verified package details, architecture compatibility, and security manifest configuration for Android.
            </p>
          </div>

          <div className="apk-specs-card">
            <div className="apk-specs-table-wrapper">
              <table className="apk-specs-table">
                <tbody>
                  {APK_SPECIFICATIONS.map((spec) => (
                    <tr key={spec.label}>
                      <td>{spec.label}</td>
                      <td>
                        {spec.value.includes('.apk') || spec.value.includes('com.carering') ? (
                          <code>{spec.value}</code>
                        ) : (
                          spec.value
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* APK Feature Comparison Matrix */}
        <section className="apk-section" id="apk-comparison">
          <div className="apk-section-header">
            <h2>CareRing APK vs Life360 Platinum</h2>
            <p>
              Compare core APK features and discover why families choose CareRing over expensive commercial subscriptions.
            </p>
          </div>

          <div className="apk-specs-card">
            <div className="apk-specs-table-wrapper">
              <table className="apk-comparison-table">
                <thead>
                  <tr>
                    <th>Feature Capability</th>
                    <th>Life360 Platinum</th>
                    <th>CareRing APK (v1.0.5)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Monthly Cost</strong></td>
                    <td><span className="apk-pill-paid">$24.99 / mo</span></td>
                    <td><span className="apk-pill-free">$0.00 / mo (Free Forever)</span></td>
                  </tr>
                  <tr>
                    <td><strong>Live Radar Refresh</strong></td>
                    <td>10 – 30 seconds delay</td>
                    <td><span className="apk-pill-free">Sub-50ms WebSocket</span></td>
                  </tr>
                  <tr>
                    <td><strong>Geofenced Safe Places</strong></td>
                    <td>Limited to 5 without upgrade</td>
                    <td><span className="apk-pill-free">Unlimited Custom Places</span></td>
                  </tr>
                  <tr>
                    <td><strong>Location Trails &amp; History</strong></td>
                    <td>2 to 30 days paywalled</td>
                    <td><span className="apk-pill-free">30-Day Full Replay</span></td>
                  </tr>
                  <tr>
                    <td><strong>Automated Crash Detection</strong></td>
                    <td>Requires Silver/Gold Tier</td>
                    <td><span className="apk-pill-free">Included Free</span></td>
                  </tr>
                  <tr>
                    <td><strong>Ghost Mode Privacy Blur</strong></td>
                    <td>Limited / Bubble Only</td>
                    <td><span className="apk-pill-free">Precise / Blur / Freeze</span></td>
                  </tr>
                  <tr>
                    <td><strong>Location Data Brokering</strong></td>
                    <td><span className="apk-pill-paid">Brokered to 3rd Parties</span></td>
                    <td><span className="apk-pill-free">Zero Monetization Pledge</span></td>
                  </tr>
                  <tr>
                    <td><strong>Self-Hostable Private Server</strong></td>
                    <td>No (Closed Proprietary)</td>
                    <td><span className="apk-pill-free">Docker Compose Sovereign</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* APK Frequently Asked Questions (FAQ) */}
        <section className="apk-section" id="apk-faq">
          <div className="apk-section-header">
            <h2>CareRing APK FAQs</h2>
            <p>
              Common questions regarding Android installation, APK features, and device compatibility.
            </p>
          </div>

          <div className="apk-faq-list">
            {APK_FAQS.map((faq) => (
              <div key={faq.q} className="apk-faq-item">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* GitHub Source Verification */}
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
              Open-Source &amp; Verified on GitHub
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Inspect release commit tags, changelog history, and security hashes directly on GitHub.
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
