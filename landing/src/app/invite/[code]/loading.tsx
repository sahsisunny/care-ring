import React from "react";

export default function InviteLoading() {
  return (
    <main className="invite-page-wrapper">
      <header className="invite-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 100, height: 22, borderRadius: 6 }} />
        </div>
      </header>

      <section className="invite-hero-section">
        <div className="invite-card">
          <div className="skeleton-shimmer" style={{ width: 180, height: 26, borderRadius: 13, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ width: "80%", height: 36, borderRadius: 10, marginBottom: 12 }} />
          <div className="skeleton-shimmer" style={{ width: "95%", height: 16, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: "70%", height: 16, borderRadius: 6, marginBottom: 28 }} />

          {/* Digits box skeleton */}
          <div style={{
            background: "rgba(11, 16, 29, 0.7)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 16,
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
          }}>
            <div className="skeleton-shimmer" style={{ width: 130, height: 14, borderRadius: 6 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-shimmer" style={{ width: 44, height: 54, borderRadius: 10 }} />
              ))}
            </div>
            <div className="skeleton-shimmer" style={{ width: 140, height: 20, borderRadius: 10 }} />
          </div>

          {/* Action buttons skeleton */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="skeleton-shimmer" style={{ width: "100%", height: 50, borderRadius: 12 }} />
            <div className="skeleton-shimmer" style={{ width: "100%", height: 50, borderRadius: 12 }} />
          </div>
        </div>
      </section>
    </main>
  );
}
