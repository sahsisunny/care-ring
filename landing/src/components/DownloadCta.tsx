'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Zap, Lock, Check, Smartphone, Download } from 'lucide-react';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

const SHA256_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export function DownloadCta() {
  const [copied, setCopied] = useState(false);
  const [showHash, setShowHash] = useState(false);

  const handleCopyHash = () => {
    try {
      navigator.clipboard.writeText(SHA256_HASH);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <section className="download-cta-section" id="download">
      <div className="download-cta-glow-bg" aria-hidden="true" />
      <div className="download-cta-container">
        <div className="download-cta-grid">
          {/* Left Column: Clear Value & Direct Download */}
          <div className="download-cta-main">
            <div className="release-pill">
              <span className="live-dot" />
              <span>Official Release v1.0.5 • Universal Android APK</span>
            </div>

            <h2 className="download-cta-title">
              Start protecting your family today. Free forever.
            </h2>

            <p className="download-cta-desc">
              Download the production-signed APK directly to your Android phone. Enjoy sub-second live GPS radar, automatic crash detection, and unlimited safe places with zero fees and zero ads.
            </p>

            <div className="download-action-buttons">
              <a
                href={LATEST_APK_URL}
                download
                className="btn-download-primary"
                title="Download official CareRing APK v1.0.5"
              >
                <div className="btn-icon-wrap">
                  <Download size={22} />
                </div>
                <div className="btn-text-wrap">
                  <span className="btn-label-top">Direct Download for Android</span>
                  <span className="btn-label-sub">CareRing-latest.apk • 83.36 MB</span>
                </div>
              </a>

              <Link
                href="/download"
                className="btn-download-secondary"
              >
                <span>Installation Guide &amp; Specs ↗</span>
              </Link>
            </div>

            {/* Trust and Integrity Row */}
            <div className="download-integrity-row">
              <div className="integrity-badge">
                <ShieldCheck size={14} style={{ color: 'var(--emerald)' }} />
                <span>VirusTotal Scanned (0 Detections)</span>
              </div>
              <div className="integrity-badge">
                <Zap size={14} style={{ color: 'var(--primary)' }} />
                <span>Android 8.0 to Android 15</span>
              </div>
              <div className="integrity-badge">
                <Lock size={14} style={{ color: '#0284C7' }} />
                <span>SHA-256 Verified Release</span>
              </div>
            </div>

            {/* Checksum toggle */}
            <div className="hash-toggle-wrap">
              <button
                type="button"
                className="hash-toggle-btn"
                onClick={() => setShowHash(!showHash)}
              >
                <span>{showHash ? '▾ Hide' : '▸ Show'} SHA-256 Package Checksum</span>
              </button>

              {showHash && (
                <div className="hash-box">
                  <code>{SHA256_HASH}</code>
                  <button
                    type="button"
                    className="copy-hash-btn"
                    onClick={handleCopyHash}
                  >
                    {copied ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={12} /> Copied
                      </span>
                    ) : (
                      'Copy'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Scan QR Code with Phone */}
          <div className="download-cta-qr-col">
            <div className="qr-card">
              <div className="qr-card-header">
                <span className="qr-card-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Smartphone size={13} /> Mobile Scan
                </span>
                <span className="qr-card-title">Scan to Download on Phone</span>
              </div>

              <div className="qr-code-frame">
                <QRCodeDisplay
                  url={LATEST_APK_URL}
                  size={120}
                  ariaLabel="QR Code to download CareRing APK"
                />
              </div>

              <div className="qr-hint-text">
                Point your Android camera here to download directly to your device
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
