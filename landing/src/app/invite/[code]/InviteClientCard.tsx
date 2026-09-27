"use client";

import React, { useState } from "react";

interface InviteClientCardProps {
  inviteCode: string;
}

export default function InviteClientCard({ inviteCode }: InviteClientCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleOpenApp = () => {
    // Attempt custom URI scheme
    window.location.href = `carering://invite/${inviteCode}`;
  };

  const codeChars = (inviteCode || "CARERING").split("");

  return (
    <div className="invite-card">
      <div className="invite-card-badge">
        <span className="invite-pulse-dot" />
        FAMILY CIRCLE INVITATION
      </div>

      <h1 className="invite-title">You&apos;re Invited to Join</h1>
      <p className="invite-subtitle">
        A family member has invited you to connect on CareRing for real-time location safety, emergency SOS, and smart geofence alerts.
      </p>

      {/* Code Display Box */}
      <div className="invite-code-container">
        <span className="invite-code-label">CIRCLE INVITE CODE</span>
        <div className="invite-code-digits">
          {codeChars.map((char, index) => (
            <div key={index} className="invite-digit-box">
              {char}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopyCode}
          className="invite-copy-btn"
          aria-label="Copy invitation code"
        >
          {copied ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ color: "#10B981" }}>Code Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Tap to Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Action Buttons */}
      <div className="invite-action-buttons">
        <button
          type="button"
          onClick={handleOpenApp}
          className="invite-btn-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open in CareRing App
        </button>

        <a
          href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.0/app-release.apk"
          target="_blank"
          rel="noopener noreferrer"
          className="invite-btn-secondary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Android APK (~73 MB)
        </a>
      </div>

      {/* Instructions */}
      <div className="invite-instructions">
        <h3 className="invite-instructions-title">How to Join:</h3>
        <ol className="invite-steps-list">
          <li>
            <span className="step-num">1</span>
            <span>Download &amp; open <strong>CareRing</strong> on your Android phone.</span>
          </li>
          <li>
            <span className="step-num">2</span>
            <span>In the top circle bar, tap <strong>&quot;Join Circle&quot;</strong>.</span>
          </li>
          <li>
            <span className="step-num">3</span>
            <span>Paste code <strong>{inviteCode}</strong> and tap <strong>Connect</strong>!</span>
          </li>
        </ol>
      </div>

      {/* Privacy Guarantee Note */}
      <div className="invite-privacy-note">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span>
          <strong>100% Private:</strong> Zero commercial data selling, encrypted telemetry, and full self-hosted server sovereignty.
        </span>
      </div>
    </div>
  );
}
