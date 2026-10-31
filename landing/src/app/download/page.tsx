'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Smartphone,
  Zap,
  ShieldCheck,
  Lock,
  Check,
  FileText,
  Download,
  Users,
  Server,
  History,
} from 'lucide-react';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { QrCardActions } from '@/components/QrCardActions';

export const LATEST_APK_URL =
  'https://github.com/sahsisunny/care-ring/releases/download/v1.0.5/CareRing-latest.apk';

const SHA256_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export default function DownloadPage() {
  const [copiedHash, setCopiedHash] = useState(false);

  const handleCopyHash = () => {
    try {
      navigator.clipboard.writeText(SHA256_HASH);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <main className="download-hub-wrapper">
      {/* Hero Header */}
      <div className="subpage-hero">
        <div className="hub-badge-pill">
          <span className="live-dot" />
          <span>Official Distribution Mirror • Direct APK</span>
        </div>
        <h1 className="subpage-title">Download CareRing APK</h1>
        <p className="subpage-desc">
          Get the official release package for Android. Fast, private, verified with zero third-party ads or spyware.
        </p>
      </div>

      {/* Main Download Showcase Grid */}
      <div className="download-hub-grid">
        <div className="download-hub-card">
          <div className="hub-card-left">
            <div className="hub-release-badge">
              <span className="hub-badge-dot" />
              <span>Version 1.0.5 (Build 105) • Production Signed</span>
            </div>

            <h2 className="hub-card-title">CareRing-latest.apk</h2>

            <div className="hub-specs-pills">
              <span className="spec-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Package size={13} />
                <span>83.36 MB</span>
              </span>
              <span className="spec-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Smartphone size={13} />
                <span>Android 8.0 – 15+</span>
              </span>
              <span className="spec-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Zap size={13} />
                <span>Universal (ARM64 / ARMv7 / x86)</span>
              </span>
            </div>

            <p className="hub-card-text">
              Direct official release package with all 12 capabilities included: sub-second live family radar, automatic crash detection, unlimited safe places, and Ghost Mode.
            </p>

            <div className="hub-action-buttons">
              <a
                href={LATEST_APK_URL}
                download
                className="btn-download-primary hub-btn"
                title="Download official CareRing APK v1.0.5"
              >
                <div className="btn-icon-wrap">
                  <Download size={24} />
                </div>
                <div className="btn-text-wrap">
                  <span className="btn-label-top">Download CareRing APK (83.36 MB)</span>
                  <span className="btn-label-sub">Direct high-speed mirror via GitHub Releases</span>
                </div>
              </a>

              <a
                href="https://github.com/sahsisunny/care-ring/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <span>View All GitHub Releases ↗</span>
              </a>
            </div>

            {/* Checksum & VirusTotal Row */}
            <div className="hub-security-row">
              <div className="security-item">
                <span className="sec-icon" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--emerald)' }}>
                  <ShieldCheck size={15} />
                </span>
                <span>VirusTotal Scanned (0 / 72 Detections)</span>
              </div>
              <div className="security-item">
                <span className="sec-icon" style={{ display: 'inline-flex', alignItems: 'center', color: '#0284C7' }}>
                  <Lock size={15} />
                </span>
                <span>SHA-256 Checksum:</span>
                <code className="sec-hash">{SHA256_HASH.slice(0, 16)}...</code>
                <button
                  type="button"
                  className="copy-mini-btn"
                  onClick={handleCopyHash}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {copiedHash ? (
                    <>
                      <Check size={11} />
                      <span>Copied</span>
                    </>
                  ) : (
                    'Copy Full Hash'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Hub Right Column: Scan with Phone */}
          <div className="hub-card-right">
            <div className="qr-container-box">
              <div className="qr-badge" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                <Smartphone size={13} />
                <span>Scan with Camera to Install</span>
              </div>

              <div className="qr-frame">
                <QRCodeDisplay
                  url={LATEST_APK_URL}
                  size={140}
                  ariaLabel="QR Code to download CareRing APK"
                />
              </div>

              <div className="qr-subtext">
                <span>Point your phone camera to download directly to your device</span>
              </div>

              <QrCardActions
                url={LATEST_APK_URL}
                title="CareRing"
                subtitle="Private Family GPS Radar & Safety"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3-Step Visual Installation Guide */}
      <section className="download-guide-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} style={{ color: 'var(--primary)' }} />
            <span>Easy 30-Second Setup</span>
          </div>
          <h2 className="clean-heading">How to Install on Android</h2>
          <p className="clean-subheading">
            Installing an official APK directly is safe, easy, and requires zero Google Play account.
          </p>
        </div>

        <div className="install-steps-grid">
          <div className="install-step-card">
            <div className="install-step-badge">Step 1</div>
            <div className="install-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Download size={24} />
            </div>
            <h3>Download APK</h3>
            <p>
              Tap the download button above or scan the QR code with your camera. When browser says &quot;File might be harmful&quot;, tap <strong>Download anyway</strong> (this is Android&apos;s standard notice for apps outside Google Play).
            </p>
          </div>

          <div className="install-step-card">
            <div className="install-step-badge">Step 2</div>
            <div className="install-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284C7' }}>
              <ShieldCheck size={24} />
            </div>
            <h3>Allow Installation</h3>
            <p>
              Open the downloaded file. If your browser asks for permission, tap <strong>Settings</strong> and toggle on <strong>Allow from this source</strong>, then tap <strong>Install</strong>.
            </p>
          </div>

          <div className="install-step-card">
            <div className="install-step-badge">Step 3</div>
            <div className="install-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald)' }}>
              <Users size={24} />
            </div>
            <h3>Create Your Circle</h3>
            <p>
              Launch CareRing, enter your name, and generate your private 6-letter invite code. Send it to family members and start staying safe together!
            </p>
          </div>
        </div>
      </section>

      {/* Device Compatibility Specs Table */}
      <section className="download-specs-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Server size={14} style={{ color: 'var(--emerald)' }} />
            <span>Technical Specifications</span>
          </div>
          <h2 className="clean-heading">Compatibility &amp; System Specs</h2>
          <p className="clean-subheading">
            Engineered to run seamlessly on virtually every Android device worldwide.
          </p>
        </div>

        <div className="specs-table-wrapper">
          <table className="comparison-table-clean">
            <tbody>
              <tr>
                <td><strong>Package Name</strong></td>
                <td><code>com.carering.app</code></td>
              </tr>
              <tr>
                <td><strong>Target Android Version</strong></td>
                <td>Android 8.0 Oreo (API 26) through Android 15 (Vanilla Ice Cream)</td>
              </tr>
              <tr>
                <td><strong>Architectures</strong></td>
                <td>Universal Fat Binary: <code>arm64-v8a</code>, <code>armeabi-v7a</code>, <code>x86_64</code></td>
              </tr>
              <tr>
                <td><strong>APK File Size</strong></td>
                <td>83.36 MB (Compressed Signed Release)</td>
              </tr>
              <tr>
                <td><strong>Signing Keystore</strong></td>
                <td>v1 (JAR Signature) + v2 (APK Signature Scheme v2)</td>
              </tr>
              <tr>
                <td><strong>Permissions Required</strong></td>
                <td>Location (Fine &amp; Coarse), Background Location, Physical Activity (Motion Sensors)</td>
              </tr>
              <tr>
                <td><strong>Permissions Excluded</strong></td>
                <td>Zero Contacts access, Zero Microphone, Zero Camera, Zero SMS reading</td>
              </tr>
              <tr>
                <td><strong>Telemetry Protocol</strong></td>
                <td>WSS (Encrypted WebSockets) over TLS 1.3 with sub-50ms heartbeat sync</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Release Changelog */}
      <section className="download-changelog-section">
        <div className="section-header-clean">
          <div className="clean-pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <History size={14} style={{ color: 'var(--primary)' }} />
            <span>Release History</span>
          </div>
          <h2 className="clean-heading">Changelog &amp; Updates</h2>
        </div>

        <div className="changelog-list">
          <div className="changelog-item">
            <div className="changelog-meta">
              <span className="changelog-ver">v1.0.5 (Latest)</span>
              <span className="changelog-date">Production Release</span>
            </div>
            <ul className="changelog-bullets">
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Added sub-second live family radar with fluid motion rendering
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Added 3-level Ghost Mode privacy cloaking (Precise, Blurred, Frozen)
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Upgraded automatic collision detection sensor fusion (&gt;3.5G impact)
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Added unlimited custom-radius safe places with arrival/departure notifications
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Reduced background battery consumption to under 1% per hour
              </li>
            </ul>
          </div>

          <div className="changelog-item">
            <div className="changelog-meta">
              <span className="changelog-ver">v1.0.4</span>
              <span className="changelog-date">Maintenance Release</span>
            </div>
            <ul className="changelog-bullets">
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Added algorithmic 0–100 Driver Safety Scores
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Added offline coordinate caching when in subway or low-signal areas
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Added one-tap coordinate check-in pins in circle chat
              </li>
            </ul>
          </div>

          <div className="changelog-item">
            <div className="changelog-meta">
              <span className="changelog-ver">v1.0.0</span>
              <span className="changelog-date">Initial Open Source Launch</span>
            </div>
            <ul className="changelog-bullets">
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Initial MIT-licensed open-source release
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Private 6-letter circle invite system
              </li>
              <li>
                <Check size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--emerald)', verticalAlign: '-1px' }} />
                Self-hostable Docker Compose server cluster
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
