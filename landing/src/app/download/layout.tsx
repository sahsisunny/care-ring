import type { Metadata } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.URL ||
  'https://care-ring.netlify.app';

export const metadata: Metadata = {
  title: 'Download CareRing APK v1.0.5 — Official Android Distribution',
  description:
    'Download the official CareRing APK v1.0.5 for Android. Sub-50ms real-time GPS family sync, automatic crash detection, unlimited geofenced safe places, and Ghost Mode with zero subscriptions.',
  keywords: [
    'download CareRing APK',
    'CareRing APK v1.0.5',
    'CareRing latest APK download',
    'CareRing Android APK',
    'free family safety APK',
    'open source family locator APK',
    'safe family GPS tracker APK',
  ],
  alternates: {
    canonical: `${SITE_URL}/download`,
  },
  openGraph: {
    title: 'Download CareRing APK v1.0.5 — Free Private Family GPS Tracker',
    description:
      'Download official CareRing APK v1.0.5 for Android. Free, private, open-source family radar with sub-50ms sync and crash detection.',
    url: `${SITE_URL}/download`,
    type: 'website',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Download CareRing APK v1.0.5',
      },
    ],
  },
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
