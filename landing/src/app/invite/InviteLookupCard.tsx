"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteLookupCard() {
  const [code, setCode] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) {
      router.push(`/invite/${clean}`);
    }
  };

  return (
    <div className="invite-card">
      <div className="invite-card-badge">
        <span className="invite-pulse-dot" />
        FAMILY CIRCLE ACCESS
      </div>

      <h1 className="invite-title">Enter Invite Code</h1>
      <p className="invite-subtitle">
        Enter the 6-character code shared by your family circle admin to view details and connect.
      </p>

      <form onSubmit={handleSubmit} className="invite-lookup-form">
        <div className="invite-input-wrap">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={10}
            className="invite-code-input"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={!code.trim()}
          className="invite-btn-primary"
          style={{ width: "100%", justifyContent: "center" }}
        >
          View Invitation &rarr;
        </button>
      </form>

      <div className="invite-action-buttons" style={{ marginTop: 24 }}>
        <a
          href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.0/app-release.apk"
          target="_blank"
          rel="noopener noreferrer"
          className="invite-btn-secondary"
          style={{ width: "100%" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Android APK (~73 MB)
        </a>
      </div>
    </div>
  );
}
