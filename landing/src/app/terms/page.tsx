import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms and Conditions — CareRing Safety Platform',
  description:
    'CareRing terms of service, acceptable use policies, mutual circle consent rules, and emergency SOS disclaimer.',
  keywords: [
    'CareRing terms of service',
    'CareRing terms and conditions',
    'mutual circle consent',
    'family safety app terms',
    'emergency SOS disclaimer',
  ],
  alternates: {
    canonical: '/terms',
  },
};

export default function TermsPage() {
  const termsSchema = {
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
            name: 'Terms and Conditions',
            item: 'https://care-ring.netlify.app/terms',
          },
        ],
      },
      {
        '@type': 'Article',
        headline: 'CareRing Terms of Service & Acceptable Use Policy',
        description: 'Terms governing usage of CareRing mobile application, circle mutual consent, telemetry, and emergency SOS.',
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
        mainEntityOfPage: 'https://care-ring.netlify.app/terms',
      },
    ],
  };

  return (
    <div className="simple-legal-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(termsSchema) }}
      />

      <header className="simple-legal-header">
        <h1 className="simple-legal-title">Terms &amp; Conditions</h1>
        <p className="simple-legal-meta">
          Last Updated: September 1, 2026 • Effective Worldwide
        </p>
      </header>

      <div className="simple-legal-body">
        <section id="acceptance" className="simple-legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By downloading, installing, accessing, or using the CareRing mobile application, software, or services (collectively, &ldquo;CareRing&rdquo;), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, do not install or use the application.
          </p>
        </section>

        <section id="mutual-consent" className="simple-legal-section">
          <h2>2. Mutual Consent &amp; Circle Participation</h2>
          <p>
            CareRing is built on the fundamental principle of mutual, transparent consent:
          </p>
          <ul>
            <li>Every individual in a CareRing Circle must willingly join using a unique invitation code.</li>
            <li>A visible status bar indicator or ongoing foreground notification is present on the device whenever background location tracking is active.</li>
            <li>Any member may revoke their location permissions, activate Ghost Mode, or leave a Circle at any time without administrative lockouts.</li>
          </ul>
        </section>

        <section id="prohibited" className="simple-legal-section">
          <h2>3. Prohibited Conduct &amp; Misuse</h2>
          <p>
            You agree not to use CareRing for:
          </p>
          <ul>
            <li>Stalking, harassment, intimidation, or covert surveillance of any individual without their explicit, informed consent.</li>
            <li>Installing CareRing on a device belonging to an adult without their full authorization.</li>
            <li>Attempting to bypass security restrictions, reverse engineer non-open-source components, inject malicious payloads, or disrupt server operations.</li>
          </ul>
        </section>

        <section id="emergency-sos" className="simple-legal-section">
          <h2>4. Emergency SOS &amp; Crash Detection Disclaimer</h2>
          <p>
            CareRing features an Emergency SOS broadcast and automated crash detection trigger designed to send high-priority push notifications and alerts to designated circle members and emergency contacts.
          </p>
          <p>
            <strong>Important notice:</strong> CareRing is an auxiliary coordination companion, not a certified public safety answering point (PSAP). It does not automatically dispatch municipal police, ambulance, or fire services. In life-threatening emergencies, always dial local emergency numbers (such as 911, 112, or 999) directly.
          </p>
          <ul>
            <li>Emergency alerts require active cellular or Wi-Fi data connectivity, sufficient battery power, and valid device permissions.</li>
            <li>We cannot guarantee notification delivery in cases of cellular network outages, device damage, or operating system battery optimizations.</li>
          </ul>
        </section>

        <section id="accuracy" className="simple-legal-section">
          <h2>5. Telemetry &amp; GPS Accuracy</h2>
          <p>
            Positioning accuracy depends on satellite visibility (GPS/GLONASS/Galileo), cellular network triangulation, Wi-Fi beacons, and device-level power management. Severe weather, high-rise urban canyons, underground transit, or aggressive Android battery optimization may cause temporary inaccuracies or delayed telemetry reporting.
          </p>
        </section>

        <section id="license" className="simple-legal-section">
          <h2>6. Open-Source MIT License</h2>
          <p>
            The CareRing codebase is open-source software licensed under the MIT License. You are free to inspect the source code, modify it, compile custom builds, and host your private instance subject to the standard MIT conditions.
          </p>
        </section>

        <section id="liability" className="simple-legal-section">
          <h2>7. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CARERING AND ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES RESULTING FROM DELAYED LOCATION REPORTING, CRASH DETECTION INACCURACIES, LOSS OF DEVICE CONNECTIVITY, OR UNAUTHORIZED ACCOUNT ACCESS.
          </p>
        </section>

        <section id="contact" className="simple-legal-section">
          <h2>8. Contact &amp; Questions</h2>
          <p>
            For questions regarding these Terms, open an issue on our GitHub repository at{' '}
            <a
              href="https://github.com/sahsisunny/care-ring"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/sahsisunny/care-ring
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
