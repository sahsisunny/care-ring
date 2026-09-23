# 💍 CareRing: Real-Time Family Safety & Location Intelligence

[![React Native](https://img.shields.io/badge/React_Native-0.86.3-61DAFB?logo=react&logoColor=white)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~57.0.24-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Fastify-339933?logo=nodedotjs&logoColor=white)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-336791?logo=postgresql&logoColor=white)](https://postgis.net/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-010101?logo=socketdotio&logoColor=white)](https://github.com/websockets/ws)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**CareRing** is a production-grade, privacy-first real-time family location-sharing and safety platform. Built from the ground up with **React Native (Expo TypeScript)**, **CARTO & OpenStreetMap Cartography**, a high-performance **Node.js/Fastify WebSocket Service**, and **PostgreSQL with PostGIS** spatial indexing.

---

## ✨ Key Features

### 🗺️ 1. Real-Time Interactive Map & Member Tracking
- **High-Framerate Coordinate Interpolation (`MarkerInterpolator`)**: Physics-based tween animation between GPS telemetry pings eliminates jitter and sudden teleportation.
- **Dynamic Avatar Markers**:
  - Live member avatars with status halos (**Emerald Green** for online/moving, **Slate Grey** for offline).
  - Floating status pills displaying **Member Name**, speed in km/h, and live battery % with charging glyph (⚡).
- **Cartography Engine**: Fast, uncluttered tile rendering via Leaflet with CARTO Voyager Minimal, Positron, Dark Matter, and OSM styles.
- **Auto-Fit & Center**: One-tap bounds calculation fitting all active circle members inside the viewport.

### 📱 2. CareRing Member Detail Sheet
- **Unified Member List**: Single vertical drawer showing each member's photo, resolved street address, distance away (in km / meters), stay duration, and battery state.
- **Slide-Up Member Profile Card**:
  - 🧭 **Directions**: 1-tap navigation launch in Apple Maps or Google Maps with pre-filled destination coordinates.
  - 📞 **Direct Call**: 1-tap native phone dialer (`tel:${member.phone}`) for immediate voice contact.
  - 💬 **Personal Chat**: Opens private 1-on-1 direct messaging with the selected member.
  - ⏱️ **Timeline**: Daily trips & stationary stops timeline with duration, timestamps, and street addresses.

### 💬 3. Family Chat & Private 1-on-1 Direct Messaging
- **Circle Group Chat**: Instant group communication across all circle members with automated duplicate prevention and server-backed history.
- **1-on-1 Direct (P2P) Messaging**: Private direct conversations routed strictly between the two members, persisted in PostgreSQL with composite spatial indexes.
- **Zero-Latency Optimistic UI**: Sent messages appear in the conversation feed immediately (0ms delay) with automatic temporary ID replacement on server confirmation.
- **Quick Presets Bar**: 1-tap instant messages (*"Good morning! ☀️"*, *"Call me 📞"*, *"On my way! 🚗"*, *"Low battery 🔋"*, etc.).
- **iOS & Android Keyboard Alignment**: Dynamic safe-area padding ensures chat input fields remain pinned right above the keyboard across all iPhone and Android models.

### ✍️ 4. Real-Time Multi-User Animated Typing Indicators
- **Bouncing 3-Dot Animation**: Modern pulsating bubble component (`TypingIndicator.tsx`) with staggered dot animation.
- **Multi-Typer Group Formatting**: Automatically groups typers (*"Sunny is typing..."*, *"Sunny and Neha are typing..."*, *"Sunny, Neha and 1 other are typing..."*).
- **Private Direct Typing**: Confidential typing events delivered strictly to the peer's active sockets without leaking to other members.
- **Smart Debounce**: Automatically stops typing state after 2.5 seconds of inactivity, or immediately on message send, text clear, or modal close.

### 🚨 5. Enhanced Emergency SOS System
- **SOS Trigger Modal**: 5-second countdown with high-contrast alert styling.
- **1-Tap Emergency Calling**: Instant calling to emergency services (`112` / `911`).
- **Family Speed Dial**: Direct 1-tap calling for every member in the circle.
- **Live SOS Broadcast**: Instant circle-wide alarm with the sender's live GPS coordinates, battery level, phone number, and a direct map-tracking button.

### 🔋 6. Adaptive Location & Battery Optimization Engine
- **Motion Coprocessor Integration**: Switches between Stationary, Walking, and Driving modes based on accelerometer and speed sensors:

| Movement State | Speed / Condition | GPS Accuracy | Sampling Interval | Distance Filter | Hardware Mode |
|---|---|---|---|---|---|
| **Stationary** | $\le 3\text{ km/h}$ for $>2\text{ min}$ | Balanced Power | 30–60 seconds | 50 meters | Fine GPS stopped; wakes up via motion coprocessor |
| **Walking** | $3\text{ km/h} - 15\text{ km/h}$ | High Accuracy | 10 seconds | 10 meters | Active GPS tracking |
| **Moving (Driving)** | $> 15\text{ km/h}$ | Best For Navigation | 3–5 seconds | 5 meters | High-frequency continuous GPS |

- **Reverse Geocoding Throttling**: Only triggers address resolution after a member remains stationary within a 50m radius for $\ge 3$ minutes, caching results for 24 hours to prevent API quota drain.

---

## 📁 Repository Structure

```
care-ring/
├── docker-compose.yml              # PostgreSQL + PostGIS container configuration
├── database/
│   └── schema.sql                  # PostGIS schemas, spatial indexes, tables
├── server/                         # Fastify WebSocket & Telemetry Engine
│   ├── src/
│   │   ├── types.ts                # TypeScript contracts for telemetry, WS & chat
│   │   ├── db.ts                   # PostGIS database connection pool
│   │   ├── services/
│   │   │   ├── stationaryDetector.ts # Reverse geocode throttler (<50m for >3min)
│   │   │   ├── geofenceEngine.ts   # PostGIS ST_DWithin geofence evaluator
│   │   │   └── geocodingService.ts # Google & Nominatim reverse geocoder
│   │   ├── ws/
│   │   │   └── roomManager.ts      # Multi-socket Circle room manager & typing engine
│   │   ├── routes/
│   │   │   └── circleRoutes.ts     # REST endpoints for auth, circles, chat & timeline
│   │   └── index.ts                # Fastify server & WebSocket gateway
│   ├── package.json
│   └── tsconfig.json
├── mobile/                         # React Native (Expo) Mobile Client
│   ├── App.tsx                     # App entry point & safe-area provider
│   ├── app.json                    # Expo configuration & platform permissions
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── models/                 # Member, Circle, MapStyle, Telemetry, Chat, Timeline
│       ├── theme/                  # Theme colors, styling tokens
│       ├── services/
│       │   ├── AuthService.ts             # Auth, circle membership, REST APIs
│       │   ├── WebSocketClient.ts         # Multi-socket client with reconnect rotation
│       │   ├── AdaptiveLocationEngine.ts  # Motion coprocessor & battery engine
│       │   └── MarkerInterpolator.ts      # Coordinate tweening & jitter smoother
│       ├── utils/
│       │   └── distance.ts                # Haversine distance calculator (km / meters)
│       ├── components/
│       │   ├── MapView.tsx                # Leaflet & CARTO interactive map engine
│       │   ├── TopFloatingHeader.tsx      # Frosted glass header, circle switcher & SOS
│       │   ├── BottomDraggableSheet.tsx   # CareRing member sheet & detail card
│       │   ├── FamilyMemberMarker.tsx     # Custom animated avatar marker with speed & battery
│       │   ├── CurrentLocationMarker.tsx  # Pulse radar & heading beam
│       │   ├── chat/
│       │   │   └── TypingIndicator.tsx    # 3-dot pulsating animated typing indicator
│       │   └── modals/                    # GroupChat, DirectChat, Timeline, SOS, Settings
│       └── screens/
│           ├── AuthScreen.tsx             # Email/Password signin/signup & avatar picker
│           └── MapScreen.tsx              # Main map assembly & telemetry coordinator
└── tests/
    ├── telemetry_simulation_test.js # Multi-client telemetry & geofence test
    ├── test_direct_chat.js          # Direct chat WebSocket multi-socket test
    └── test_typing_status.js        # Multi-user typing indicator test
```

---

## ⚡ Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Expo Go](https://expo.dev/go) app installed on your iOS / Android phone

---

### 1. Start PostGIS Database
```bash
docker compose up -d
```
The database starts on `localhost:5432` and automatically executes `database/schema.sql` to configure PostGIS spatial extensions, tables (`users`, `circles`, `circle_members`, `circle_messages`, `direct_messages`, `location_history`, `places`), and GiST spatial indexes.

---

### 2. Configure & Start Backend Server
```bash
cd server
npm install
npm run dev
```
The Fastify server boots on `http://localhost:4000` with WebSocket ingestion available at `ws://localhost:4000/ws/circles/:circleId`.

To populate demo family data (optional):
```bash
curl -X POST http://localhost:4000/api/seed
```

---

### 3. Start React Native Mobile App
```bash
cd mobile
npm install
npx expo start
```
- **On iPhone / Android Phone**: Scan the displayed QR code with your Camera (iOS) or the **Expo Go** app (Android).
- **On iOS Simulator**: Press `i` in the terminal.
- **On Android Emulator**: Press `a` in the terminal.
- **On Web Browser**: Press `w` in the terminal.

---

## 🌐 WebSocket Protocol Specification

The real-time gateway communicates via JSON payloads over WebSocket:

### 1. Telemetry Ping (`TELEMETRY_PING`)
```json
{
  "type": "TELEMETRY_PING",
  "userId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "userName": "Sunny Sahsi",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "speed": 24.5,
  "heading": 180.0,
  "batteryLevel": 85,
  "isCharging": false,
  "timestamp": 1789488631000
}
```

### 2. Circle Group Chat (`CHAT_MESSAGE`)
```json
{
  "type": "CHAT_MESSAGE",
  "userId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "content": "Good morning family! ☀️",
  "messageType": "preset"
}
```

### 3. Personal 1-on-1 Direct Chat (`DIRECT_MESSAGE`)
```json
{
  "type": "DIRECT_MESSAGE",
  "senderId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "recipientId": "3fa25cbc-ab29-491f-8ec7-cb51ae05cc5c",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "content": "Hey Ravi, are you on your way?",
  "messageType": "text"
}
```

### 4. Group Chat Typing Status (`TYPING_STATUS`)
```json
{
  "type": "TYPING_STATUS",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "userId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "userName": "Sunny Sahsi",
  "isTyping": true
}
```

### 5. Direct Chat Typing Status (`DIRECT_TYPING_STATUS`)
```json
{
  "type": "DIRECT_TYPING_STATUS",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "senderId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "recipientId": "3fa25cbc-ab29-491f-8ec7-cb51ae05cc5c",
  "senderName": "Sunny Sahsi",
  "isTyping": true
}
```

### 6. Emergency SOS Trigger (`SOS_TRIGGER`)
```json
{
  "type": "SOS_TRIGGER",
  "userId": "1f877edd-6e20-4cba-9aa0-45ef98c8db6c",
  "circleId": "3f2925fd-074a-4ab3-b142-bf59f5dd532e",
  "latitude": 28.6139,
  "longitude": 77.2090
}
```

---

## 🧪 Running Automated Tests

Run the test suite to verify telemetry, geofencing, multi-socket direct chat, and typing indicators:

```bash
# Test 1: Telemetry ingestion, stationary rate-limiting, and geofence alerts
node tests/telemetry_simulation_test.js

# Test 2: Real-time direct chat & reconnection resilience
NODE_PATH=server/node_modules node tests/test_direct_chat.js

# Test 3: Multi-user group typing & confidential 1-on-1 typing
NODE_PATH=server/node_modules node tests/test_typing_status.js
```

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
