import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadCta } from '@/components/DownloadCta';

export const metadata: Metadata = {
  title: 'CareRing Features Directory — 16 Private Safety Capabilities',
  description:
    'Explore CareRing comprehensive family safety capabilities: sub-50ms live radar, crash detection, unlimited geofences, 30-day history, and battery preserver.',
  keywords: [
    'CareRing features',
    'CareRing capabilities',
    'family safety features',
    'live family radar',
    'driving safety crash detection',
    'unlimited safe places',
    'Ghost Mode location',
    'free Life360 alternative features',
    'private GPS tracking features',
  ],
  alternates: {
    canonical: '/features',
  },
};

interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  category: string;
  tag: string;
  description: string;
  metrics: string[];
}

const ALL_FEATURES: FeatureCard[] = [
  {
    id: 'radar',
    icon: '📡',
    title: 'Live Family Radar',
    category: 'Location & Tracking',
    tag: 'Real-Time',
    description:
      'Continuous sub-50ms WebSocket streaming delivers instantaneous pin motion as members travel, walk, or commute without stuttering or manual pull-to-refresh.',
    metrics: ['Sub-50ms latency', 'Dual-ring radar waves', 'Auto-heading rotation'],
  },
  {
    id: 'driving',
    icon: '🏎️',
    title: 'Intelligent Driving Safety & Scores',
    category: 'Driving Telemetry',
    tag: 'Sensors Fusion',
    description:
      'Automated background trip detection calculates top speed, hard braking events, rapid accelerations, and phone distraction scores for every drive.',
    metrics: ['0–100 Driver Score', 'Hard brake g-force', 'Speeding alerts'],
  },
  {
    id: 'sos',
    icon: '🚨',
    title: 'Automated Crash Detection & SOS',
    category: 'Emergency Response',
    tag: 'Critical Safety',
    description:
      'High-frequency accelerometer motion fusion detects severe vehicular impacts (>3.5G) and immediately alerts circle members with exact GPS coordinates and audio siren.',
    metrics: ['Instant push alert', 'Automated SMS broadcast', 'Audio emergency siren'],
  },
  {
    id: 'geofences',
    icon: '🏡',
    title: 'Unlimited Geofenced Safe Places',
    category: 'Places & Geofencing',
    tag: 'Zero Paywalls',
    description:
      'Unlike commercial apps that restrict you to 2 places without a subscription, CareRing allows unlimited custom-radius geofences (Home, School, Work, Gym, Grandparents).',
    metrics: ['Unlimited places', 'Enter/exit notifications', 'Custom 50m–1000m radius'],
  },
  {
    id: 'ghost-mode',
    icon: '👻',
    title: 'Ghost Mode',
    category: 'Privacy Autonomy',
    tag: 'Patent-Free',
    description:
      'Maintain personal boundaries when needed. Cloak your exact coordinates into a blurred regional area or pause location broadcasting for a chosen duration with zero notifications to others.',
    metrics: ['Custom blur radius', 'Timed pause sharing', 'Instant uncloak toggle'],
  },
  {
    id: 'battery',
    icon: '🔋',
    title: 'Intelligent Battery Preserver',
    category: 'Performance',
    tag: '< 1% Drain / Hour',
    description:
      'Adaptive motion sensor gating throttles GPS polling when stationary and wakes up immediately when vehicular motion is detected, ensuring all-day battery life.',
    metrics: ['<1% battery drain/hr', 'Motion sensor gating', 'Low battery alerts (<15%)'],
  },
  {
    id: 'history',
    icon: '🗓️',
    title: '30-Day Complete Location History',
    category: 'Historical Trails',
    tag: 'Zero Subscriptions',
    description:
      'Replay any day, commute path, or travel route with speed timestamps, departure logs, and arrival confirmation completely free of charge.',
    metrics: ['30-day breadcrumbs', 'Route playback slider', 'Instant purge controls'],
  },
  {
    id: 'circles',
    icon: '👨‍👩‍👧‍👦',
    title: 'Multiple Family & Friend Circles',
    category: 'Organization',
    tag: 'Multi-Circle',
    description:
      'Create separate circles for Immediate Family, Close Friends, Hiking Buddies, or Neighborhood Watch with custom role-based administrative permissions.',
    metrics: ['6-character invite code', 'Admin / Member roles', 'Isolated circle boundaries'],
  },
  {
    id: 'maps',
    icon: '🗺️',
    title: 'Tri-Mode Dynamic Vector Maps',
    category: 'Map Experience',
    tag: 'Mapbox & OSM',
    description:
      'Switch between Dark Mode, Vivid Street View, and High-Resolution Satellite imagery with smooth 60fps vector rendering and tilt-compass orientation.',
    metrics: ['Dark & Satellite styles', 'Dynamic 3D tilt compass', 'Clustered member badges'],
  },
  {
    id: 'chat',
    icon: '💬',
    title: 'End-to-End Circle Safe Chat',
    category: 'Communication',
    tag: 'Instant Sync',
    description:
      'Direct messaging and location-anchored check-ins within your circle. Coordinates can be attached to messages for easy meeting-spot coordination.',
    metrics: ['Instant WSS delivery', 'Location check-in chips', 'Zero ad scraping'],
  },
  {
    id: 'offline',
    icon: '📶',
    title: 'Offline Telemetry Sync & Queue',
    category: 'Reliability',
    tag: 'Resilient',
    description:
      'When driving through cellular dead zones or tunnels, breadcrumbs are securely queued on-device and batch-synchronized immediately upon signal recovery.',
    metrics: ['Zero lost coordinates', 'SQLite local caching', 'Automatic backoff retry'],
  },
  {
    id: 'self-host',
    icon: '🛡️',
    title: 'Self-Hosted Sovereign Deployment',
    category: 'Infrastructure',
    tag: 'Open-Source',
    description:
      'Deploy your private CareRing server cluster with Docker Compose, PostgreSQL 16, PostGIS 3.4, and Caddy reverse proxy on any VPS (DigitalOcean, AWS, Linode).',
    metrics: ['One-command docker compose', '100% data isolation', 'Custom backend URL entry'],
  },
];

export default function FeaturesPage() {
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'CareRing Family Safety Features Directory',
    description: 'Comprehensive catalog of all 16 CareRing safety, telemetry, and privacy capabilities.',
    itemListElement: ALL_FEATURES.map((feat, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: feat.title,
      description: feat.description,
    })),
  };

  return (
    <div className="subpage-wrapper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <div className="subpage-hero">
        <h1 className="subpage-title">Every Feature. Zero Paywalls.</h1>
        <p className="subpage-desc">
          Commercial trackers charge $15 to $20/month for basic driving history and geofence alerts. CareRing provides an enterprise-grade safety suite completely free and open source.
        </p>
      </div>

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
                {feat.category}
              </span>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-highlight)', marginTop: '4px' }}>
                {feat.title}
              </h3>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {feat.description}
            </p>

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

      <DownloadCta />
    </div>
  );
}
