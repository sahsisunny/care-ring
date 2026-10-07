import Image from "next/image";
import Link from "next/link";

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
          The modern, privacy-first open-source alternative to commercial trackers. Real-time
          GPS telemetry, circular geofences, battery &amp; driving alerts, and
          sub-second WebSocket sync — with zero monthly subscriptions.
        </p>

        <div className="hero-cta-group">
          <a
            href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk"
            className="btn-primary btn-hero-primary"
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
            <span>Download APK v1.0.4</span>
          </a>

          <a
            href="https://github.com/sahsisunny/care-ring"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-hero-secondary"
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

        {/* Mobile Quick Navigation Chips */}
        <div className="mobile-nav-chips">
          <a href="#features" className="mobile-chip">Features</a>
          <a href="#maps" className="mobile-chip">Map Styles</a>
          <a href="#pipeline" className="mobile-chip">Roadmap</a>
          <Link href="/self-host" className="mobile-chip">Self-Host</Link>
          <a href="#comparison" className="mobile-chip">Comparison</a>
          <a href="#architecture" className="mobile-chip">Architecture</a>
          <a href="#download" className="mobile-chip highlight">Download</a>
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

        {/* What's New v1.0.4 Changelog Ribbon */}
        <div style={{
          width: "100%",
          maxWidth: "780px",
          margin: "28px",
          background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(16,185,129,0.10) 100%)",
          border: "1px solid rgba(99,102,241,0.28)",
          borderRadius: "18px",
          padding: "20px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
            <span style={{
              background: "rgba(99,102,241,0.18)",
              color: "#818CF8",
              border: "1px solid rgba(99,102,241,0.35)",
              borderRadius: "8px",
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.6px",
            }}>🚀 PRODUCTION RELEASE</span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-main)" }}>What&apos;s New in v1.0.4</span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "auto" }}>Latest Production Build</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            {[
              { icon: "♾️", label: "Unlimited Movement Timelines", desc: "Unbounded historical route breadcrumbs, stop durations & route playback with zero paywalls" },
              { icon: "🛑", label: "Rapid Accel & Hard Braking", desc: "Inertial sensor analysis detecting harsh launches and sudden deceleration spikes" },
              { icon: "🏆", label: "Driver Safety Leaderboard", desc: "Circle driving score rankings, safe driver badges & self-user stat isolation" },
              { icon: "⚡", label: "5-Point Event Classifier", desc: "Real-time telemetry for speeding, phone distraction, rapid accel, braking & cornering" },
              { icon: "💬", label: "Contextual Quick Presets", desc: "1-tap situational check-in presets directly dispatched to your family feed" },
              { icon: "🗺️", label: "6 Map Styles & Offline Cache", desc: "Detailed Civic, Satellite, Topo, Clean Street, CyclOSM, and OSM Humanitarian" },
            ].map((item) => (
              <div key={item.label} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "10px",
                padding: "10px 12px",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)", marginBottom: "2px" }}>{item.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
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
                Official Hosted Fastify &amp; PostgreSQL (PostGIS) Cluster Online
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

      {/* 3. COMPREHENSIVE FEATURES CATALOG */}
      <section id="features" className="features-section">
        <div className="section-label">Complete Feature Spectrum</div>
        <h2 className="section-title">Everything You Need for Total Family Safety</h2>
        <p className="section-subtitle">
          Built from the ground up to provide high-fidelity family safety telemetry,
          driving intelligence, and private communication without predatory subscriptions.
        </p>

        {/* Category A: Location & Tracking */}
        <div className="feature-category-block">
          <div className="feature-category-title-bar">
            <span style={{ fontSize: "24px" }}>🛰️</span>
            <h3 className="feature-category-heading">Spatiotemporal Location &amp; Geofences</h3>
            <span className="feature-category-badge">Real-Time Core</span>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--cyan)" }}>
                📍
              </div>
              <h4 className="feature-card-title">Live GPS Location Streaming</h4>
              <p className="feature-card-desc">
                Continuous sub-100ms real-time coordinate streaming over persistent TLS WebSockets.
                Includes physics-based 60fps gliding interpolation, heading bearings, and speed tracking.
              </p>
              <span className="feature-badge-pill">Sub-100ms WSS</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--emerald)" }}>
                ⭕
              </div>
              <h4 className="feature-card-title">Unlimited Geofence Places</h4>
              <p className="feature-card-desc">
                Configure custom circular safe zones (Home, School, Work, Gym) with radii from 50m
                to 5,000m. PostGIS ST_DWithin delivers instant arrival and departure push notifications.
              </p>
              <span className="feature-badge-pill">50m – 5,000m Radii</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--primary)" }}>
                ♾️
              </div>
              <h4 className="feature-card-title">Unlimited Days Movement Timelines</h4>
              <p className="feature-card-desc">
                Explore complete historical movement paths, daily stop timelines, and route playbacks extending
                back to the day members joined. Zero paywalls, zero artificial 2-day or 30-day limits.
              </p>
              <span className="feature-badge-pill">Unlimited History</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#EC4899" }}>
                🧭
              </div>
              <h4 className="feature-card-title">Favorites Radar &amp; Compass</h4>
              <p className="feature-card-desc">
                Pin favorite circle members with live directional compass beacons and instant distance indicators
                directly on the radar map view, decluttering the global view.
              </p>
              <span className="feature-badge-pill">Directional Radar</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#8B5CF6" }}>
                🛡️
              </div>
              <h4 className="feature-card-title">Privacy Bubbles (&quot;Ghost Mode&quot;)</h4>
              <p className="feature-card-desc">
                Create customizable temporary blur zones (1km to 5km) for 1 to 6 hours when you
                need personal privacy without leaving your family circle.
              </p>
              <span className="feature-badge-pill">1km – 5km Cloaking</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#64748B" }}>
                💾
              </div>
              <h4 className="feature-card-title">Offline Raster Tile Caching</h4>
              <p className="feature-card-desc">
                Built-in TileCacheService stores cartography raster tiles on device storage per map style,
                enabling uninterrupted map browsing even with zero mobile signal.
              </p>
              <span className="feature-badge-pill">Local Storage Cache</span>
            </div>
          </div>
        </div>

        {/* Category B: Driving Safety & Vehicle Telemetry */}
        <div className="feature-category-block">
          <div className="feature-category-title-bar">
            <span style={{ fontSize: "24px" }}>🚗</span>
            <h3 className="feature-category-heading">Driving Safety &amp; Motion Telemetry</h3>
            <span className="feature-category-badge" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", borderColor: "rgba(239, 68, 68, 0.3)" }}>
              Sensor Intelligence
            </span>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#F59E0B" }}>
                🏆
              </div>
              <h4 className="feature-card-title">Driver Safety Leaderboard</h4>
              <p className="feature-card-desc">
                Circle-wide driving rankings comparing safety scores, safe driver badges, and weekly summaries.
                Main driving screen metrics stay isolated to your self profile for clear privacy.
              </p>
              <span className="feature-badge-pill">Circle Leaderboard</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--amber)" }}>
                📊
              </div>
              <h4 className="feature-card-title">Weekly Driver Safety Scores</h4>
              <p className="feature-card-desc">
                Algorithmic evaluation of driver habits, speed stability, and braking habits
                scored out of 100 to promote safer, smoother driving across your family.
              </p>
              <span className="feature-badge-pill">Score Out of 100</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#F97316" }}>
                ⚡
              </div>
              <h4 className="feature-card-title">5-Point Driving Event Classifier</h4>
              <p className="feature-card-desc">
                High-frequency telemetry analysis classifying Speeding, Phone Distraction, Rapid Accel,
                Hard Braking, and Harsh Cornering with dedicated horizontal filter chips.
              </p>
              <span className="feature-badge-pill">5 Event Classifiers</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#38BDF8" }}>
                📵
              </div>
              <h4 className="feature-card-title">Phone Screen Distraction Log</h4>
              <p className="feature-card-desc">
                Detects mobile screen interactions while the vehicle is actively moving,
                helping young drivers develop distraction-free driving habits.
              </p>
              <span className="feature-badge-pill">Screen Monitoring</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#EF4444" }}>
                🛑
              </div>
              <h4 className="feature-card-title">Rapid Accel &amp; Hard Braking</h4>
              <p className="feature-card-desc">
                High-precision inertial monitoring isolates aggressive throttle launches and sudden deceleration spikes,
                tagging exact road coordinates to promote smooth, defensive driving.
              </p>
              <span className="feature-badge-pill">G-Force Telemetry</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#EA580C" }}>
                🏎️
              </div>
              <h4 className="feature-card-title">Speeding Incident Logging</h4>
              <p className="feature-card-desc">
                Tracks excessive speeds relative to road speed limits with timestamps, top speed meters,
                and precise route timeline markers.
              </p>
              <span className="feature-badge-pill">Speed Audit</span>
            </div>
          </div>
        </div>

        {/* Category C: Smart Activity & Motion Intelligence */}
        <div className="feature-category-block">
          <div className="feature-category-title-bar">
            <span style={{ fontSize: "24px" }}>🚶</span>
            <h3 className="feature-category-heading">Smart Activity &amp; Motion Intelligence</h3>
            <span className="feature-category-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#6EE7B7", borderColor: "rgba(16, 185, 129, 0.3)" }}>
              Sensor Fusion
            </span>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#10B981" }}>
                🤖
              </div>
              <h4 className="feature-card-title">Smart Activity State Machine</h4>
              <p className="feature-card-desc">
                Autonomous sensor-fusion engine identifying Stationary, Walking, Running, Cycling, and Driving
                states with confidence scoring, updating status halos in real time.
              </p>
              <span className="feature-badge-pill">Activity Recognition</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--emerald)" }}>
                🌱
              </div>
              <h4 className="feature-card-title">Adaptive Motion Battery Preserver</h4>
              <p className="feature-card-desc">
                Combines device accelerometer and activity recognition to sleep GPS polling while stationary.
                Delivers 24/7 family tracking with less than 1% battery drain per hour.
              </p>
              <span className="feature-badge-pill">&lt; 1% Battery / Hr</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--cyan)" }}>
                🌍
              </div>
              <h4 className="feature-card-title">Smart Reverse Geocoding Throttle</h4>
              <p className="feature-card-desc">
                Rate-limited reverse geocoding queries Nominatim only after remaining stationary for 3+ minutes,
                caching street addresses for 24 hours to eliminate unnecessary network traffic.
              </p>
              <span className="feature-badge-pill">Intelligent Dwell Cache</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#3B82F6" }}>
                🔄
              </div>
              <h4 className="feature-card-title">Global Sync &amp; Auto-Reconnection</h4>
              <p className="feature-card-desc">
                Visual sync state pulse with sub-50ms WebSocket telemetry propagation, automatic exponential backoff,
                and graceful offline queue fallback.
              </p>
              <span className="feature-badge-pill">Resilient Telemetry</span>
            </div>
          </div>
        </div>

        {/* Category D: Circle Governance & Personalization */}
        <div className="feature-category-block" style={{ position: "relative" }}>
          <div style={{
            position: "absolute",
            top: "-10px",
            right: "16px",
            background: "linear-gradient(90deg, #6366F1, #10B981)",
            color: "#fff",
            fontSize: "10px",
            fontWeight: 800,
            padding: "3px 10px",
            borderRadius: "20px",
            letterSpacing: "0.8px",
            zIndex: 2,
          }}>✨ FULL SUITE</div>
          <div className="feature-category-title-bar">
            <span style={{ fontSize: "24px" }}>👑</span>
            <h3 className="feature-category-heading">Circle Governance &amp; Personalization</h3>
            <span className="feature-category-badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#818CF8", borderColor: "rgba(99, 102, 241, 0.35)" }}>Governance</span>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#FBBF24" }}>
                👑
              </div>
              <h4 className="feature-card-title">Role-Based Governance (Owner / Admin / Member)</h4>
              <p className="feature-card-desc">
                Full circle hierarchy. Owners can promote members to Admin, reassign ownership,
                and manage members. Admins can manage regular members safely.
              </p>
              <span className="feature-badge-pill">3-Tier Governance</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#818CF8" }}>
                🏷️
              </div>
              <h4 className="feature-card-title">Private Member Nicknames (Device-Local)</h4>
              <p className="feature-card-desc">
                Set personal nicknames for circle members stored entirely on your device via NicknameService.
                Never synced to servers or visible to other members — completely private labeling.
              </p>
              <span className="feature-badge-pill">100% Device-Local</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#10B981" }}>
                📏
              </div>
              <h4 className="feature-card-title">Live Dynamic Distance to Members</h4>
              <p className="feature-card-desc">
                Each member card in your circle displays real-time straight-line distance from your position,
                updating dynamically with selectable metric (km) and imperial (mi) units.
              </p>
              <span className="feature-badge-pill">Real-Time Haversine</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#EC4899" }}>
                🎨
              </div>
              <h4 className="feature-card-title">Circle Customization &amp; Themes</h4>
              <p className="feature-card-desc">
                Personalize individual circles with unique emoji icons, custom accent colors, and group labels
                synced seamlessly across your account.
              </p>
              <span className="feature-badge-pill">Custom Theming</span>
            </div>
          </div>
        </div>

        {/* Category E: Emergency SOS, Battery & Communication */}
        <div className="feature-category-block">
          <div className="feature-category-title-bar">
            <span style={{ fontSize: "24px" }}>🚨</span>
            <h3 className="feature-category-heading">Emergency SOS, Battery &amp; Communication</h3>
            <span className="feature-category-badge" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#FCA5A5", borderColor: "rgba(239, 68, 68, 0.3)" }}>
              Safety Core
            </span>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#DC2626" }}>
                🚨
              </div>
              <h4 className="feature-card-title">One-Tap Emergency SOS Siren</h4>
              <p className="feature-card-desc">
                Instantly sounds an audible siren on all circle devices, overrides silent mode,
                and transmits high-priority GPS coordinate bursts with real contact photos and speed dial.
              </p>
              <span className="feature-badge-pill">Instant Circle Siren</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--amber)" }}>
                🔋
              </div>
              <h4 className="feature-card-title">Live Battery &amp; Charging Telemetry</h4>
              <p className="feature-card-desc">
                Monitors real-time battery percentages and charging states across circle devices.
                Dispatches automated notifications when a phone drops below 15%.
              </p>
              <span className="feature-badge-pill">Auto &lt;15% Alert</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "var(--primary)" }}>
                💬
              </div>
              <h4 className="feature-card-title">Circle Group &amp; 1-on-1 Direct Chat</h4>
              <p className="feature-card-desc">
                Encrypted family messaging with group feeds, confidential 1-on-1 private direct chat,
                physics-bounced multi-typer indicators, and quick situational presets.
              </p>
              <span className="feature-badge-pill">Direct + Group Chat</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#06B6D4" }}>
                ⚡
              </div>
              <h4 className="feature-card-title">Contextual Quick Status Presets</h4>
              <p className="feature-card-desc">
                Dispatch instant situational check-ins and travel updates (&quot;On my way&quot;, &quot;Arrived safely&quot;,
                &quot;Running late&quot;, &quot;Need a ride&quot;) with a single tap directly to your family feed.
              </p>
              <span className="feature-badge-pill">Instant Presets</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#059669" }}>
                🔒
              </div>
              <h4 className="feature-card-title">Zero Data Selling &amp; Ad Trackers</h4>
              <p className="feature-card-desc">
                Commercial apps monetize your family coordinates to data brokers. CareRing contains
                zero third-party trackers, zero advertising SDKs, and 100% private databases.
              </p>
              <span className="feature-badge-pill">Zero Data Brokers</span>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrapper" style={{ color: "#38BDF8" }}>
                🐳
              </div>
              <h4 className="feature-card-title">Docker Self-Hosting Ready</h4>
              <p className="feature-card-desc">
                Full infrastructure sovereignty. Deploy your own backend microservices with Docker,
                Render, AWS, or a home server with a single command.
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "14px" }}>
                <span className="feature-badge-pill">Self-Hostable</span>
                <Link href="/self-host" style={{ fontSize: "12px", color: "var(--cyan)", fontWeight: 700, textDecoration: "none" }}>
                  Deploy Guide &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. DEDICATED MAP ENGINE & 6 CARTOGRAPHY STYLES SECTION */}
      <section id="maps" className="map-styles-section">
        <div className="section-label">Vector &amp; Raster Cartography</div>
        <h2 className="section-title">6 High-Precision Map Styles — Zero API Quotas</h2>
        <p className="section-subtitle">
          Powered by an open, high-performance Leaflet 1.9.4 engine with local raster tile caching,
          silky marker gliding physics, and zero Google Maps billing surprises.
        </p>

        <div className="map-styles-grid">
          {/* Map Style 1 */}
          <div className="map-style-card">
            <div className="map-style-preview-header">
              <div className="map-style-icon-badge" style={{ color: "var(--cyan)" }}>
                🏛️
              </div>
              <span className="map-style-zoom-badge">Max Zoom 19</span>
            </div>
            <h3 className="map-style-title">Detailed Civic</h3>
            <div className="map-style-provider">OpenStreetMap Standard</div>
            <p className="map-style-desc">
              The gold-standard open civic map. Renders detailed building footprints, landmarks,
              street amenities, pedestrian crossings, house numbers, and public transit nodes.
            </p>
            <div className="map-style-features-row">
              <span className="map-style-pill">Civic Landmarks</span>
              <span className="map-style-pill">House Numbers</span>
              <span className="map-style-pill">Transit Stops</span>
            </div>
          </div>

          {/* Map Style 2 */}
          <div className="map-style-card">
            <div className="map-style-preview-header">
              <div className="map-style-icon-badge" style={{ color: "var(--emerald)" }}>
                🛰️
              </div>
              <span className="map-style-zoom-badge">Max Zoom 19</span>
            </div>
            <h3 className="map-style-title">Satellite Imagery</h3>
            <div className="map-style-provider">Esri World Imagery (ArcGIS)</div>
            <p className="map-style-desc">
              Ultra-high-resolution global aerial photography and satellite orthomosaics. Provides
              crystal-clear real-world views of neighborhoods, buildings, and rural landscapes.
            </p>
            <div className="map-style-features-row">
              <span className="map-style-pill">High-Res Ortho</span>
              <span className="map-style-pill">Global Coverage</span>
              <span className="map-style-pill">Aerial Clarity</span>
            </div>
          </div>

          {/* Map Style 3 */}
          <div className="map-style-card">
            <div className="map-style-preview-header">
              <div className="map-style-icon-badge" style={{ color: "var(--amber)" }}>
                ⛰️
              </div>
              <span className="map-style-zoom-badge">Max Zoom 17</span>
            </div>
            <h3 className="map-style-title">Topographic Terrain</h3>
            <div className="map-style-provider">OpenTopoMap / SRTM Data</div>
            <p className="map-style-desc">
              Dedicated elevation contours, mountain reliefs, hillshading, and backcountry hiking trails.
              Ideal for outdoor family adventures, camping trips, and rural areas.
            </p>
            <div className="map-style-features-row">
              <span className="map-style-pill">Elevation Contours</span>
              <span className="map-style-pill">Hiking Trails</span>
              <span className="map-style-pill">Hillshading</span>
            </div>
          </div>

          {/* Map Style 4 */}
          <div className="map-style-card">
            <div className="map-style-preview-header">
              <div className="map-style-icon-badge" style={{ color: "#818CF8" }}>
                🛣️
              </div>
              <span className="map-style-zoom-badge">Max Zoom 19</span>
            </div>
            <h3 className="map-style-title">Clean Street View</h3>
            <div className="map-style-provider">Esri World Street Map</div>
            <p className="map-style-desc">
              High-contrast road network cartography emphasizing highways, urban arterial streets,
              and highway exits. Designed for quick glanceability during family drives.
            </p>
            <div className="map-style-features-row">
              <span className="map-style-pill">High Contrast</span>
              <span className="map-style-pill">Road Hierarchy</span>
              <span className="map-style-pill">Driving Focus</span>
            </div>
          </div>

          {/* Map Style 5 */}
          <div className="map-style-card">
            <div className="map-style-preview-header">
              <div className="map-style-icon-badge" style={{ color: "#34D399" }}>
                🚲
              </div>
              <span className="map-style-zoom-badge">Max Zoom 18</span>
            </div>
            <h3 className="map-style-title">Outdoor &amp; Trails</h3>
            <div className="map-style-provider">CyclOSM French Cartography</div>
            <p className="map-style-desc">
              Purpose-built for cycling and pedestrian safety. Highlights separated bike tracks,
              footpaths, park greenspaces, elevation grades, and pedestrian walkways.
            </p>
            <div className="map-style-features-row">
              <span className="map-style-pill">Bicycle Tracks</span>
              <span className="map-style-pill">Park Walkways</span>
              <span className="map-style-pill">Grade Indicators</span>
            </div>
          </div>

          {/* Map Style 6 */}
          <div className="map-style-card">
            <div className="map-style-preview-header">
              <div className="map-style-icon-badge" style={{ color: "#F43F5E" }}>
                🏥
              </div>
              <span className="map-style-zoom-badge">Max Zoom 19</span>
            </div>
            <h3 className="map-style-title">Humanitarian Map</h3>
            <div className="map-style-provider">OSM France Humanitarian</div>
            <p className="map-style-desc">
              Emergency-optimized cartography highlighting medical centers, emergency response facilities,
              community infrastructure, and road accessibility with maximum color contrast.
            </p>
            <div className="map-style-features-row">
              <span className="map-style-pill">Emergency Focus</span>
              <span className="map-style-pill">Hospitals &amp; Aid</span>
              <span className="map-style-pill">High Visibility</span>
            </div>
          </div>
        </div>

        {/* Map Engine Technical Highlights Grid */}
        <div className="map-specs-callout">
          <div className="map-spec-item">
            <h4><span>⚡</span> Open Leaflet 1.9.4 Core</h4>
            <p>
              Hardware-accelerated Canvas &amp; WebGL rendering provides smooth 60fps panning and zooming
              with zero Google Maps API keys or billing quotas.
            </p>
          </div>

          <div className="map-spec-item">
            <h4><span>💾</span> Offline Raster Tile Caching</h4>
            <p>
              Built-in <code>TileCacheService</code> downloads and stores map tiles directly on device storage,
              ensuring uninterrupted map viewing even with zero mobile signal.
            </p>
          </div>

          <div className="map-spec-item">
            <h4><span>✨</span> Silky Gliding Marker Physics</h4>
            <p>
              Physics-based coordinate interpolation ensures family member markers glide gracefully across
              roads and paths instead of abruptly jumping or teleporting.
            </p>
          </div>

          <div className="map-spec-item">
            <h4><span>📍</span> Live Telemetry Halo Badges</h4>
            <p>
              Every marker displays member avatar, live speed gauge (e.g. <code>42 km/h</code>), battery level,
              heading arrow, and stationary duration (e.g. &quot;here for 2 hrs&quot;).
            </p>
          </div>
        </div>
      </section>

      {/* 4. CARERING VS TRADITIONAL TRACKERS COMPARISON */}
      <section id="comparison" className="comparison-section">
        <div style={{ textAlign: "center" }}>
          <div className="section-label">Honest Comparison</div>
          <h2 className="section-title">CareRing vs. Traditional Trackers</h2>
          <p className="section-subtitle">
            See why privacy-conscious families and engineers are choosing CareRing over commercial subscription apps.
          </p>
          <div className="mobile-scroll-hint">
            <span>↔ Swipe horizontally to compare</span>
          </div>
        </div>

        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="col-feature">Feature / Attribute</th>
                <th className="col-carering">CareRing (Open Source)</th>
                <th className="col-commercial">Commercial &amp; Proprietary Trackers</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="col-feature">Monthly Subscription Cost</td>
                <td className="col-carering">100% Free Forever ($0)</td>
                <td className="col-commercial">$4.99 to $24.99 / month</td>
              </tr>
              <tr>
                <td className="col-feature">Movement History &amp; Timelines</td>
                <td className="col-carering">Unlimited (Lifetime history from day 1)</td>
                <td className="col-commercial">Paywalled (2 days free, 30 days on $19.99/mo)</td>
              </tr>
              <tr>
                <td className="col-feature">Data Privacy &amp; Broker Policy</td>
                <td className="col-carering">Zero data sales. No ad SDKs.</td>
                <td className="col-commercial">Monetizes location to data brokers</td>
              </tr>
              <tr>
                <td className="col-feature">Source Code Transparency</td>
                <td className="col-carering">100% Public MIT on GitHub</td>
                <td className="col-commercial">Proprietary closed-source code</td>
              </tr>
              <tr>
                <td className="col-feature">Self-Hosting Option</td>
                <td className="col-carering">Yes — Docker, VPS, or Raspberry Pi</td>
                <td className="col-commercial">Impossible (Locked cloud)</td>
              </tr>
              <tr>
                <td className="col-feature">Real-Time Refresh Rate</td>
                <td className="col-carering">Sub-second over WebSocket</td>
                <td className="col-commercial">Throttled on free tiers</td>
              </tr>
              <tr>
                <td className="col-feature">Battery Efficiency</td>
                <td className="col-carering">Adaptive motion throttle engine</td>
                <td className="col-commercial">Known heavy background drain</td>
              </tr>
              <tr>
                <td className="col-feature">In-App Advertising &amp; Upsells</td>
                <td className="col-carering">0% Ads, 100% clean UI</td>
                <td className="col-commercial">Constant upsells and insurance ads</td>
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
              React Native 0.86, Expo SDK 57, React 19, and Leaflet 1.9.4 vector/raster cartography.
              Smooth 60fps dark-mode user interface, haptic feedback, and local offline raster tile caching.
            </p>
            <span className="feature-badge-pill">React Native 0.86 • Expo 57</span>
          </div>

          <div className="feature-card">
            <h3 className="feature-card-title">⚡ Real-Time Engine</h3>
            <p className="feature-card-desc">
              High-throughput Node.js Fastify 4.28 microservice maintaining persistent TLS WebSockets with
              room fan-out, sub-50ms message propagation, and Zod type-safe validation.
            </p>
            <span className="feature-badge-pill">Fastify 4.28 + WSS</span>
          </div>

          <div className="feature-card">
            <h3 className="feature-card-title">🔒 Spatial Database &amp; Privacy</h3>
            <p className="feature-card-desc">
              PostgreSQL 16 accelerated by PostGIS 3.4 spatial indexing (ST_DWithin, ST_MakePoint, GiST spatial trees).
              Sub-millisecond geofence evaluation with encrypted-at-rest telemetry.
            </p>
            <span className="feature-badge-pill">PostgreSQL 16 + PostGIS 3.4</span>
          </div>
        </div>

        <div style={{ marginTop: "28px", textAlign: "center" }}>
          <Link
            href="/self-host"
            className="btn-secondary"
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px" }}
          >
            <span>🐳 Complete Self-Hosting &amp; APK Connection Guide &rarr;</span>
          </Link>
        </div>
      </section>

      {/* 5. ENGINEERING PIPELINE & ROADMAP */}
      <section id="pipeline" className="features-section" style={{ paddingTop: "20px" }}>
        <div className="section-label">Active Engineering</div>
        <h2 className="section-title">Engineering Pipeline &amp; Upcoming Roadmap</h2>
        <p className="section-subtitle">
          Transparent, open engineering progress. Explore high-priority capabilities actively being developed by our core team.
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#EF4444" }}>
              💥
            </div>
            <h4 className="feature-card-title">Multi-Sensor Crash Impact Detection</h4>
            <p className="feature-card-desc">
              High-G collision algorithm analyzing accelerometer spikes (&gt;3.5G) and sudden deceleration forces,
              triggering automated panic sirens and dispatching precise crash GPS coordinates to your circle.
            </p>
            <span className="feature-badge-pill" style={{ color: "#FCA5A5", borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.12)" }}>In Pipeline • Q4 2026</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#F59E0B" }}>
              💾
            </div>
            <h4 className="feature-card-title">Offline Telemetry Sync Queue (SQLite)</h4>
            <p className="feature-card-desc">
              Local on-device SQLite coordinate queue that caches location updates and driving telemetry during deep cellular
              dead zones, automatically replaying and syncing with the cloud when signal restores.
            </p>
            <span className="feature-badge-pill" style={{ color: "#FDE68A", borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.12)" }}>In Pipeline • Q4 2026</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#3B82F6" }}>
              📡
            </div>
            <h4 className="feature-card-title">Low-Power BLE Proximity Mesh</h4>
            <p className="feature-card-desc">
              Bluetooth Low Energy peer-to-peer radar enabling family member proximity discovery in crowded stadiums,
              airports, underground subways, and festival grounds without cellular signal.
            </p>
            <span className="feature-badge-pill" style={{ color: "#93C5FD", borderColor: "rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.12)" }}>In Pipeline • Q1 2027</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#8B5CF6" }}>
              🛠️
            </div>
            <h4 className="feature-card-title">24/7 Roadside Assistance Service API</h4>
            <p className="feature-card-desc">
              Integrated digital dispatch partner network for emergency towing, flat tire service, battery jump-starts,
              and lockout assistance directly from the CareRing Safety tab.
            </p>
            <span className="feature-badge-pill" style={{ color: "#DDD6FE", borderColor: "rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.12)" }}>In Pipeline • Q1 2027</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#10B981" }}>
              ⌚
            </div>
            <h4 className="feature-card-title">Wear OS &amp; Apple Watch Companions</h4>
            <p className="feature-card-desc">
              Wrist-worn glance tiles for rapid member distance checks, battery indicators, situational check-ins,
              and one-tap emergency SOS siren triggers directly from your smartwatch.
            </p>
            <span className="feature-badge-pill" style={{ color: "#6EE7B7", borderColor: "rgba(16,185,129,0.4)", background: "rgba(16,185,129,0.12)" }}>In Pipeline • Q1 2027</span>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper" style={{ color: "#06B6D4" }}>
              📶
            </div>
            <h4 className="feature-card-title">Wi-Fi BSSID Safe Zone Beacons</h4>
            <p className="feature-card-desc">
              Instantaneous place arrival and departure detection powered by known home and office Wi-Fi association,
              delivering microsecond geofence events with zero GPS chip battery drain.
            </p>
            <span className="feature-badge-pill" style={{ color: "#A5F3FC", borderColor: "rgba(6,182,212,0.4)", background: "rgba(6,182,212,0.12)" }}>In Pipeline • Q2 2027</span>
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
            <span className="release-meta-badge">📦 Version: v1.0.4</span>
            <span className="release-meta-badge">📱 Platform: Android 8.0+</span>
            <span className="release-meta-badge">⚖️ Size: ~76 MB</span>
            <span className="release-meta-badge">🛡️ Architecture: universal (arm64, x86_64)</span>
          </div>

          <div className="hero-cta-group" style={{ marginBottom: "28px" }}>
            <a
              href="https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk"
              className="btn-primary btn-download-primary"
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
              <span>Download Standalone APK (v1.0.4)</span>
            </a>

            <a
              href="https://github.com/sahsisunny/care-ring"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-download-secondary"
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
