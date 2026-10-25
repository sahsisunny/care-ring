'use client';

import React, { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: 'Is CareRing really 100% free with no monthly subscription?',
    answer:
      'Yes, absolutely. Commercial family safety apps charge $15 to $25 per month for driving logs and safe places. CareRing is an open-source platform licensed under the MIT License with zero subscription fees, zero paywalls, and zero locked features.',
  },
  {
    question: 'How does CareRing protect my family’s location data and privacy?',
    answer:
      'We have a strict zero-monetization pledge. CareRing never sells, licenses, or brokers your coordinates to insurance companies, advertising networks, or data aggregators. Telemetry is transmitted over secure encrypted WebSockets and is shared strictly within your private circle.',
  },
  {
    question: 'How do I install CareRing on my Android device?',
    answer:
      'Simply download the production-signed CareRing-latest.apk directly from this website or GitHub Releases. Open the downloaded file and tap "Install". No Google Play account or credit card required. Works on Android 8.0 through Android 15.',
  },
  {
    question: 'What is Ghost Mode and how does it work?',
    answer:
      'Ghost Mode gives every family member privacy autonomy. When activated, it either blurs your exact pin location to a generalized neighborhood radius or pauses location sharing for a chosen duration, giving you personal space without having to leave your family circle.',
  },
  {
    question: 'Does running real-time GPS tracking drain my phone battery?',
    answer:
      'CareRing is built with intelligent sensor fusion. Rather than constantly waking the high-power GPS radio, the app uses low-power accelerometer gating. When you are stationary at home or at work, GPS updates pause. GPS updates automatically resume the second motion or vehicular driving is detected, keeping battery drain below 1% per hour.',
  },
  {
    question: 'Can I host my own private CareRing server cluster?',
    answer:
      'Yes! For developers, tech-savvy families, or privacy purists who want 100% sovereign hosting, CareRing provides a one-command Docker Compose stack with PostgreSQL 16, PostGIS 3.4 spatial indexing, and WebSocket streaming. The mobile app has a built-in server switcher to point to your self-hosted domain.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq-section" id="faq">
      <div className="section-header-clean">
        <h2 className="clean-heading">Frequently Asked Questions</h2>
        <p className="clean-subheading">
          Everything you need to know about CareRing, family safety features, and privacy.
        </p>
      </div>

      <div className="faq-list">
        {FAQS.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={index} className={`faq-item ${isOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="faq-question-btn"
                onClick={() => toggleFaq(index)}
                aria-expanded={isOpen}
              >
                <span className="faq-question-text">{faq.question}</span>
                <span className="faq-icon-wrapper">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s ease',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </button>
              {isOpen && (
                <div className="faq-answer-content">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
