import React from "react";

export default function RootLoading() {
  return (
    <div className="skeleton-page-wrap">
      {/* Skeleton Navbar */}
      <div style={{
        width: "100%",
        maxWidth: "1200px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "48px",
        padding: "0 24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="skeleton-shimmer" style={{ width: 38, height: 38, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 110, height: 22, borderRadius: 6 }} />
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 18 }} />
          <div className="skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 18 }} />
        </div>
      </div>

      {/* Skeleton Hero */}
      <div style={{
        width: "100%",
        maxWidth: "760px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "18px",
        textAlign: "center"
      }}>
        <div className="skeleton-shimmer" style={{ width: 160, height: 28, borderRadius: 14 }} />
        <div className="skeleton-shimmer" style={{ width: "85%", height: 52, borderRadius: 12 }} />
        <div className="skeleton-shimmer" style={{ width: "65%", height: 48, borderRadius: 12 }} />
        <div className="skeleton-shimmer" style={{ width: "75%", height: 20, borderRadius: 8, marginTop: 8 }} />
        <div className="skeleton-shimmer" style={{ width: "55%", height: 20, borderRadius: 8 }} />

        {/* Buttons */}
        <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
          <div className="skeleton-shimmer" style={{ width: 180, height: 50, borderRadius: 25 }} />
          <div className="skeleton-shimmer" style={{ width: 180, height: 50, borderRadius: 25 }} />
        </div>
      </div>
    </div>
  );
}
