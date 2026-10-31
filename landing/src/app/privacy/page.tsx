import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacy Policy & Zero-Broker Security Pledge',
  description:
    'CareRing is engineered with a strict zero-data-monetization policy. Your location, driving telemetry, and family circles remain 100% private.',
  keywords: [
    'CareRing privacy policy',
    'zero data brokering',
    'private location tracker',
    'location data security',
    'family privacy manifesto',
    'Ghost Mode privacy',
  ],
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  const privacySchema = {
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
            name: 'Privacy Policy',
            item: 'https://care-ring.netlify.app/privacy',
          },
        ],
      },
      {
        '@type': 'Article',
        headline: 'CareRing Privacy Policy & Zero-Broker Security Pledge',
        description: 'CareRing zero-data-monetization manifesto and privacy policy governing telemetry and family circle location data.',
        datePublished: '2026-09-01T00:00:00Z',
        dateModified: '2026-09-01T00:00:00Z',
        author: {
          '@type': 'Person',
          name: 'Sunny Sahsi',
          url: 'https://github.com/sahsisunny',
        },
        publisher: {
          '@type': 'Organization',
          name: 'CareRing Open Source',
          url: 'https://care-ring.netlify.app',
        },
        mainEntityOfPage: 'https://care-ring.netlify.app/privacy',
      },
    ],
  };

  return (
    <div className="simple-legal-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(privacySchema) }}
      />

      <header className="simple-legal-header">
        <h1 className="simple-legal-title">Privacy Policy</h1>
        <p className="simple-legal-meta">
          Last Updated: September 1, 2026 • Effective Worldwide
        </p>
      </header>

      <div className="simple-legal-body">
        <section id="zero-broker" className="simple-legal-section">
          <h2>1. Zero Commercial Data Brokering</h2>
          <p>
            CareRing is built on a straightforward promise: <strong>We do not sell, rent, monetize, or broker your location data. Ever.</strong>
          </p>
          <p>
            Unlike commercial family tracking applications that sell aggregated commute paths and driving habits to insurance companies and ad brokers, CareRing is 100% open-source software distributed under the permissive MIT license.
          </p>
          <p>
            Our software contains zero third-party advertisement trackers, zero behavioral profiling SDKs, and zero background analytics libraries.
          </p>
        </section>

        <section id="telemetry" className="simple-legal-section">
          <h2>2. Telemetry We Collect &amp; Store</h2>
          <p>
            To provide live family radar, geofence enter/exit notifications, and emergency crash response, CareRing processes the following telemetry with your explicit, operating-system-level permission:
          </p>
          <ul>
            <li>
              <strong>GPS &amp; Positioning:</strong> Latitude, longitude, altitude, bearing, and GPS accuracy radius.
            </li>
            <li>
              <strong>Motion &amp; Velocity:</strong> Real-time speed and accelerometer telemetry to detect potential collisions and vehicular travel.
            </li>
            <li>
              <strong>Device State:</strong> Battery level, charging status, and network connectivity state to notify family members when a device is running low.
            </li>
            <li>
              <strong>Account Credentials:</strong> Name, optional avatar photo, and OAuth identifier (Apple Sign-In or Google OAuth) to authenticate your access to your designated circles.
            </li>
          </ul>
        </section>

        <section id="ghost-mode" className="simple-legal-section">
          <h2>3. Ghost Mode (Location Cloaking)</h2>
          <p>
            CareRing believes privacy should be accessible without disabling safety tools entirely. Activating Ghost Mode allows you to maintain personal boundaries whenever you need temporary privacy:
          </p>
          <ul>
            <li>
              <strong>Approximate Cloaking:</strong> Obscures your exact street coordinates into a generalized neighborhood radius (500m to 8km). Circle members only see your approximate area rather than your precise street address.
            </li>
            <li>
              <strong>Zero Notifications to Others:</strong> Circle members are never notified that you entered Ghost Mode, and no badge or indicator is shown on your avatar to others.
            </li>
            <li>
              <strong>Customizable Duration:</strong> Set Ghost Mode for 30 minutes, 2 hours, until midnight, or until manually deactivated with a single tap.
            </li>
          </ul>
        </section>

        <section id="encryption" className="simple-legal-section">
          <h2>4. Encryption &amp; Server Storage</h2>
          <p>
            All location updates sent between the CareRing mobile application and the backend cluster are encrypted in transit using industry-standard Transport Layer Security (TLS 1.3 / WSS). Data stored within PostgreSQL 16 is protected with database encryption at rest.
          </p>
        </section>

        <section id="erasure" className="simple-legal-section">
          <h2>5. Immediate Right to Erasure (Zero-Retention Deletion)</h2>
          <p>
            You maintain complete ownership of your location trail. From the CareRing mobile app settings, you may:
          </p>
          <ul>
            <li>Purge your 30-day location breadcrumbs and driving history at any time with a single tap.</li>
            <li>Permanently delete your account, removing all associated profile data, circle memberships, and sensor logs instantaneously from the database.</li>
          </ul>
        </section>

        <section id="self-host" className="simple-legal-section">
          <h2>6. Self-Hosted Server Isolation</h2>
          <p>
            For users demanding total infrastructure sovereignty, the entire CareRing backend stack (Node.js, PostgreSQL with PostGIS, and WebSockets) is open source and can be self-hosted via Docker Compose.
          </p>
          <p>
            When running a self-hosted instance, 100% of your location data flows exclusively through your private server or virtual private cloud (VPC), completely bypassing any external cloud infrastructure.
          </p>
        </section>

        <section id="contact" className="simple-legal-section">
          <h2>7. Contact &amp; Maintainer</h2>
          <p>
            If you have any questions, vulnerability reports, or data inquiries regarding this Privacy Policy, please reach out directly:
          </p>
          <ul>
            <li>Maintainer: <strong>Sunny Sahsi</strong></li>
            <li>
              Repository:{' '}
              <a
                href="https://github.com/sahsisunny/care-ring"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/sahsisunny/care-ring
              </a>
            </li>
            <li>
              Issues &amp; Disclosures:{' '}
              <a
                href="https://github.com/sahsisunny/care-ring/issues"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/sahsisunny/care-ring/issues
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
