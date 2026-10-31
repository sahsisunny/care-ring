import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadCta } from '@/components/DownloadCta';
import { FeaturesClientView } from '@/components/FeaturesClientView';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'CareRing Features — All 12 Capabilities Included 100% Free',
  description:
    'Explore the complete CareRing Android APK features directory: sub-second live GPS radar, automatic crash detection, unlimited geofenced safe places, Ghost Mode, and 30-day location trails. 100% free with zero paywalls.',
  keywords: [
    'CareRing features',
    'CareRing APK features',
    'CareRing capabilities',
    'free family tracker features',
    'live family GPS radar',
    'crash detection APK free',
    'unlimited safe places geofencing',
    'Ghost Mode privacy GPS',
    'battery optimized family tracker',
    'open source family safety',
  ],
  alternates: {
    canonical: '/features',
  },
  openGraph: {
    title: 'CareRing Features — All 12 Capabilities Included 100% Free',
    description:
      'Every feature unlocked in the official CareRing Android APK: real-time radar, crash detection, unlimited safe zones, and Ghost Mode. Zero subscriptions, zero paywalls.',
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
    title: 'CareRing Features — All 12 Capabilities Included 100% Free',
    description:
      'Every feature unlocked in the official CareRing Android APK. Zero subscriptions, zero paywalls.',
    images: ['/og-image.jpg'],
  },
};

export default function FeaturesPage() {
  const jsonLd = {
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
            name: 'Features',
            item: 'https://care-ring.netlify.app/features',
          },
        ],
      },
      {
        '@type': 'CollectionPage',
        name: 'CareRing Features & Capabilities Catalog',
        description:
          'Comprehensive directory of all 12 family safety tools included 100% free in the CareRing Android APK.',
        url: 'https://care-ring.netlify.app/features',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="features-page-wrapper">
        {/* Features Header */}
        <section className="features-hero-section">
          <div className="section-header-clean">
            <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} style={{ color: 'var(--amber)' }} />
              <span>100% Unlocked • Zero Subscriptions</span>
            </div>

            <h1 className="clean-heading">
              Everything Your Family Needs to Stay Safe &amp; Connected
            </h1>

            <p className="clean-subheading">
              Commercial apps lock basic safety like crash detection and safe places behind expensive monthly paywalls. With CareRing, every capability is completely free forever.
            </p>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/download" className="btn-primary">
                <span>Download Free APK (v1.0.5) ↓</span>
              </Link>
              <Link href="/#calculator" className="btn-secondary">
                <span>Calculate Family Savings →</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Interactive Features Search & Grid */}
        <section className="features-list-section">
          <FeaturesClientView />
        </section>

        {/* Bottom Download CTA */}
        <DownloadCta />
      </main>
    </>
  );
}
