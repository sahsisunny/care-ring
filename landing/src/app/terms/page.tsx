import type { Metadata } from 'next';
import Link from 'next/link';
import { DownloadCta } from '@/components/DownloadCta';
import { LegalTableOfContents, TocItem } from '@/components/LegalTableOfContents';

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

const TERMS_SECTIONS: TocItem[] = [
  { id: 'acceptance', title: 'Acceptance of Terms', number: '1.' },
  { id: 'mutual-consent', title: 'Mutual Consent & Circles', number: '2.' },
  { id: 'prohibited', title: 'Prohibited Misuse', number: '3.' },
  { id: 'emergency-sos', title: 'Emergency SOS Disclaimer', number: '4.' },
  { id: 'accuracy', title: 'Telemetry & GPS Accuracy', number: '5.' },
  { id: 'license', title: 'Open-Source MIT License', number: '6.' },
  { id: 'liability', title: 'Limitation of Liability', number: '7.' },
];

export default function TermsPage() {
  return (
    <div className="subpage-wrapper">
      <div className="subpage-hero">
        <h1 className="subpage-title">Terms &amp; Conditions</h1>
        <p className="subpage-desc">
          Please review the conditions governing your usage of the CareRing application and safety platform.
        </p>
        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Last Updated: September 2026 • Effective Worldwide
        </p>
      </div>

      <div className="legal-container">
        {/* Interactive Sticky Table of Contents (Desktop + Mobile) */}
        <LegalTableOfContents title="Terms Outline" items={TERMS_SECTIONS} />

        {/* Content body */}
        <div className="legal-content-card">
          <div className="legal-highlight-box warning">
            <span className="legal-box-icon">⚠️</span>
            <div className="legal-box-text">
              <h4>Important Safety Notice</h4>
              <p>
                CareRing is designed as a family peace-of-mind and coordination utility. It is not an officially certified emergency dispatch service and does not replace municipal 911/112 public emergency services.
              </p>
            </div>
          </div>

          <section id="acceptance" className="legal-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By installing the CareRing application, accessing our hosted service, or compiling from source code, you agree to be bound by these Terms and Conditions. If you disagree with any portion of these terms, you must discontinue using CareRing and uninstall the application.
            </p>
          </section>

          <section id="mutual-consent" className="legal-section">
            <h2>2. Mutual Consent &amp; Circle Participation</h2>
            <p>
              CareRing is built on the fundamental principle of <strong>mutual, transparent consent</strong>:
            </p>
            <ul>
              <li>Every individual in a CareRing Circle must willingly join using a unique 6-character invitation code.</li>
              <li>A visible status bar indicator or ongoing foreground notification is present on the device whenever background location tracking is active.</li>
              <li>Any member may revoke their location permissions, activate Ghost Mode, or leave a Circle at any time without administrative lockouts.</li>
            </ul>
          </section>

          <section id="prohibited" className="legal-section">
            <h2>3. Prohibited Conduct &amp; Misuse</h2>
            <p>
              You agree not to use CareRing for:
            </p>
            <ul>
              <li>Stalking, harassment, intimidation, or covert surveillance of any individual without their explicit, informed consent.</li>
              <li>Installing CareRing on a device belonging to an adult without their full authorization.</li>
              <li>Attempting to bypass security restrictions, inject malicious payloads, or flood server clusters with denial-of-service traffic.</li>
            </ul>
          </section>

          <section id="emergency-sos" className="legal-section">
            <h2>4. Emergency SOS &amp; Crash Detection Disclaimer</h2>
            <p>
              CareRing features an Emergency SOS broadcast and automated crash detection trigger designed to send high-priority push notifications and SMS alerts to designated circle members and emergency contacts.
            </p>
            <p>
              <strong>You acknowledge and understand:</strong>
            </p>
            <ul>
              <li>Emergency notifications require active cellular or Wi-Fi data connectivity, sufficient battery power, and valid device permissions.</li>
              <li>CareRing is not a certified public safety answering point (PSAP) and will not automatically dispatch local police, ambulance, or fire rescue unless configured through external webhooks by the circle administrator.</li>
              <li>Always dial local emergency numbers (e.g. 911, 112, 999) directly in urgent life-threatening emergencies.</li>
            </ul>
          </section>

          <section id="accuracy" className="legal-section">
            <h2>5. Telemetry &amp; GPS Accuracy</h2>
            <p>
              Positioning accuracy depends entirely on satellite visibility (GPS/GLONASS/Galileo), cellular network triangulation, Wi-Fi beacons, and device-level power management. Severe weather, high-rise urban canyons, subterranean transit, or aggressive Android battery optimization may cause temporary inaccuracies or delayed telemetry reporting.
            </p>
          </section>

          <section id="license" className="legal-section">
            <h2>6. Open-Source MIT License</h2>
            <p>
              The CareRing codebase is open-source software licensed under the MIT License. You are free to inspect the source code, modify it, compile custom builds, and host your private instance subject to the standard MIT conditions.
            </p>
          </section>

          <section id="liability" className="legal-section">
            <h2>7. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CARERING AND ITS CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES RESULTING FROM DELAYED LOCATION REPORTING, CRASH DETECTION INACCURACIES, LOSS OF DEVICE CONNECTIVITY, OR UNAUTHORIZED ACCOUNT ACCESS.
            </p>
          </section>
        </div>
      </div>

      <DownloadCta />
    </div>
  );
}
