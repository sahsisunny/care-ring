import type { Metadata } from 'next';
import Link from 'next/link';
import { SavingsCalculator } from '@/components/SavingsCalculator';
import { DownloadCta } from '@/components/DownloadCta';
import { FaqSection } from '@/components/FaqSection';
import { FAQS } from '@/data/faqs';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Compass,
  Car,
  EyeOff,
  Zap,
  Radio,
  Users,
  Heart,
  Check,
  Sparkles,
  History,
  Download,
} from 'lucide-react';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'CareRing — Free Private Family GPS Tracker & Live Radar APK',
  description:
    'Download CareRing APK v1.0.5. Free private family GPS tracker & radar. Sub-second live sync, automatic crash detection, unlimited geofenced safe places, and Ghost Mode with zero subscriptions and zero ads.',
  keywords: [
    'CareRing',
    'CareRing APK',
    'CareRing APK download',
    'free family tracker',
    'private family GPS tracker',
    'open source family locator',
    'family safety radar APK',
    'crash detection APK free',
    'Ghost Mode location privacy',
    'unlimited safe places geofencing',
    'battery optimized GPS tracker',
    'private family map app',
  ],
  alternates: {
    canonical: '/',
  },
};

export default function HomePage() {
  const homeJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'CareRing',
        applicationCategory: 'SafetyApplication',
        operatingSystem: 'Android 8.0 and up',
        offers: {
          '@type': 'Offer',
          price: '0.00',
          priceCurrency: 'USD',
        },
        downloadUrl:
          'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk',
        softwareVersion: '1.0.5',
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          ratingCount: '128',
        },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />

      {/* ─── Hero Section: Clean, Centered, and Human ─── */}
      <section className="hero-split-section">
        <div className="hero-centered-layout">
          <div className="clean-pill-badge">
            <span className="live-dot" />
            <span>Official Release v1.0.5 • Universal Android APK</span>
          </div>

          <h1 className="hero-main-title">
            Know they&apos;re safe.{' '}
            <span className="title-gradient-accent">Simple, private &amp; free forever.</span>
          </h1>

          <p className="hero-main-desc">
            Real-time family GPS radar, automatic vehicular crash detection, and smart safe place alerts. Zero monthly subscriptions, zero ads, and strictly zero location selling.
          </p>

          {/* Primary Action Buttons */}
          <div className="hero-cta-group">
            <a
              href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk"
              download
              className="btn-download-primary hero-btn-main"
              title="Download official CareRing APK v1.0.5"
            >
              <div className="btn-icon-wrap">
                <Download size={22} />
              </div>
              <div className="btn-text-wrap">
                <span className="btn-label-top">Download Free APK</span>
                <span className="btn-label-sub">v1.0.5 • Universal Android (83.36 MB)</span>
              </div>
            </a>

            <Link
              href="/features"
              className="btn-secondary hero-btn-sub"
            >
              <span>Explore All Features ↗</span>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="hero-trust-list">
            <div className="hero-trust-item">
              <span className="trust-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Check size={12} />
              </span>
              <span>100% Free &amp; Open Source</span>
            </div>
            <div className="hero-trust-item">
              <span className="trust-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Check size={12} />
              </span>
              <span>Zero Location Selling</span>
            </div>
            <div className="hero-trust-item">
              <span className="trust-check" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Check size={12} />
              </span>
              <span>&lt;1% Battery Drain / Hr</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Key Metrics Strip: Clean & Breathable ─── */}
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
            <div className="metric-lbl">Included Trip &amp; Speed History</div>
          </div>
        </div>
      </section>

      {/* ─── 3 Visual Feature Stories (HangoutU & StayNow style) ─── */}
      <section className="stories-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Heart size={14} style={{ color: '#EF4444' }} />
            <span>Why Families Love CareRing</span>
          </div>
          <h2 className="clean-heading">
            Built for families, not advertising companies
          </h2>
          <p className="clean-subheading">
            Commercial safety apps turn your family location trails into advertising inventory and lock basic safety behind $25/month paywalls. CareRing changes everything.
          </p>
        </div>

        <div className="stories-grid">
          {/* Story 1 */}
          <div className="story-card">
            <div className="story-icon-wrap emerald" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={24} />
            </div>
            <div className="story-tag">Live Peace of Mind</div>
            <h3 className="story-title">Know they got there safely — without asking</h3>
            <p className="story-desc">
              Get automatic notifications when your kids arrive at school, sports practice, or a friend&apos;s home. Never worry through late commutes again.
            </p>
            <ul className="story-points">
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                Unlimited safe places (commercial apps lock you to 2)
              </li>
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                Sub-second live coordinate sync with fluid motion
              </li>
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                Real-time battery levels so you know when their phone is low
              </li>
            </ul>
          </div>

          {/* Story 2 */}
          <div className="story-card highlight">
            <div className="story-icon-wrap coral" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={24} />
            </div>
            <div className="story-tag">Driving Safety</div>
            <h3 className="story-title">Protection on every mile with automatic crash detection</h3>
            <p className="story-desc">
              CareRing continuously samples device motion sensors. If high-impact vehicular deceleration (&gt;3.5G) occurs, it immediately alerts your circle with coordinates and driving directions.
            </p>
            <ul className="story-points">
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                Automatic crash detection with emergency siren
              </li>
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                0–100 Driver Safety Scores to teach teens safe habits
              </li>
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                Speed limit alerts and hard brake notifications
              </li>
            </ul>
          </div>

          {/* Story 3 */}
          <div className="story-card">
            <div className="story-icon-wrap purple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EyeOff size={24} />
            </div>
            <div className="story-tag">Privacy &amp; Autonomy</div>
            <h3 className="story-title">Privacy that respects independence with Ghost Mode</h3>
            <p className="story-desc">
              Healthy families need healthy boundaries. Teens or partners can blur their pin to a neighborhood zone whenever they need personal space, keeping everyone safe without toxic micromanagement.
            </p>
            <ul className="story-points">
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                3 privacy levels: Precise, Neighborhood Blur, and Frozen
              </li>
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                Zero location data selling to insurance companies or brokers
              </li>
              <li>
                <Check size={14} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-2px' }} />
                End-to-end encrypted coordinate transmissions
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── 6 Core Capabilities Showcase Grid ─── */}
      <section className="clean-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} style={{ color: 'var(--amber)' }} />
            <span>Everything You Need</span>
          </div>
          <h2 className="clean-heading">
            A complete safety suite with zero paywalls
          </h2>
          <p className="clean-subheading">
            Every feature is fully unlocked from day one in the CareRing Android APK.
          </p>
        </div>

        <div className="clean-cards-grid">
          {/* Card 1 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box indigo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Radio size={22} />
            </div>
            <h3>Sub-Second Live GPS Radar</h3>
            <p>
              Continuous WebSocket streaming updates family pins smoothly as members walk, commute, or travel without pulling to refresh.
            </p>
            <div className="card-footer-check" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} style={{ color: 'var(--emerald)' }} />
              <span>Smart motion gating keeps battery drain &lt;1% / hour</span>
            </div>
            <Link href="/features#radar" className="card-link">
              Explore Live Radar Specs →
            </Link>
          </div>

          {/* Card 2 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box cyan" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car size={22} />
            </div>
            <h3>Intelligent Driving Safety &amp; Scores</h3>
            <p>
              Automatic trip logging with top speed, rapid accelerations, hard braking alerts, and an algorithmic 0–100 Driver Score.
            </p>
            <div className="card-footer-check" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} style={{ color: 'var(--emerald)' }} />
              <span>Helps new teen drivers build calm, safe habits</span>
            </div>
            <Link href="/features#driving" className="card-link">
              Explore Driving Safety Specs →
            </Link>
          </div>

          {/* Card 3 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box emerald" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={22} />
            </div>
            <h3>Unlimited Geofenced Places</h3>
            <p>
              Unlike other apps that charge for more than 2 places, CareRing gives you unlimited custom-radius zones with enter and leave alerts.
            </p>
            <div className="card-footer-check" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} style={{ color: 'var(--emerald)' }} />
              <span>Instant arrival and departure alerts</span>
            </div>
            <Link href="/features#geofences" className="card-link">
              Explore Geofence Places Specs →
            </Link>
          </div>

          {/* Card 4 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box purple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <EyeOff size={22} />
            </div>
            <h3>Ghost Mode &amp; Boundaries</h3>
            <p>
              Mutual respect and boundary control. Cloak your exact coordinates to a generalized neighborhood zone whenever you need space.
            </p>
            <div className="card-footer-check" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} style={{ color: 'var(--emerald)' }} />
              <span>Strict zero-tracking &amp; on-device cloaking</span>
            </div>
            <Link href="/features#ghost-mode" className="card-link">
              Explore Ghost Mode Specs →
            </Link>
          </div>

          {/* Card 5 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box amber" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={22} />
            </div>
            <h3>30-Day Location Route Trails</h3>
            <p>
              Review 30 days of complete driving trails, transit timelines, and historical stops. Free tier on commercial apps locks history to 2 days.
            </p>
            <div className="card-footer-check" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} style={{ color: 'var(--emerald)' }} />
              <span>Replay past drives and verify arrival times</span>
            </div>
            <Link href="/features#history" className="card-link">
              Explore History Replay Specs →
            </Link>
          </div>

          {/* Card 6 */}
          <div className="clean-feature-card">
            <div className="clean-icon-box blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} />
            </div>
            <h3>Encrypted Family Circle Chat</h3>
            <p>
              Private family check-in messages with 1-tap coordinate pins directly inside your safety radar.
            </p>
            <div className="card-footer-check" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Check size={14} style={{ color: 'var(--emerald)' }} />
              <span>Fast communication without switching apps</span>
            </div>
            <Link href="/features#chat" className="card-link">
              Explore Circle Chat Specs →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── "How It Works" 3 Simple Steps (Clean, like HangoutU) ─── */}
      <section className="how-it-works-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} style={{ color: 'var(--primary)' }} />
            <span>Get Started in Under 60 Seconds</span>
          </div>
          <h2 className="clean-heading">How CareRing Works</h2>
          <p className="clean-subheading">
            No credit card, no subscription traps, and no account friction.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-num">01</div>
            <h3>Download the APK</h3>
            <p>
              Install the verified production-signed <code>CareRing-latest.apk</code> directly onto your Android device in 30 seconds.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-num">02</div>
            <h3>Create or Join a Circle</h3>
            <p>
              Generate a safe 6-letter invite code (like <code>FAMILY</code>) and share it with your family or friends via SMS or chat.
            </p>
          </div>

          <div className="step-arrow">→</div>

          <div className="step-card">
            <div className="step-num">03</div>
            <h3>Stay Safe &amp; Connected</h3>
            <p>
              See each other on a live vector map, receive arrival alerts, and enjoy mutual safety protection wherever life takes you.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Interactive Family Savings Calculator ─── */}
      <section className="calculator-section">
        <SavingsCalculator />
      </section>

      {/* ─── Side-by-Side Honest Comparison (CareRing vs Others) ─── */}
      <section className="comparison-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} style={{ color: 'var(--emerald)' }} />
            <span>Honest Breakdown</span>
          </div>
          <h2 className="clean-heading">CareRing vs. Other Safety Apps</h2>
          <p className="clean-subheading">
            Compare CareRing with other commercial family locator apps.
          </p>
        </div>

        <div className="table-responsive-wrapper">
          <table className="comparison-table-clean">
            <thead>
              <tr>
                <th>SAFETY CAPABILITY</th>
                <th className="highlight-carering">CARERING</th>
                <th className="commercial-alt">OTHER APPS</th>
                <th className="commercial-alt">BASIC MAPS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Monthly Subscription Cost</td>
                <td className="highlight-carering"><strong>$0 (Free Forever)</strong></td>
                <td className="commercial-alt">$14.99 – $24.99 / mo</td>
                <td className="commercial-alt">$0</td>
              </tr>
              <tr>
                <td>Location Data Selling</td>
                <td className="highlight-carering"><strong>Strict Zero (Never Sold)</strong></td>
                <td className="commercial-alt">Brokered to insurers &amp; advertisers</td>
                <td className="commercial-alt">Monetized for targeted ads</td>
              </tr>
              <tr>
                <td>Geofenced Safe Places</td>
                <td className="highlight-carering"><strong>Unlimited Places</strong></td>
                <td className="commercial-alt">Locked to 2 on free tier</td>
                <td className="commercial-alt">No place arrival alerts</td>
              </tr>
              <tr>
                <td>Automatic Crash Detection &amp; SOS</td>
                <td className="highlight-carering"><strong>Included (Zero Paywall)</strong></td>
                <td className="commercial-alt">Requires $25/mo Gold/Platinum</td>
                <td className="commercial-alt">Not Available</td>
              </tr>
              <tr>
                <td>Location Route History</td>
                <td className="highlight-carering"><strong>30 Days Included</strong></td>
                <td className="commercial-alt">2 Days only on free tier</td>
                <td className="commercial-alt">Personal timeline only</td>
              </tr>
              <tr>
                <td>Ghost Mode Privacy Cloaking</td>
                <td className="highlight-carering"><strong>Yes (3 Privacy Levels)</strong></td>
                <td className="commercial-alt">Limited or locks circles</td>
                <td className="commercial-alt">All or nothing</td>
              </tr>
              <tr>
                <td>Self-Hosting Sovereignty</td>
                <td className="highlight-carering"><strong>Docker Compose Included</strong></td>
                <td className="commercial-alt">Impossible (Closed Cloud)</td>
                <td className="commercial-alt">Impossible (Proprietary)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Designed for Every Generation ─── */}
      <section className="generations-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Users size={14} style={{ color: 'var(--primary)' }} />
            <span>Loved by Everyone</span>
          </div>
          <h2 className="clean-heading">Designed for Every Generation</h2>
          <p className="clean-subheading">
            How CareRing creates comfort and harmony for every member of your family.
          </p>
        </div>

        <div className="generations-grid">
          <div className="generation-card">
            <div className="gen-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-light)', margin: '0 auto 16px' }}>
              <ShieldCheck size={24} />
            </div>
            <h3>For Parents</h3>
            <p>
              Total reassurance without constant texting. Know when kids reach school or return home from practice, and get alerted immediately if high-G crash deceleration is detected.
            </p>
            <div className="gen-highlight">Peace of mind, 24/7</div>
          </div>

          <div className="generation-card">
            <div className="gen-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7', width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(2, 132, 199, 0.12)', margin: '0 auto 16px' }}>
              <Compass size={24} />
            </div>
            <h3>For Teens</h3>
            <p>
              Independence without helicopter parenting. Ghost Mode lets you blur your location to a general neighborhood when hanging out with friends, avoiding invasive surveillance.
            </p>
            <div className="gen-highlight">Respects privacy &amp; autonomy</div>
          </div>

          <div className="generation-card">
            <div className="gen-emoji" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald)', width: '48px', height: '48px', borderRadius: '14px', background: 'var(--emerald-light)', margin: '0 auto 16px' }}>
              <Heart size={24} />
            </div>
            <h3>For Seniors &amp; Grandparents</h3>
            <p>
              Simple and reassuring. Large clear map pins, low battery alerts sent to family members, and an instant one-tap SOS siren if someone needs urgent assistance.
            </p>
            <div className="gen-highlight">Effortless safety in hand</div>
          </div>
        </div>
      </section>

      {/* ─── Interactive FAQ Accordion with Search & Categories ─── */}
      <FaqSection />

      {/* ─── Heroic Direct Download CTA Section with QR Code ─── */}
      <DownloadCta />
    </>
  );
}
