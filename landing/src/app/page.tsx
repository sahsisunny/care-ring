import type { Metadata } from 'next';
import Link from 'next/link';
import { RealMapMockup } from '@/components/RealMapMockup';
import { DownloadCta } from '@/components/DownloadCta';
import { FaqSection, FAQS } from '@/components/FaqSection';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'CareRing APK Download — Free Private Family GPS Tracker & Radar (Official Release)',
  description:
    'Download CareRing APK v1.0.5. Complete APK features: sub-50ms live GPS family radar, automatic crash detection, unlimited geofenced safe places, and Ghost Mode. 100% free Life360 alternative with zero subscriptions.',
  keywords: [
    'CareRing',
    'CareRing APK',
    'CareRing APK download',
    'CareRing APK features',
    'CareRing APK feature list',
    'CareRing-latest.apk',
    'CareRing Android',
    'CareRing features',
    'free Life360 alternative APK',
    'Life360 alternative APK features',
    'open source Life360 APK',
    'private family locator APK',
    'family safety GPS tracker APK',
    'Android family radar APK',
    'driving crash detection APK',
    'Ghost Mode location cloaking',
    'unlimited geofence safe places',
    'battery optimized GPS tracker APK',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'CareRing APK Download — Free Private Family GPS Tracker & Radar',
    description:
      'Download CareRing APK v1.0.5. Real-time family GPS radar, automatic crash detection, unlimited geofenced places, and Ghost Mode with zero subscriptions.',
    url: 'https://care-ring.netlify.app',
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'CareRing APK — Free Private Family GPS Tracker & Radar',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CareRing APK Download — Free Private Family GPS Tracker & Radar',
    description:
      'Download CareRing APK v1.0.5. Sub-50ms live family radar, crash detection, unlimited places, and zero subscriptions.',
    images: ['/og-image.jpg'],
  },
};

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

