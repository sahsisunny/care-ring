import type { Metadata } from 'next';
import { DownloadCta } from '@/components/DownloadCta';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'CareRing APK Features Catalog — 16 Complete Family Safety Capabilities',
  description:
    'Explore the complete CareRing Android APK features directory: sub-50ms live GPS radar, intelligent crash detection, unlimited geofenced safe places, Ghost Mode, and 30-day location trails. 100% free with zero paywalls.',
  keywords: [
    'CareRing APK features',
    'CareRing APK feature list',
    'CareRing features directory',
    'CareRing capabilities',
    'family safety APK features',
    'live family radar APK',
    'driving safety crash detection APK',
    'unlimited safe places geofencing',
    'Ghost Mode location privacy',
    'free Life360 alternative APK features',
    'private GPS tracking features',
    'Android family locator APK features',
    'battery optimized GPS tracker APK',
    'offline GPS tracking APK',
    'self hosted family tracker APK',
  ],
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: 'CareRing APK Features Catalog — 16 Complete Family Safety Capabilities',
    description:
      'All 16 production features included free in the CareRing APK release: real-time radar, crash detection, unlimited safe zones, and Ghost Mode.',
    url: 'https://care-ring.netlify.app/features',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CareRing APK Features Catalog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CareRing APK Features Catalog — 16 Complete Family Safety Capabilities',
    description:
      'Every feature unlocked in the official CareRing Android APK. Zero subscriptions, zero paywalls.',
    images: ['/og-image.jpg'],
  },
};

interface FeatureDetail {
  id: string;
  icon: string;
  title: string;
  category: string;
  tag: string;
  description: string;
  howItWorks: string;
  metrics: string[];
}

