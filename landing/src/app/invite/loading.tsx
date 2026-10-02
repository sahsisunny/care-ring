import React from "react";

export default function InviteLookupLoading() {
  return (
    <div className="skeleton-page-wrap">
      <div className="invite-card" style={{ maxWidth: 480 }}>
        <div className="skeleton-shimmer" style={{ width: 170, height: 26, borderRadius: 13, marginBottom: 16 }} />
        <div className="skeleton-shimmer" style={{ width: "70%", height: 32, borderRadius: 10, marginBottom: 12 }} />
        <div className="skeleton-shimmer" style={{ width: "90%", height: 16, borderRadius: 6, marginBottom: 28 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 54, borderRadius: 14, marginBottom: 18 }} />
        <div className="skeleton-shimmer" style={{ width: "100%", height: 50, borderRadius: 12 }} />
      </div>
    </div>
  );
}