export default function HomePage() {
  const pageJsonLd = {
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
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((faq) => ({
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }}
      />
      {/* ─── Hero Section (Clean Split Layout like Life360 & GeoZilla) ─── */}
      <section className="hero-split-section">
        <div className="hero-split-grid">
          {/* Left Column: Clear Value Proposition & Actions */}
          <div className="hero-text-col">
            <div className="clean-pill-badge">
              <span className="live-dot" />
              <span>CareRing v1.0.5 Available • 100% Free Forever</span>
            </div>

            <h1 className="hero-main-title">
              Keep your loved ones safe, connected, and in reach.
            </h1>

            <p className="hero-main-desc">
              Real-time GPS family radar, automatic crash detection, and smart place alerts. Zero subscriptions, zero advertisements, and zero location data monetization.
            </p>

            <div className="hero-cta-group">
              <a
                href={LATEST_APK_URL}
                download
                className="btn-primary hero-btn-main"
                title="Download official CareRing APK"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download for Android (APK)</span>
              </a>

              <Link
                href="/features"
                className="btn-secondary hero-btn-sub"
              >
                <span>Explore All 16 Features ↗</span>
              </Link>
            </div>

            <div className="hero-trust-list">
              <div className="hero-trust-item">
                <span className="trust-check">✓</span>
                <span>100% Free &amp; Open Source</span>
              </div>
              <div className="hero-trust-item">
                <span className="trust-check">✓</span>
                <span>Zero Location Monetization</span>
              </div>
              <div className="hero-trust-item">
                <span className="trust-check">✓</span>
                <span>&lt;1% Battery Drain / Hr</span>
              </div>
            </div>
          </div>

          {/* Right Column: Real Smartphone Map Interactive Showcase */}
          <div className="hero-phone-col">
            <div className="phone-ambient-backdrop" />
            <RealMapMockup />
            <div className="phone-caption-hint">
              <span>👆</span>
              <span>Tap family pins to test interactive radar telemetry</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Clean Key Metrics Bar (like Life360 & GeoZilla) ─── */}
      <section className="metrics-strip-section">
        <div className="metrics-strip-container">
          <div className="metric-box">
            <div className="metric-val">&lt; 50ms</div>
            <div className="metric-lbl">Sub-second Live GPS Sync</div>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <div className="metric-val">$0 / mo</div>
            <div className="metric-lbl">Zero Subscription Fees</div>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <div className="metric-val">Unlimited</div>
            <div className="metric-lbl">Geofenced Safe Places</div>
          </div>
          <div className="metric-divider" />
          <div className="metric-box">
            <div className="metric-val">30 Days</div>
            <div className="metric-lbl">Included Location History</div>
          </div>
        </div>
      </section>

      {/* ─── 4 Core Features (Clean, Breathable Cards) ─── */}
      <section className="clean-section">
        <div className="section-header-clean">
          <h2 className="clean-heading">
            Engineered for Families, Not Data Brokers
          </h2>
          <p className="clean-subheading">
            Commercial safety apps turn your family location trails into advertising inventory. CareRing replaces monetization with privacy-first engineering.
          </p>
        </div>

        <div className="clean-cards-grid">
          {/* Card 1 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box indigo">📡</div>
            <h3>Sub-50ms Live Radar</h3>
            <p>
              Always know where they are without texting &quot;Where are you?&quot; Continuous WebSocket telemetry streams fluid pin motion as members travel, walk, or commute.
            </p>
            <div className="card-footer-check">
              ✓ Adaptive motion gating for &lt;1% battery drain
            </div>
            <Link
              href="/features#radar"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--primary)',
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              Explore Live Radar APK Specs →
            </Link>
          </div>

          {/* Card 2 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box cyan">🏎️</div>
            <h3>Intelligent Driving Safety &amp; SOS</h3>
            <p>
              Automatic high-G collision detection, hard braking alerts, speeding notices, and one-tap emergency panic sirens with exact coordinates.
            </p>
            <div className="card-footer-check">
              ✓ Automated 0–100 driver safety scores
            </div>
            <Link
              href="/features#driving"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--cyan)',
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              Explore Driving &amp; Crash Detection Specs →
            </Link>
          </div>

          {/* Card 3 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box emerald">🏡</div>
            <h3>Unlimited Geofenced Places</h3>
            <p>
              Unlike commercial apps that lock you to 2 places without a paywall, CareRing offers unlimited custom-radius places with arrival and departure alerts.
            </p>
            <div className="card-footer-check">
              ✓ Instant arrival &amp; departure notifications
            </div>
            <Link
              href="/features#geofences"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--emerald)',
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              Explore Geofence Places Specs →
            </Link>
          </div>

          {/* Card 4 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box purple">👻</div>
            <h3>Ghost Mode &amp; Autonomy</h3>
            <p>
              Mutual respect and boundary control. Cloak your exact coordinates to a generalized neighborhood zone or pause sharing whenever you need personal space.
            </p>
            <div className="card-footer-check">
              ✓ Strict zero-tracking &amp; client-side cloaking
            </div>
            <Link
              href="/features#ghost-mode"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--purple)',
                marginTop: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                textDecoration: 'none',
              }}
            >
              Explore Ghost Mode Privacy Specs →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── "How It Works" 3 Simple Steps (like GeoZilla) ─── */}
      <section className="how-it-works-section">
        <div className="section-header-clean">
          <h2 className="clean-heading">How CareRing Works</h2>
          <p className="clean-subheading">
            Get started in under 60 seconds with no account friction or subscription paywalls.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-num">1</div>
            <h4>Download the APK</h4>
            <p>
              Install the official production-signed <code>CareRing-latest.apk</code> directly onto your Android device.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-num">2</div>
            <h4>Create or Join a Circle</h4>
            <p>
              Generate a private 6-letter invite code and share it with your family or friends via SMS or chat.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-num">3</div>
            <h4>Stay Connected &amp; Safe</h4>
            <p>
              View live family members on vector maps, receive place arrival alerts, and enjoy mutual safety protection.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Side-by-Side Honest Comparison (CareRing vs Life360) ─── */}
      <section className="comparison-section">
        <div className="section-header-clean">
          <h2 className="clean-heading">CareRing vs. Commercial Trackers</h2>
          <p className="clean-subheading">
            Transparent comparison between CareRing and commercial apps like Life360.
          </p>
        </div>

        <div className="table-responsive-wrapper">
          <table className="comparison-table-clean">
            <thead>
              <tr>
                <th>CAPABILITY</th>
                <th className="highlight-carering">CARERING</th>
                <th className="commercial-alt">LIFE360</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Subscription Cost</td>
                <td className="highlight-carering"><strong>$0 (Free Forever)</strong></td>
                <td className="commercial-alt">$14.99 – $24.99 / mo</td>
              </tr>
              <tr>
                <td>Location Data Brokering</td>
                <td className="highlight-carering"><strong>Strict Zero (Never Sold)</strong></td>
                <td className="commercial-alt">Brokered to insurers &amp; advertisers</td>
              </tr>
              <tr>
                <td>Geofenced Safe Places</td>
                <td className="highlight-carering"><strong>Unlimited Places</strong></td>
                <td className="commercial-alt">Limited to 2 without paid subscription</td>
              </tr>
              <tr>
                <td>Location Breadcrumb History</td>
                <td className="highlight-carering"><strong>30 Days Included</strong></td>
                <td className="commercial-alt">Only 2 Days on free tier</td>
              </tr>
              <tr>
                <td>Crash Detection &amp; SOS Alerts</td>
                <td className="highlight-carering"><strong>Included (Zero Paywall)</strong></td>
                <td className="commercial-alt">Requires Gold / Platinum tier</td>
              </tr>
              <tr>
                <td>Self-Hosting Sovereignty</td>
                <td className="highlight-carering"><strong>Docker Compose Included</strong></td>
                <td className="commercial-alt">Impossible (Closed Cloud)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── FAQ Accordion (Clean & Expandable like Otozen & GeoZilla) ─── */}
      <FaqSection />

      {/* ─── Direct Download CTA Section ─── */}
      <DownloadCta />
    </>
  );
}
