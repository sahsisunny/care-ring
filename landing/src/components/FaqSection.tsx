import React from 'react';

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: 'What features are included in the CareRing Android APK?',
    answer:
      'The official CareRing APK (v1.0.5) includes a complete enterprise-grade family safety suite with zero paywalls: sub-50ms live GPS family radar, automated vehicular crash impact detection (>3.5G), unlimited custom-radius geofenced safe places, Ghost Mode location privacy cloaking, 30-day full route and speed history replay, driving safety scores (0–100), encrypted circle check-in chat, offline telemetry caching, and optional self-hosted server deployment.',
  },
  {
    question: 'Is CareRing really 100% free with no monthly subscription or hidden fees?',
    answer:
      'Yes, 100% free forever. Commercial family trackers like Life360 charge $14.99 to $24.99 per month for driving logs, crash response, and unlimited safe places. CareRing is an open-source MIT-licensed platform with zero subscriptions, zero in-app purchases, and zero feature paywalls.',
  },
  {
    question: 'How do I download and install the CareRing APK on Android?',
    answer:
      'Simply download the verified production-signed CareRing-latest.apk (83.36 MB) directly from our official download page or GitHub Releases. When prompted by Android security, open Settings and toggle on "Allow from this source" for your browser, then tap "Install". Compatible with Android 8.0 (Oreo) through Android 15 with zero Google Play account required.',
  },
  {
    question: 'Does the CareRing APK feature automatic crash detection and SOS alerts?',
    answer:
      'Yes. Using real-time high-G accelerometer and gyroscope sensor fusion, the CareRing APK monitors severe vehicular deceleration (>3.5G impact). In a collision, it instantly triggers an audible siren and broadcasts emergency alerts with exact GPS coordinates and navigation links to all circle members.',
  },
  {
    question: 'What is Ghost Mode and how does it protect my privacy in the APK?',
    answer:
      'Ghost Mode provides mutual privacy autonomy. Rather than forcing continuous surveillance, members can tap Ghost Mode to generalize their location to a randomized neighborhood area (blur radius) or pause broadcasting for a chosen duration (1h, 4h, 8h). No notifications are sent to others, maintaining healthy boundaries.',
  },
  {
    question: 'Does running the CareRing APK in the background drain my battery?',
    answer:
      'CareRing is engineered for ultra-low battery consumption (<1% drain per hour). It uses adaptive motion gating: when stationary at home, school, or work, high-power GPS polling sleeps. The moment accelerometer motion or vehicular driving begins, high-precision radar automatically wakes up.',
  },
  {
    question: 'How does CareRing protect family location data from data brokers?',
    answer:
      'CareRing enforces a strict Zero-Monetization Pledge. We never sell, broker, or license your location telemetry to insurance companies, advertising networks, or data brokers. All coordinate transmissions are protected via encrypted TLS 1.3 WebSockets strictly between your circle members.',
  },
  {
    question: 'Can I host my own private CareRing server cluster with Docker?',
    answer:
      'Yes. For developers and privacy-conscious families, CareRing provides a one-command Docker Compose stack featuring PostgreSQL 16, PostGIS 3.4 spatial indexes, and high-concurrency WebSocket streaming. The Android APK has a built-in server switcher to point to your private VPS domain.',
  },
];

export function FaqSection() {
  return (
    <section className="faq-section" id="faq" aria-labelledby="faq-heading">
      <div className="section-header-clean">
        <h2 id="faq-heading" className="clean-heading">
          Frequently Asked Questions
        </h2>
        <p className="clean-subheading">
          Everything you need to know about the CareRing APK, safety features, battery performance, and privacy.
        </p>
      </div>

      <div className="faq-list">
        {FAQS.map((faq, index) => (
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
  );
}