const ALL_FEATURES: FeatureDetail[] = [
  {
    id: 'radar',
    icon: '📡',
    title: 'Live Family GPS Radar',
    category: 'Location & Tracking',
    tag: 'Sub-50ms Sync',
    description:
      'Continuous sub-50ms WebSocket streaming delivers instantaneous pin motion as circle members travel, walk, or commute without stuttering or manual pull-to-refresh.',
    howItWorks:
      'The Android APK connects to a high-concurrency WebSocket pipeline. When members are in motion, coordinates are broadcast in real time with heading direction and speed telemetry.',
    metrics: ['Sub-50ms latency', 'Dual-ring radar waves', 'Auto-heading rotation', 'Battery-aware duty cycle'],
  },
  {
    id: 'driving',
    icon: '🏎️',
    title: 'Intelligent Driving Safety & Scores',
    category: 'Driving Telemetry',
    tag: 'Sensor Fusion',
    description:
      'Automated background trip detection calculates top speed, hard braking events, rapid accelerations, and phone distraction scores for every drive.',
    howItWorks:
      'The APK samples the device gyroscope and accelerometer to detect vehicular movement. At the end of each drive, an algorithmic 0–100 Driver Score is generated.',
    metrics: ['0–100 Driver Score', 'Hard brake g-force', 'Speeding alerts', 'Trip route summary'],
  },
  {
    id: 'sos',
    icon: '🚨',
    title: 'Automated Crash Detection & SOS',
    category: 'Emergency Response',
    tag: 'Critical Safety',
    description:
      'High-frequency accelerometer motion fusion detects severe vehicular impacts (>3.5G) and immediately alerts circle members with exact GPS coordinates and audio siren.',
    howItWorks:
      'If sudden deceleration above threshold is detected, the APK triggers an on-device safety countdown. If not dismissed, emergency push alerts and coordinates are dispatched instantly.',
    metrics: ['Instant push alert', 'Automated SMS broadcast', 'Audio emergency siren', '1-tap circle dispatch'],
  },
  {
    id: 'geofences',
    icon: '🏡',
    title: 'Unlimited Geofenced Safe Places',
    category: 'Places & Geofencing',
    tag: 'Zero Paywalls',
    description:
      'Unlike commercial apps that restrict you to 2 places without a subscription, CareRing allows unlimited custom-radius geofences (Home, School, Work, Gym, Grandparents).',
    howItWorks:
      'Safe zones use PostGIS radial geometry. When circle members enter or leave defined radiuses (50m–2000m), background notifications are dispatched automatically.',
    metrics: ['Unlimited places', 'Enter/exit notifications', 'Custom 50m–2000m radius', 'Custom zone names & icons'],
  },
  {
    id: 'ghost-mode',
    icon: '👻',
    title: 'Ghost Mode & Location Autonomy',
    category: 'Privacy Autonomy',
    tag: 'Mutual Boundaries',
    description:
      'Maintain personal boundaries when needed. Cloak your exact coordinates into a blurred regional area or pause location broadcasting for a chosen duration with zero notifications to others.',
    howItWorks:
      'When toggled in the APK, coordinates are generalized client-side before transmission. Circle members see a blurred neighborhood zone rather than an exact address pin.',
    metrics: ['Custom blur radius', 'Timed pause sharing (1h/4h/8h)', 'Instant uncloak toggle', 'Zero alert to others'],
  },
  {
    id: 'battery',
    icon: '🔋',
    title: 'Intelligent Battery Preserver',
    category: 'Performance',
    tag: '< 1% Drain / Hour',
    description:
      'Adaptive motion sensor gating throttles GPS polling when stationary and wakes up immediately when vehicular motion is detected, ensuring all-day battery life.',
    howItWorks:
      'The APK utilizes Android Activity Recognition. When stationary at home or office, GPS chips enter sleep mode, consuming less than 1% battery per hour.',
    metrics: ['<1% battery drain/hr', 'Motion sensor gating', 'Low battery alerts (<15%)', 'Optimized foreground service'],
  },
  {
    id: 'history',
    icon: '🗓️',
    title: '30-Day Complete Location History',
    category: 'Historical Trails',
    tag: 'Full Route Replay',
    description:
      'Replay any day, commute path, or travel route with speed timestamps, departure logs, and arrival confirmation completely free of charge.',
    howItWorks:
      'Breadcrumb points are saved in high-density time-series tables. Users can scrub through past routes with a timeline slider to review speed and dwell duration.',
    metrics: ['30-day breadcrumbs', 'Route playback slider', 'Instant purge controls', 'Speed timestamp markers'],
  },
  {
    id: 'circles',
    icon: '👨‍👩‍👧‍👦',
    title: 'Multiple Family & Friend Circles',
    category: 'Organization',
    tag: 'Multi-Circle',
    description:
      'Create separate circles for Immediate Family, Close Friends, Hiking Buddies, or Neighborhood Watch with custom role-based administrative permissions.',
    howItWorks:
      'Circles are cryptographic partitions with unique 6-character invite codes. Members can belong to multiple circles with completely independent privacy settings.',
    metrics: ['6-character invite code', 'Admin / Member roles', 'Isolated circle boundaries', 'Instant member removal'],
  },
  {
    id: 'maps',
    icon: '🗺️',
    title: 'Tri-Mode Dynamic Vector Maps',
    category: 'Map Experience',
    tag: '60 FPS Rendering',
    description:
      'Switch between Dark Mode, Vivid Street View, and High-Resolution Satellite imagery with smooth 60fps vector rendering and tilt-compass orientation.',
    howItWorks:
      'Built with Mapbox GL and OpenStreetMap vector tiles, the APK renders 3D building outlines, traffic density layers, and clustered member avatars.',
    metrics: ['Dark & Satellite styles', 'Dynamic 3D tilt compass', 'Clustered member badges', 'Live heading cones'],
  },
  {
    id: 'chat',
    icon: '💬',
    title: 'End-to-End Circle Safe Chat',
    category: 'Communication',
    tag: 'Location Anchored',
    description:
      'Direct messaging and location-anchored check-ins within your circle. Coordinates can be attached to messages for easy meeting-spot coordination.',
    howItWorks:
      'Messages stream over encrypted WebSocket connections. Circle members can share quick check-in chips ("Arrived Safely", "On My Way", "Pick Me Up").',
    metrics: ['Instant WSS delivery', 'Location check-in chips', 'Zero ad scraping', 'Offline queue retry'],
  },
  {
    id: 'offline',
    icon: '📶',
    title: 'Offline Telemetry Sync & Queue',
    category: 'Reliability',
    tag: 'Dead-Zone Resilient',
    description:
      'When driving through cellular dead zones or tunnels, breadcrumbs are securely queued on-device and batch-synchronized immediately upon signal recovery.',
    howItWorks:
      'The Android APK uses an embedded SQLite WAL database to spool telemetry points offline. As soon as connectivity returns, points are synchronized in order.',
    metrics: ['Zero lost coordinates', 'SQLite local caching', 'Automatic backoff retry', 'Compressed batch sync'],
  },
  {
    id: 'self-host',
    icon: '🛡️',
    title: 'Self-Hosted Sovereign Deployment',
    category: 'Infrastructure',
    tag: '100% Open Source',
    description:
      'Deploy your private CareRing server cluster with Docker Compose, PostgreSQL 16, PostGIS 3.4, and Caddy reverse proxy on any VPS (DigitalOcean, AWS, Linode).',
    howItWorks:
      'The CareRing Android APK includes a built-in server configuration switcher. Point the app to your personal domain for 100% sovereign family privacy.',
    metrics: ['One-command docker compose', '100% data isolation', 'Custom backend URL entry', 'MIT License code'],
  },
];

