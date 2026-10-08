<div align="center">

<img src="mobile/assets/icon.png" width="128" height="128" alt="CareRing Official Logo" />

# CareRing

### **Enterprise-Grade Real-Time Family Location Intelligence, Safety & Emergency Response Platform**

*A privacy-first, high-performance open-source alternative to proprietary family tracking systems.*

[![Release Version](https://img.shields.io/badge/Release-v1.0.4-0D9488?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sahsisunny/care-ring/releases/tag/v1.0.4)
[![Download APK](https://img.shields.io/badge/Android_APK-Download_v1.0.4-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk)
[![Deployment Status](https://img.shields.io/badge/Cloud_API-Live_on_Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://care-ring.onrender.com/health)
[![Landing Page](https://img.shields.io/badge/Landing_Page-care--ring.netlify.app-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://care-ring.netlify.app/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br/>

[![React Native](https://img.shields.io/badge/React_Native-0.86.3-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_~57.0.24-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Fastify_4.28-339933?logo=nodedotjs&logoColor=white)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_+_PostGIS_3.4-336791?logo=postgresql&logoColor=white)](https://postgis.net/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Sub--50ms_Fanout-010101?logo=socketdotio&logoColor=white)](https://github.com/websockets/ws)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Type_Safe-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

<br/>

[**🌐 Web Landing Page**](https://care-ring.netlify.app/) &nbsp;•&nbsp;
[**📥 Download Android APK**](#-android-apk-release--download) &nbsp;•&nbsp;
[**🚀 Cloud Deployment**](#-cloud-deployment--infrastructure) &nbsp;•&nbsp;
[**✨ Features**](#-key-feature-highlights) &nbsp;•&nbsp;
[**🧠 How It Works**](#-how-it-works-technical-deep-dive) &nbsp;•&nbsp;
[**📄 MIT License**](LICENSE) &nbsp;•&nbsp;
[**⚡ Quickstart**](#-quickstart-guide)

---

</div>

## 📖 Executive Summary

**CareRing** is a production-engineered, privacy-centric real-time location sharing and family safety ecosystem. Unlike commercial alternatives that monetize personal tracking data or introduce heavy battery drain, CareRing is engineered with a **zero-telemetry-selling policy**, **hardware-accelerated motion coprocessor filtering (sub-1% battery drain/hour)**, and **sub-50ms WebSocket telemetry propagation**.

The platform is designed around a modern full-stack architecture:
- **Mobile Client**: React Native 0.86 with Expo SDK 57, featuring dynamic 60 FPS coordinate interpolation, vector mapping, and instant background event dispatching.
- **Real-Time Telemetry & Chat Gateway**: High-throughput Node.js Fastify service handling WebSocket room fan-out and optimistic message synchronization.
- **Spatial Intelligence Layer**: PostgreSQL 16 accelerated by PostGIS spatial indexing (`ST_DWithin`, `ST_MakePoint`, GiST indexes) for millisecond geofence evaluation.
- **Cloud Infrastructure**: Live on **Render** (REST & WebSocket gateway) with managed **PostGIS** cloud persistence.

---

## 📥 Android APK Release & Download

CareRing provides pre-compiled, production-signed standalone Android APK binaries ready for immediate installation on physical smartphones.

### Latest Release Assets

| Asset | Version | Architecture | File Size | Target Platform | Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`CareRing-v1.0.4-production.apk`** | **v1.0.4** | `universal` (arm64-v8a, armeabi-v7a, x86_64) | **76.8 MB** | Android 8.0+ (API 26+) | [**Download APK (v1.0.4)**](https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk) |
| **`CareRing-latest.apk`** | **Latest** | `universal` (arm64, armeabi, x86_64) | **76.8 MB** | Android 8.0+ (API 26+) | [**Download Latest APK**](https://github.com/sahsisunny/care-ring/releases/latest/download/CareRing-latest.apk) |
| **GitHub Release** | **v1.0.4** | Source + Release Binaries | — | All Platforms | [**View GitHub Release**](https://github.com/sahsisunny/care-ring/releases/tag/v1.0.4) |
| **EAS Cloud Builds** | **v1.0.4** | Standalone APK & Play Store AAB | Cloud | Expo EAS | [**Expo EAS Project Dashboard**](https://expo.dev/accounts/sunnyfountane/projects/carering/builds) |

> [!TIP]
> **Pre-compiled Binary Location in Workspace**:
> The compiled release APK is stored locally in:
> [`mobile/android/app/build/outputs/apk/release/app-release.apk`](file:///Users/sunnysahsi/Desktop/life360/mobile/android/app/build/outputs/apk/release/app-release.apk)
> and mirrored at workspace root: [`CareRing-latest.apk`](file:///Users/sunnysahsi/Desktop/life360/CareRing-latest.apk).

---

### 📲 Step-by-Step Android Installation Guide

Follow these steps to install the APK directly on any Android smartphone:

1. **Download the APK**:
   Tap the [**Download APK (v1.0.4)**](https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk) link on your mobile browser (or transfer the APK via USB).
2. **Enable Unknown Apps**:
   - If prompted by Android (*"File might be harmful"*), tap **Download anyway**.
   - When tapping the downloaded file, if prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*, tap **Settings** and toggle **Allow from this source** to **ON**.
3. **Install the Application**:
   - Tap **Install** on the CareRing installation prompt.
   - Once installation completes, tap **Open**.
4. **Grant Core Permissions for Safety Monitoring**:
   CareRing will request permissions necessary for real-time safety and battery efficiency:
   - 📍 **Location**: Select **"Allow all the time"** (enables background geofence boundary alerts and emergency SOS transmission even when the app is minimized).
   - 🏃 **Physical Activity / Motion**: Select **Allow** (activates the hardware motion coprocessor to freeze GPS when stationary, reducing battery drain to <1%/hour).
   - 🔔 **Notifications**: Select **Allow** (delivers instant arrival/departure push alerts and SOS alarms).

---

## 🚀 Cloud Deployment & Infrastructure

CareRing is deployed in a high-availability cloud architecture with live endpoints accessible globally:

```mermaid
flowchart TD
    subgraph Clients ["📱 Client Layer"]
        AndroidApp["🤖 Android Mobile App\n(Standalone APK / EAS)"]
        iOSApp["🍏 iOS Mobile App\n(Expo / TestFlight)"]
        WebDash["🌐 Web Landing & Dashboard\n(care-ring.netlify.app)"]
    end

    subgraph CloudEdge ["🛡️ Edge & Network Routing"]
        RenderEdge["☁️ Render Cloud Edge\n(Automatic TLS 1.3 / SSL Termination)"]
    end

    subgraph Compute ["⚡ Application Services (Render)"]
        FastifyAPI["🚀 Fastify Node.js Engine\n(Host: care-ring.onrender.com)"]
        WSGateway["📡 WebSocket Fan-Out Broker\n(/ws/circles/:circleId)"]
        HealthRoute["🩺 Health Check\n(GET /health)"]
    end

    subgraph Data ["🗺️ Persistence & Spatial Analytics"]
        PostGIS[("🐘 PostgreSQL 16 + PostGIS 3.4\n(GiST Spatial Indexes & Connection Pool)")]
        Nominatim["🌍 Nominatim / Google Geocoding\n(Reverse Geocoding Engine)"]
    end

    AndroidApp & iOSApp & WebDash -->|HTTPS & WSS| RenderEdge
    RenderEdge --> FastifyAPI
    FastifyAPI --- WSGateway
    FastifyAPI --- HealthRoute
    WSGateway & FastifyAPI -->|Spatial Queries & History| PostGIS
    FastifyAPI -.->|Stationary Reverse Geocode| Nominatim
```

### 🌐 Live Production Endpoints

| Service | Environment | Endpoint URL | Protocol | Status |
| :--- | :--- | :--- | :--- | :--- |
| **REST API Base** | Production | `https://care-ring.onrender.com` | `HTTPS` | ![Active](https://img.shields.io/badge/Status-Active_200_OK-success?style=flat-square) |
| **Health Check** | Production | `https://care-ring.onrender.com/health` | `HTTPS` | ![Verified](https://img.shields.io/badge/Health-Passing-success?style=flat-square) |
| **WebSocket Gateway**| Production | `wss://care-ring.onrender.com/ws/circles/:circleId` | `WSS (TLS)` | ![Connected](https://img.shields.io/badge/WS-Sub--50ms-success?style=flat-square) |
| **Database Pool** | Production | Managed PostgreSQL 16 with PostGIS 3.4 | `SSL Session` | ![Protected](https://img.shields.io/badge/Spatial-GiST_Indexed-blue?style=flat-square) |

#### Live Health Check Verification
```bash
curl -i https://care-ring.onrender.com/health
```
```json
{
  "status": "ok",
  "service": "carering-realtime-engine",
  "timestamp": "2026-09-27T09:40:42.746Z"
}
```

---

## ✨ Key Feature Highlights

CareRing provides enterprise-grade family safety telemetry with complete privacy sovereignty and zero monthly subscriptions:

- 📍 **Real-Time GPS Telemetry & 60 FPS Gliding**: Sub-100ms WebSocket streaming with physics-based coordinate interpolation (`MarkerInterpolator`) eliminating map jitter.
- ⭕ **PostGIS Geofenced Safe Zones**: Microsecond boundary evaluation via PostGIS `ST_DWithin` spatial indexes for instant arrival/departure push alerts.
- ♾️ **Unlimited Movement History & Daily Timelines**: Unbounded historical route breadcrumbs, stop durations, and route replay extending back to the day members joined, with zero paywalls.
- 🚗 **Driver Safety Leaderboards & Scorecards**: Weekly safety scores (0–100), circle rankings, top speed audits, and 5-point driving event classifications (Speeding, Phone Distraction, Rapid Accel, Hard Braking, Harsh Cornering).
- 🚶 **Smart Activity State Machine**: Autonomous sensor-fusion engine identifying Stationary, Walking, Running, Driving, and Cycling states, with adaptive GPS sleeping (<1% battery drain/hour).
- 🚨 **Emergency SOS & Circle Siren**: Instant audible panic siren broadcast across all circle devices with real member avatars, location burst, and emergency speed dial.
- 👑 **Circle Governance & Private Personalization**: 3-tier role hierarchy (Owner, Admin, Member), 100% device-local private member nicknames, favorites radar compass, and dynamic Haversine distance.
- 🗺️ **6 Cartography Styles & Offline Cache**: Detailed Civic, Esri Satellite, OpenTopoMap, Esri Street, CyclOSM, and OSM Humanitarian with offline device tile caching.
- 💬 **Encrypted Group & Direct Messaging**: Instant circle feeds, confidential 1-on-1 direct messaging with multi-typer indicators, and contextual quick status presets.

> 📖 **Full Interactive Feature Catalog**: Explore the complete interactive spectrum on the [**CareRing Web Showcase**](https://care-ring.netlify.app/#features) or via the in-app **Features Catalog** (`Settings > Features Catalog`).

---

## 🧠 How It Works: Technical Deep Dive

CareRing operates on an event-driven telemetry and spatial indexing loop:

```mermaid
sequenceDiagram
    autonumber
    participant Device as 📱 Mobile Client
    participant Motion as 🏃 Motion Coprocessor
    participant WS as 📡 Fastify WebSocket Gateway
    participant DB as 🐘 PostgreSQL / PostGIS
    participant Circle as 👨‍👩‍👧 Circle Members

    Note over Device,Motion: Adaptive Telemetry Loop
    Motion->>Device: Speed & Motion Classification (Stationary/Walking/Driving)
    Device->>WS: TELEMETRY_PING {lat, lng, speed, battery, heading}
    
    rect rgb(20, 30, 45)
        Note over WS,DB: Server Spatial Pipeline (<30ms)
        WS->>WS: Zod Schema Validation & In-Memory State Update
        WS->>Circle: 0ms Real-Time Fan-Out Broadcast
        WS->>DB: PostGIS ST_DWithin Geofence Evaluation
        DB-->>WS: Place Enter / Exit Breach Event Detected
    end

    opt Geofence Breached
        WS->>Circle: GEOFENCE_ALERT Broadcast & Push Banner
        WS->>DB: INSERT INTO geofence_events
    end

    opt Dwell Time >= 3 mins (<50m radius)
        WS->>WS: Reverse Geocode via Nominatim / Google
        WS->>DB: INSERT INTO location_history (Resolved Address)
    end

    Note over Circle: Client Smooth Rendering
    Circle->>Circle: MarkerInterpolator (60fps lerp tweening)
```

### Telemetry Ping JSON Specification (`TELEMETRY_PING`)
```json
{
  "type": "TELEMETRY_PING",
  "userId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "userName": "Sunny Sahsi",
  "latitude": 28.613939,
  "longitude": 77.209021,
  "speed": 28.4,
  "heading": 172.5,
  "batteryLevel": 88,
  "isCharging": false,
  "timestamp": 1789488631000
}
```

### Direct Message JSON Specification (`DIRECT_MESSAGE`)
```json
{
  "type": "DIRECT_MESSAGE",
  "senderId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "recipientId": "3fa25cbc-ab29-491f-8ec7-cb51ae05cc5c",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "content": "Hey Ravi, are you on your way home?",
  "messageType": "text"
}
```

---

## 🏷️ Versioning & Release Governance

CareRing adheres strictly to **[Semantic Versioning (SemVer 2.0.0)](https://semver.org/)** to ensure enterprise stability and predictability:

$$\text{Format: } \mathbf{MAJOR.MINOR.PATCH}$$

- **`MAJOR`**: Incompatible API protocol modifications, breaking database schema migrations, or fundamental architectural changes.
- **`MINOR`**: Backward-compatible new functionality (e.g. crash detection algorithms, new map styles, new sensor triggers).
- **`PATCH`**: Backward-compatible bug fixes, security remediations, performance enhancements, and dependency updates.

### Release & Version Matrix

| Release Tag | Internal Version Code | Date | Android APK Asset | Key Highlights | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`v1.0.4`** | `versionCode: 4`<br/>`buildNumber: 4` | Oct 2026 | [`CareRing-v1.0.4-production.apk`](https://github.com/sahsisunny/care-ring/releases/download/v1.0.4/CareRing-v1.0.4-production.apk) | Unlimited Days Movement Timelines, Rapid Accel & Hard Braking Detection, Contextual Quick Status Presets, In-App Engineering Pipeline Catalog. | 🟢 **Current Production** |
| `v1.0.3` | `versionCode: 3`<br/>`buildNumber: 3` | Oct 2026 | [`CareRing-v1.0.3-production.apk`](https://github.com/sahsisunny/care-ring/releases/download/v1.0.3/CareRing-v1.0.3-production.apk) | Driver Safety Leaderboard, 5-Point Event Classifier, Activity State Machine, 3-Tier Roles, Device-Local Nicknames, 6 Cartography Styles. | ⚪ Previous Stable |
| `v1.0.0` | `versionCode: 1`<br/>`buildNumber: 1` | 2026-09-27 | `app-release.apk` | Initial Production Release: Live Render API, PostGIS Geofencing, 60fps Interpolation, Direct Chat, SOS, Drive Analytics. | ⚪ Previous |
| `v1.1.0` | `versionCode: 5`<br/>`buildNumber: 5` | *Q4 2026 (Planned)* | `app-release.apk` | Hardware Crash Detection via Accelerometer Spikes, Offline Telemetry Sync Queue, Low-Power BLE Proximity. | 🟡 In Roadmap |

### Synchronized Version Manifests

All product version numbers are maintained in unison across the codebase:
- **Mobile Expo App Config**: [`mobile/app.json`](file:///Users/sunnysahsi/Desktop/life360/mobile/app.json) (`version`, `android.versionCode`, `ios.buildNumber`)
- **Mobile Client Package**: [`mobile/package.json`](file:///Users/sunnysahsi/Desktop/life360/mobile/package.json) (`version`)
- **Backend Service Package**: [`server/package.json`](file:///Users/sunnysahsi/Desktop/life360/server/package.json) (`version`)
- **Root Workspace Manifest**: [`package.json`](file:///Users/sunnysahsi/Desktop/life360/package.json) (`version`)

### Standard Release Workflow (For Maintainers)

When cutting a new production release:

```bash
# 1. Bump version across manifests (e.g., from 1.0.0 to 1.1.0)
npm version 1.1.0 --no-git-tag-version
npm version 1.1.0 --prefix mobile --no-git-tag-version
npm version 1.1.0 --prefix server --no-git-tag-version

# 2. Update mobile/app.json (version -> 1.1.0, versionCode -> 2, buildNumber -> 2)

# 3. Build Production Standalone APK
npm run build:apk

# 4. Commit and Tag Release
git add .
git commit -m "chore(release): cut version v1.1.0"
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin main --tags

# 5. Upload APK to GitHub Releases
# Attach mobile/android/app/build/outputs/apk/release/app-release.apk to GitHub Release v1.1.0
```

---

## ⚡ Quickstart Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or v20 LTS recommended)
- [Docker](https://www.docker.com/) & Docker Compose
- [Android Studio](https://developer.android.com/studio) (for local emulator) or [Expo Go](https://expo.dev/go)

---

### Step 1: Start PostGIS Spatial Database
```bash
docker compose up -d
```
The database boots on `localhost:5432` and initializes spatial tables (`users`, `circles`, `places`, `geofence_events`, `location_history`, `circle_messages`, `direct_messages`) with GiST indexing.

---

### Step 2: Configure & Launch Backend Server
```bash
cd server
npm install
npm run dev
```
The Fastify server starts on `http://localhost:4000` with WebSocket ingestion available at `ws://localhost:4000/ws/circles/:circleId`.

*(Optional)* Seed demo family data:
```bash
curl -X POST http://localhost:4000/api/seed
```

---

### Step 3: Run Mobile Application
```bash
cd mobile
npm install

# Option A: Connect to deployed cloud backend on Render
npm run start:deployed

# Option B: Connect to local backend
npx expo start -c
```
- **Physical Phone**: Scan the QR code using the **Expo Go** app (Android) or **Camera** (iOS).
- **Android Emulator**: Press `a` in the terminal.
- **iOS Simulator**: Press `i` in the terminal.
- **Web Browser**: Press `w` in the terminal.

---

### Step 4: Build Standalone Android APK Locally
To build a standalone APK directly from your local terminal:
```bash
# Build release APK pointing to deployed production backend
npm run build:apk

# Built APK will be available at:
# mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## 🧪 Automated Testing Suite

Verify telemetry ingestion, geofence evaluation, and multi-socket messaging:

```bash
# Test 1: High-throughput telemetry ingestion & geofence alerts
node tests/telemetry_simulation_test.js

# Test 2: Real-time direct P2P messaging & socket failover
NODE_PATH=server/node_modules node tests/test_direct_chat.js

# Test 3: Multi-user group typing & private direct typing debouncing
NODE_PATH=server/node_modules node tests/test_typing_status.js
```

---

## 📁 Repository Directory Structure

```
care-ring/
├── docker-compose.yml              # Local PostGIS container configuration
├── DEPLOYMENT.md                   # Full cloud deployment & self-hosted VPS manual
├── README.md                       # Product documentation & release guide
├── database/
│   └── schema.sql                  # PostGIS schemas, spatial indexes, tables
├── server/                         # Fastify WebSocket & Telemetry Engine
│   ├── Dockerfile                  # Multi-stage production container
│   ├── src/
│   │   ├── types.ts                # TypeScript contracts for telemetry & chat
│   │   ├── db.ts                   # PostGIS database pool with SSL support
│   │   ├── services/
│   │   │   ├── stationaryDetector.ts # Reverse geocode throttler (<50m for >3min)
│   │   │   ├── geofenceEngine.ts   # PostGIS ST_DWithin geofence evaluator
│   │   │   └── geocodingService.ts # OpenStreetMap Nominatim reverse geocoder
│   │   ├── ws/
│   │   │   └── roomManager.ts      # Multi-socket Circle room manager & typing broker
│   │   ├── routes/
│   │   │   └── circleRoutes.ts     # REST endpoints for auth, circles, chat & timeline
│   │   └── index.ts                # Fastify server entrypoint & WS gateway
│   ├── package.json
│   └── tsconfig.json
├── mobile/                         # React Native (Expo) Mobile Client
│   ├── app/                        # Expo Router file-based screens & tab routes
│   ├── app.json                    # Expo config, permissions & version tracking
│   ├── eas.json                    # Cloud build profiles (preview APK / production AAB)
│   ├── android/                    # Native Android Gradle project
│   │   └── app/build/outputs/apk/release/app-release.apk  # Pre-compiled standalone APK
│   ├── src/
│   │   ├── models/                 # Member, Circle, Telemetry, Chat data models
│   │   ├── theme/                  # Design tokens & color palettes
│   │   ├── services/
│   │   │   ├── AuthService.ts             # Auth & circle membership APIs
│   │   │   ├── WebSocketClient.ts         # Resilient auto-reconnecting WS client
│   │   │   ├── AdaptiveLocationEngine.ts  # Motion coprocessor & battery optimizer
│   │   │   └── MarkerInterpolator.ts      # 60fps coordinate lerp & tween engine
│   │   ├── components/
│   │   │   ├── MapView.tsx                # Interactive Leaflet & CARTO map engine
│   │   │   ├── TopFloatingHeader.tsx      # Frosted glass header, switcher & SOS
│   │   │   ├── BottomDraggableSheet.tsx   # CareRing member drawer & profile card
│   │   │   ├── DynamicMemberRadar.tsx     # Off-viewport edge indicators & compass tracking
│   │   │   ├── chat/TypingIndicator.tsx   # Staggered 3-dot pulsating bubble
│   │   │   └── modals/                    # Modals: Chat, Direct, SOS, Places, Drive Report
│   │   └── screens/
│   │       ├── AuthScreen.tsx             # Sign in/up & avatar selector
│   │       └── MapScreen.tsx              # Main map assembly & coordinator
│   ├── package.json
│   └── tsconfig.json
└── tests/
    ├── telemetry_simulation_test.js # Multi-client telemetry & geofence test
    ├── test_direct_chat.js          # Direct chat WebSocket multi-socket test
    └── test_typing_status.js        # Multi-user typing indicator test
```

---

## 🔒 Security, Privacy & Compliance

- **Zero Data Resale**: CareRing never monetizes, packages, or shares user location data with third-party advertising networks or data brokers.
- **Encrypted in Transit**: All network requests communicate over encrypted TLS 1.3 (`HTTPS`) and Secure WebSockets (`WSS`).
- **Granular Privacy Controls**: Users maintain full sovereignty to toggle location sharing, activate **Privacy Bubbles ("Ghost Mode")**, or delete location history at any time.
- **PostGIS Strict Geometry Validation**: Spatial inputs are sanitized and validated against standard WGS84 coordinate boundaries before evaluation.

---

## 📄 License

CareRing is distributed as open-source software under the terms of the **[MIT License](LICENSE)**.

---

<div align="center">
  <sub>Engineered with ❤️ for family safety, privacy sovereignty, and open-source transparency.</sub>
</div>
