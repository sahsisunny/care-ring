import Image from "next/image";

export default function Home() {
  return (
    <main>
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-pill-badge">
          <span>✨ 100% Free &amp; Open-Source</span>
          <span>•</span>
          <span>Zero Data Brokers</span>
          <span>•</span>
          <span>End-to-End Privacy</span>
        </div>

        <h1 className="hero-heading">
          Keep Your Family Safe,{" "}
          <span className="gradient-text">Without Selling Your Location</span>
        </h1>

        <p className="hero-subtitle">
          The modern, privacy-first open-source alternative to Life360. Real-time
          GPS telemetry, circular geofences, battery &amp; driving alerts, and
          sub-second WebSocket sync — with zero monthly subscriptions.
        </p>

        <div className="hero-cta-group">
          <a
            href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.0/app-release.apk"
            className="btn-primary"
            style={{ fontSize: "16px", padding: "14px 28px" }}
            download
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download APK v1.0.0</span>
          </a>

          <a
            href="https://github.com/sahsisunny/care-ring"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ fontSize: "16px", padding: "14px 24px" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>Star on GitHub</span>
          </a>
        </div>

        <div className="hero-meta-badges">
          <div className="hero-meta-item">
            <span style={{ color: "var(--emerald)" }}>⚡</span>
            <span>Sub-second sync via WebSockets</span>
          </div>
          <div className="hero-meta-item">
            <span style={{ color: "var(--cyan)" }}>🛡️</span>
            <span>TLS 1.3 &amp; AES-256 Wire Encryption</span>
          </div>
          <div className="hero-meta-item">
            <span style={{ color: "var(--amber)" }}>🔋</span>
            <span>Adaptive Motion Battery Engine</span>
          </div>
          <div className="hero-meta-item">
            <span style={{ color: "var(--coral)" }}>🚫</span>
            <span>No data brokers or tracking SDKs</span>
          </div>
        </div>

        {/* Hero Interactive Visual Mockup */}
        <div className="mockup-container">
          <div className="mockup-header">
            <div className="mockup-window-dots">
              <span className="mockup-dot dot-red" />
              <span className="mockup-dot dot-yellow" />
              <span className="mockup-dot dot-green" />
            </div>
            <div className="mockup-status-center">
              <span>Circle: <strong>Family Primary</strong> (4 Active Devices)</span>
            </div>
            <div className="live-pill" style={{ padding: "3px 9px", fontSize: "11px" }}>
              <span className="live-dot" />
              <span>Streaming</span>
            </div>
          </div>

          <div className="mockup-grid">
            {/* Live Radar Map Visualization */}
            <div className="map-radar-card">
              <div className="radar-ring ring-cyan" />
              <div className="radar-ring ring-coral" />
              
              <div className="center-marker-hero">
                <div className="avatar-halo">
                  <Image
                    src="/icon.png"
                    alt="CareRing Pin Marker"
                    width={56}
                    height={56}
                    className="avatar-inner-img"
                  />
                </div>
                <div className="marker-name-tag">
                  <span>Sunny (You)</span>
                  <span className="speed-tag">• 42 km/h</span>
                </div>
              </div>

              {/* Floating pill overlays on simulated map */}
              <div
                style={{
                  position: "absolute",
                  top: "24px",
                  left: "24px",
                  background: "rgba(11, 16, 29, 0.88)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>📍 Safe Zone:</span>
                <span style={{ color: "var(--emerald)" }}>Oakridge School</span>
              </div>

              <div
                style={{
                  position: "absolute",
                  bottom: "24px",
                  right: "24px",
                  background: "rgba(11, 16, 29, 0.88)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Alex:</span>
                <span style={{ color: "var(--amber)" }}>Battery 18% ⚡</span>
              </div>
            </div>

            {/* Live Telemetry Stream Feed */}
            <div className="telemetry-feed">
              <div className="telemetry-item-card">
                <div className="telemetry-icon-box icon-emerald">
                  <span>📍</span>
                </div>
                <div className="telemetry-info">
                  <h4>Geofence Arrival Triggered</h4>
                  <p>Sunny entered <strong>Home (Safe Zone)</strong>. Radius 150m boundary crossed smoothly.</p>
                </div>
              </div>

              <div className="telemetry-item-card">
                <div className="telemetry-icon-box icon-blue">
                  <span>🚗</span>
                </div>
                <div className="telemetry-info">
                  <h4>Driving Telemetry Active</h4>
                  <p>Vehicle motion detected at <strong>42 km/h</strong> on Grand Ave. Smooth cruising detected.</p>
                </div>
              </div>

              <div className="telemetry-item-card">
                <div className="telemetry-icon-box icon-amber">
                  <span>⚡</span>
                </div>
                <div className="telemetry-info">
                  <h4>Smart Battery Alert</h4>
                  <p>Alex phone battery reached <strong>18%</strong>. Gentle notification dispatched to circle.</p>
                </div>
              </div>

              <div className="telemetry-item-card">
                <div
                  className="telemetry-icon-box"
                  style={{ background: "rgba(239, 68, 68, 0.15)", color: "#F87171" }}
                >
                  <span>🚨</span>
                </div>
                <div className="telemetry-info">
                  <h4>Emergency SOS Armed</h4>
                  <p>Circle SOS standby active. Triple-tap volume broadcast ready with location burst.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CLOUD INFRASTRUCTURE STATUS BANNER */}
      <section className="cloud-banner-section">
        <div className="cloud-banner">
          <div className="cloud-banner-left">
            <div className="cloud-status-badge">
              <span className="live-dot" />
              <span>LIVE CLOUD API</span>
            </div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 700 }}>
                Official Hosted Node.js &amp; MongoDB Cluster Online
              </p>
              <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Endpoint: <code>https://care-ring.onrender.com</code> • Ready for instant circle connections
              </p>
            </div>
          </div>

          <div className="cloud-stats-group">
            <div className="cloud-stat-item">
              <span className="stat-label">Response Time</span>
              <span className="stat-val" style={{ color: "var(--emerald)" }}>~45ms</span>
            </div>
            <div className="cloud-stat-item">
              <span className="stat-label">Protocol</span>
              <span className="stat-val" style={{ color: "var(--cyan)" }}>WSS / TLS 1.3</span>
            </div>
            <div className="cloud-stat-item">
              <span className="stat-label">Architecture</span>
              <span className="stat-val">Self-Hostable</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES GRID */}
      <section id="features" className="features-section">
        <div className="section-label">Engineered For Modern Families</div>
        <h2 className="section-title">Everything You Need for Total Peace of Mind</h2>
        <p className="section-subtitle">
          Built from the ground up to provide high-fidelity family safety telemetry
          without invasive data-harvesting or predatory subscriptions.
        </p>

        <div className="features-grid">
          {/* Feature 1 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "var(--cyan)" }}>
              🛰️
            </div>
            <h3 className="feature-card-title">Real-Time GPS Telemetry</h3>
            <p className="feature-card-desc">
              Broadcasts precise coordinates across circle members using persistent
              low-latency WebSocket channels. Sub-second location updates keep you
              connected when it matters most.
            </p>
            <span className="feature-badge-pill">Persistent WSS</span>
          </div>

          {/* Feature 2 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "var(--emerald)" }}>
              🛡️
            </div>
            <h3 className="feature-card-title">Zero Data Selling</h3>
            <p className="feature-card-desc">
              Commercial alternatives sell location pings to advertising and insurance brokers.
              CareRing is 100% open source: your coordinates belong solely to your private circle.
            </p>
            <span className="feature-badge-pill">Private By Design</span>
          </div>

          {/* Feature 3 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "var(--coral)" }}>
              📍
            </div>
            <h3 className="feature-card-title">Smart Geofence Safe Zones</h3>
            <p className="feature-card-desc">
              Configure custom circular zones for Home, School, Office, or Sports. Receive instant,
              reliable push triggers when members enter or leave designated safe perimeters.
            </p>
            <span className="feature-badge-pill">Custom Radii</span>
          </div>

          {/* Feature 4 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "var(--amber)" }}>
              🔋
            </div>
            <h3 className="feature-card-title">Adaptive Battery Engine</h3>
            <p className="feature-card-desc">
              Combines accelerometer, activity recognition, and geofencing to suspend GPS polling
              while stationary. Enjoy all-day real-time tracking with under 3% daily battery impact.
            </p>
            <span className="feature-badge-pill">&lt; 3% Battery / Day</span>
          </div>

          {/* Feature 5 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#A855F7" }}>
              🚗
            </div>
            <h3 className="feature-card-title">Driving &amp; Speed Telemetry</h3>
            <p className="feature-card-desc">
              Detects vehicle speed and motion automatically. Know when family members are driving,
              cycling, walking, or stationary with live speed gauges and event timelines.
            </p>
            <span className="feature-badge-pill">Live Speedometers</span>
          </div>

          {/* Feature 6 */}
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#38BDF8" }}>
              🐳
            </div>
            <h3 className="feature-card-title">Self-Hostable with Docker</h3>
            <p className="feature-card-desc">
              Complete freedom over your infrastructure. Deploy your own backend on Docker,
              Render, AWS, or a home Raspberry Pi with one command, or use our free hosted cloud.
            </p>
            <span className="feature-badge-pill">Docker Ready</span>
          </div>
        </div>
      </section>

      {/* 4. CARERING VS LIFE360 COMPARISON */}
      <section id="comparison" className="comparison-section">
        <div style={{ textAlign: "center" }}>
          <div className="section-label">Honest Comparison</div>
          <h2 className="section-title">CareRing vs. Commercial Alternatives</h2>
          <p className="section-subtitle">
            See why privacy-conscious families and engineers are switching to CareRing.
          </p>
        </div>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="col-feature">Feature / Attribute</th>
                <th className="col-carering">CareRing (Open Source)</th>
                <th className="col-life360">Life360 &amp; Commercial Apps</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-feature">Monthly Subscription Cost</td>
                <td className="col-carering">100% Free Forever ($0)</td>
                <td className="col-life360">$4.99 to $24.99 / month</td>
              </tr>
              <tr>
                <td className="col-feature">Data Privacy &amp; Broker Policy</td>
                <td className="col-carering">Zero data sales. No ad SDKs.</td>
                <td className="col-life360">Monetizes location to data brokers</td>
              </tr>
              <tr>
                <td className="col-feature">Source Code Transparency</td>
                <td className="col-carering">100% Public MIT on GitHub</td>
                <td className="col-life360">Proprietary closed-source code</td>
              </tr>
              <tr>
                <td className="col-feature">Self-Hosting Option</td>
                <td className="col-carering">Yes — Docker, VPS, or Raspberry Pi</td>
                <td className="col-life360">Impossible (Locked cloud)</td>
              </tr>
              <tr>
                <td className="col-feature">Real-Time Refresh Rate</td>
                <td className="col-carering">Sub-second over WebSocket</td>
                <td className="col-life360">Throttled on free tiers</td>
              </tr>
              <tr>
                <td className="col-feature">Battery Efficiency</td>
                <td className="col-carering">Adaptive motion throttle engine</td>
                <td className="col-life360">Known heavy background drain</td>
              </tr>
              <tr>
                <td className="col-feature">In-App Advertising &amp; Upsells</td>
                <td className="col-carering">0% Ads, 100% clean UI</td>
                <td className="col-life360">Constant upsells and insurance ads</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. ARCHITECTURE & SECURITY */}
      <section id="architecture" className="features-section" style={{ paddingTop: "20px" }}>
        <div className="section-label">Behind The Scenes</div>
        <h2 className="section-title">Built with Modern, Battle-Tested Tech</h2>
        <p className="section-subtitle">
          Designed for high concurrency, low latency, and zero telemetry leaks.
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <h3 className="feature-card-title">📱 Mobile Client</h3>
            <p className="feature-card-desc">
              React Native 0.81, Expo 54, React 19, and native location modules.
              Smooth 60fps dark-mode user interface, haptic feedback, and offline fallback queue.
            </p>
            <span className="feature-badge-pill">Expo SDK 54</span>
          </div>

          <div className="feature-card">
            <h3 className="feature-card-title">⚡ Real-Time Engine</h3>
            <p className="feature-card-desc">
              High-throughput Node.js microservice maintaining persistent TLS WebSocket connections
              with heartbeat pings, room-based circle broadcasting, and sub-80ms message delivery.
            </p>
            <span className="feature-badge-pill">Node.js + WSS</span>
          </div>

          <div className="feature-card">
            <h3 className="feature-card-title">🔒 Database &amp; Privacy</h3>
            <p className="feature-card-desc">
              MongoDB with indexed geospatial 2dsphere queries. Location records are encrypted at rest
              and subject to automatic TTL expiration so old history is automatically pruned.
            </p>
            <span className="feature-badge-pill">GeoJSON 2dsphere</span>
          </div>
        </div>
      </section>

      {/* 6. DOWNLOAD / CALL TO ACTION */}
      <section id="download" className="download-section">
        <div className="download-card">
          <h2 className="download-title">Ready to Take Control of Your Family Safety?</h2>
          <p className="download-desc">
            Download the official standalone Android APK directly. No Google Play required,
            no subscriptions, and completely free forever.
          </p>

          <div className="release-badges-row">
            <span className="release-meta-badge">📦 Version: v1.0.0</span>
            <span className="release-meta-badge">📱 Platform: Android 7.0+</span>
            <span className="release-meta-badge">⚖️ Size: ~37.1 MB</span>
            <span className="release-meta-badge">🛡️ Architecture: universal (arm64, x86_64)</span>
          </div>

          <div className="hero-cta-group" style={{ marginBottom: "28px" }}>
            <a
              href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.0/app-release.apk"
              className="btn-primary"
              style={{ fontSize: "17px", padding: "16px 36px" }}
              download
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Standalone APK (v1.0.0)</span>
            </a>

            <a
              href="https://github.com/sahsisunny/care-ring"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ fontSize: "17px", padding: "16px 28px" }}
            >
              <span>View Source on GitHub</span>
            </a>
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
            Need help installing? Download the APK to your phone, tap the file, enable &quot;Install from unknown sources&quot;, and launch CareRing.
          </p>
        </div>
      </section>
    </main>
  );
}