const APK_FEATURE_FAQS = [
  {
    question: 'Are all 16 features included in the official CareRing APK download?',
    answer:
      'Yes. Every feature—including sub-50ms live radar, automated high-G crash detection, unlimited geofenced safe places, 30-day location history, Ghost Mode, and driver safety scores—is 100% unlocked in the CareRing APK release. There are no paid tiers, no trials, and zero paywalls.',
  },
  {
    question: 'How does CareRing APK crash detection work on Android?',
    answer:
      'The APK uses high-frequency accelerometer and gyroscope sensor fusion to detect sudden vehicular decelerations exceeding 3.5G. When an impact is verified, an automatic countdown is initiated. If uncancelled, an emergency SOS push broadcast with real-time GPS coordinates is sent to all circle members.',
  },
  {
    question: 'Can I set unlimited geofence safe places in the APK without paying?',
    answer:
      'Yes. Unlike Life360 which limits free users to only 2 safe places, CareRing allows you to create unlimited custom-radius places (Home, School, Work, Gym, Grandparents) with instant arrival and departure notifications completely free.',
  },
  {
    question: 'How does Ghost Mode work in the CareRing APK without alerting others?',
    answer:
      'Ghost Mode allows any circle member to either blur their location to a randomized neighborhood area (blur radius) or freeze their pin for a chosen duration. The cloaking is handled on-device before transmission, and no notification is broadcast to others, maintaining healthy privacy boundaries.',
  },
  {
    question: 'How does the CareRing APK achieve less than 1% battery drain per hour?',
    answer:
      'CareRing uses adaptive motion gating powered by Android Activity Recognition. When your device is stationary at home or at the office, high-power GPS polling sleeps. Radar polling wakes up automatically only when movement or driving is detected.',
  },
];

