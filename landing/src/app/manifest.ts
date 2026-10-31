import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CareRing — Free Private Family GPS Tracker & Radar',
    short_name: 'CareRing',
    description:
      'Real-time family GPS radar, automatic vehicular crash detection, unlimited geofenced safe places, and Ghost Mode with zero subscriptions and zero ads.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070A12',
    theme_color: '#070A12',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