export default function FeaturesPage() {
  const jsonLdGraph = {
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
            name: 'APK Features',
            item: 'https://care-ring.netlify.app/features',
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'CareRing Android APK Complete Features Directory',
        description: 'Comprehensive directory of all 16 CareRing Android APK safety, telemetry, and privacy capabilities.',
        itemListElement: ALL_FEATURES.map((feat, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: `CareRing APK Feature: ${feat.title}`,
          description: feat.description,
          url: `https://care-ring.netlify.app/features#${feat.id}`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: APK_FEATURE_FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return (
    <div className="subpage-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />

      {/* Hero Section */}
      <div className="subpage-hero">
        <div className="clean-pill-badge" style={{ marginBottom: '16px' }}>
          <span className="live-dot" />
          <span>CareRing v1.0.5 APK • 16 Features Unlocked • Zero Paywalls</span>
        </div>
        <h1 className="subpage-title">CareRing APK Features &amp; Capabilities Directory</h1>
        <p className="subpage-desc">
          Commercial family trackers charge $15 to $25 per month for basic driving logs and safe places. CareRing provides an enterprise-grade safety suite completely free and open source.
        </p>

        {/* Feature Jump Pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '28px',
            maxWidth: '900px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
          aria-label="Quick jump to APK feature"
        >
          {ALL_FEATURES.map((feat) => (
            <a
              key={feat.id}
              href={`#${feat.id}`}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-card)',
                padding: '6px 12px',
                borderRadius: '999px',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {feat.icon} {feat.title}
            </a>
          ))}
          <a
            href="#comparison-matrix"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'var(--primary-light)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              padding: '6px 12px',
              borderRadius: '999px',
              textDecoration: 'none',
            }}
          >
            📊 Features vs Life360 Matrix
          </a>
          <a
            href="#apk-specs"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--emerald)',
              background: 'var(--emerald-light)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '6px 12px',
              borderRadius: '999px',
              textDecoration: 'none',
            }}
          >
            📱 APK Technical Specs
          </a>
        </div>
      </div>

      {/* Grid of All Features */}
      <div className="features-grid">
        {ALL_FEATURES.map((feat) => (
          <div
            key={feat.id}
            id={feat.id}
            className="features-card"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '34px' }}>{feat.icon}</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                }}
              >
                {feat.tag}
              </span>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                {feat.category} • Android APK Feature
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '4px' }}>
                {feat.title}
              </h2>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {feat.description}
            </p>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-card)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: 'var(--text-highlight)', display: 'block', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase' }}>
                ⚡ How It Works in CareRing APK:
              </strong>
              {feat.howItWorks}
            </div>

            <div
              style={{
                marginTop: 'auto',
                paddingTop: '16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              {feat.metrics.map((m) => (
                <span
                  key={m}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-card)',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}
                >
                  ✓ {m}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Side-by-Side Honest Comparison Matrix */}
      <section id="comparison-matrix" className="apk-section" style={{ marginBottom: '80px' }}>
        <div className="apk-section-header">
          <h2>CareRing APK Features vs. Life360 &amp; Commercial Trackers</h2>
          <p>
            Compare features directly. Why pay $240/year when you can download the CareRing APK for free with zero data brokering?
          </p>
        </div>

        <div className="table-responsive-wrapper">
          <table className="apk-comparison-table">
            <thead>
              <tr>
                <th>Safety &amp; Telemetry Feature</th>
                <th>CareRing APK (v1.0.5)</th>
                <th>Life360 Free</th>
                <th>Life360 Platinum</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Monthly Cost</strong></td>
                <td><span className="apk-pill-free">$0.00 / mo (Free Forever)</span></td>
                <td>$0 (Feature Limited)</td>
                <td><span className="apk-pill-paid">$24.99 / mo</span></td>
              </tr>
              <tr>
                <td><strong>Live Radar Refresh Latency</strong></td>
                <td><span className="apk-pill-free">Sub-50ms Continuous WebSocket</span></td>
                <td>Manual Pull / 15-30s delay</td>
                <td>10-15s delay</td>
              </tr>
              <tr>
                <td><strong>Geofenced Safe Places</strong></td>
                <td><span className="apk-pill-free">Unlimited Custom Places</span></td>
                <td><span className="apk-pill-paid">Limited to 2 Places</span></td>
                <td>Unlimited (Paid Tier)</td>
              </tr>
              <tr>
                <td><strong>Historical Breadcrumb History</strong></td>
                <td><span className="apk-pill-free">30 Days Full Replay</span></td>
                <td><span className="apk-pill-paid">Only 2 Days</span></td>
                <td>30 Days (Paid Tier)</td>
              </tr>
              <tr>
                <td><strong>Automated Crash Detection (&gt;3.5G)</strong></td>
                <td><span className="apk-pill-free">Included Free</span></td>
                <td><span className="apk-pill-paid">Not Included</span></td>
                <td>Included (Paid Tier)</td>
              </tr>
              <tr>
                <td><strong>Ghost Mode Privacy Autonomy</strong></td>
                <td><span className="apk-pill-free">Precise / Blur / Freeze Included</span></td>
                <td><span className="apk-pill-paid">Not Available</span></td>
                <td>Limited Bubble Only</td>
              </tr>
              <tr>
                <td><strong>Location Telemetry Brokering</strong></td>
                <td><span className="apk-pill-free">Strict Zero (Never Sold)</span></td>
                <td><span className="apk-pill-paid">Brokered to 3rd Parties</span></td>
                <td><span className="apk-pill-paid">Brokered to 3rd Parties</span></td>
              </tr>
              <tr>
                <td><strong>Self-Hostable Private Server</strong></td>
                <td><span className="apk-pill-free">Docker Compose One-Command</span></td>
                <td><span className="apk-pill-paid">Impossible (Closed Cloud)</span></td>
                <td><span className="apk-pill-paid">Impossible (Closed Cloud)</span></td>
              </tr>
              <tr>
                <td><strong>Battery Consumption</strong></td>
                <td><span className="apk-pill-free">&lt; 1% per hour (Motion-Gated)</span></td>
                <td>3 – 6% per hour</td>
                <td>3 – 6% per hour</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* APK Technical Specifications & Compatibility Section */}
      <section id="apk-specs" className="apk-section" style={{ marginBottom: '80px' }}>
        <div className="apk-section-header">
          <h2>CareRing Android APK Technical Specifications</h2>
          <p>
            Engineered for Android smartphones. High performance, native hardware integration, and zero battery waste.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: '16px',
            maxWidth: '1000px',
            margin: '0 auto',
          }}
        >
          <div className="dev-stack-item">
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>🤖</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '4px' }}>
              Android OS Compatibility
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Supports Android 8.0 (Oreo / API 26) through Android 15 (Vanilla Ice Cream / API 35) on phones and tablets.
            </p>
          </div>

          <div className="dev-stack-item">
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>📦</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '4px' }}>
              Package &amp; APK Hash
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Package: <code>com.carering.app</code> • File: <code>CareRing-latest.apk</code> (83.36 MB) • V2/V3 Keystore signature verified.
            </p>
          </div>

          <div className="dev-stack-item">
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>⚙️</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '4px' }}>
              Architecture Support
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Universal APK with binaries for 64-bit ARM (arm64-v8a), 32-bit ARM (armeabi-v7a), and x86_64 emulators.
            </p>
          </div>

          <div className="dev-stack-item">
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>🔋</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '4px' }}>
              Battery Gating Engine
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Activity Recognition Sensor Fusion automatically sleeps GPS chips when stationary, consuming &lt;1% battery per hour.
            </p>
          </div>

          <div className="dev-stack-item">
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>📡</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '4px' }}>
              Encrypted Real-Time Telemetry
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              TLS 1.3 encrypted WebSockets deliver coordinates in sub-50ms with automatic SQLite dead-zone offline spooling.
            </p>
          </div>

          <div className="dev-stack-item">
            <span style={{ fontSize: '20px', display: 'block', marginBottom: '8px' }}>🛡️</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-highlight)', marginBottom: '4px' }}>
              Zero Advertising / Tracking SDKs
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              0 Facebook SDKs, 0 Google AdMob, 0 data-broker telemetry libraries. 100% open source under the MIT License.
            </p>
          </div>
        </div>
      </section>

      {/* APK Features FAQ Section */}
      <section className="faq-section" style={{ borderRadius: '24px', marginBottom: '60px' }} aria-labelledby="features-faq-heading">
        <div className="section-header-clean">
          <h2 id="features-faq-heading" className="clean-heading">
            CareRing APK Features FAQ
          </h2>
          <p className="clean-subheading">
            Answers to common questions about features, sensor accuracy, and Android permissions in the CareRing APK.
          </p>
        </div>

        <div className="faq-list">
          {APK_FEATURE_FAQS.map((faq, index) => (
            <details
              key={index}
              className="faq-item"
              open={index === 0}
            >
              <summary className="faq-question-btn">
                <span className="faq-question-text">{faq.question}</span>
                <span className="faq-icon-wrapper" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </summary>
              <div className="faq-answer-content">
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <DownloadCta />
    </div>
  );
}
