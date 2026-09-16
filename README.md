# Life360 Production MVP: Real-Time Family Location-Sharing System

A production-ready, cross-platform real-time family location-sharing application inspired by Life360. Built with **Flutter**, **Google Maps**, a high-performance **Node.js/Fastify WebSocket Service**, and **PostgreSQL with PostGIS**.

---

## 📸 System Architecture & Visual Design

![Life360 Real-Time MVP UI Layout](/Users/sunnysahsi/.gemini/antigravity-ide/brain/be23497d-4f51-4303-bfb8-77dd27a9d24a/life360_app_ui_1789488631204.jpg)

### Core 3-Layer Mobile Layout
1. **Base Layer**: Full-screen Google Map with clean, uncluttered custom JSON cartography (POIs, commercial icons, and map toolbar suppressed).
2. **Dynamic Avatar Markers**:
   - Circular member photos / badges.
   - Status rings: **Emerald Green** (#10B981) for active/moving, **Slate Grey** (#94A3B8) for offline.
   - Floating status pills displaying live speed (km/h) and battery % with charging glyph (⚡).
   - **Smooth Coordinate Interpolation (`MarkerInterpolator`)**: High-framerate tween animation between GPS pings to eliminate jitter.
   - Marker tap animates camera to zoom directly into that member.
3. **Top Floating Header**:
   - Frosted glass bar with circle switcher dropdown ("Family Circle", "Biker Squad").
   - Member count badge and instant emergency **SOS** trigger button.
4. **Bottom Draggable Sheet**:
   - **Collapsed State**: Horizontal scrollable list of member status cards showing resolved address/place, battery %, and last update time.
   - **Expanded State**: Full member directory with action buttons: **Navigate**, **Check-in**, and **Place History**.
   - **"Center All" Button**: Automatically calculates `LatLngBounds` to fit all circle members inside the viewport.

---

## 📁 Repository Structure

```
life360/
├── docker-compose.yml              # PostgreSQL + PostGIS container config
├── database/
│   └── schema.sql                  # PostGIS schema, spatial indexes, tables
├── server/                         # Fastify WebSocket & Telemetry Engine
│   ├── src/
│   │   ├── types.ts                # TypeScript contracts for telemetry & WS
│   │   ├── db.ts                   # PostGIS database connection pool
│   │   ├── services/
│   │   │   ├── stationaryDetector.ts # Reverse geocode throttler (<50m for >3min)
│   │   │   ├── geofenceEngine.ts   # PostGIS ST_DWithin geofence evaluator
│   │   │   └── geocodingService.ts # Google & Nominatim reverse geocoder
│   │   ├── ws/
│   │   │   └── roomManager.ts      # Real-time Circle room fan-out manager
│   │   ├── routes/
│   │   │   └── circleRoutes.ts     # REST endpoints for members, places & seed
│   │   └── index.ts                # Fastify server entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── mobile/                         # Cross-platform Mobile App (Flutter)
│   ├── android/
│   │   └── app/src/main/AndroidManifest.xml # Location & Foreground Service
│   ├── ios/
│   │   └── Runner/Info.plist       # iOS Background Modes & Usage Keys
│   ├── pubspec.yaml
│   └── lib/
│       ├── main.dart               # Theme & transparent system overlay
│       ├── models/                 # Member, Circle, Geofence, Telemetry models
│       ├── theme/map_style.dart    # Clean Google Maps style JSON
│       ├── services/
│       │   ├── marker_interpolator.dart       # Tween animation coordinate smoother
│       │   ├── adaptive_location_engine.dart  # Sensor & battery optimization
│       │   └── websocket_client.dart          # Reconnecting WS client
│       ├── widgets/
│       │   ├── custom_map_marker.dart         # Canvas-rendered dynamic marker
│       │   ├── top_floating_header.dart       # Header with circle switcher & SOS
│       │   └── bottom_draggable_sheet.dart    # Collapsed/expanded member list
│       └── screens/
│           └── map_screen.dart     # 3-Layer UI Assembly
└── tests/
    └── telemetry_simulation_test.js # Multi-client fan-out & geofence test
```

---

## ⚡ Quick Start

### 1. Start PostGIS Database
```bash
docker compose up -d
```
The database starts on `localhost:5432` and automatically runs `database/schema.sql` to initialize tables, spatial GiST indexes, and PostGIS extensions.

### 2. Configure & Start Backend
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
The server will boot on `http://localhost:4000` with WebSocket ingestion available at `ws://localhost:4000/ws/circles/:circleId`.

To populate demo family data:
```bash
curl -X POST http://localhost:4000/api/seed
```

### 3. Run Automated Telemetry Simulation Test
```bash
npm run test:sim
```
This test launches two simulated clients in the same circle, verifies moving telemetry fan-out, validates the stationary rate-limiting threshold, and tests emergency SOS alerts.

### 4. Run Mobile App (Flutter)
```bash
cd mobile
flutter pub get
flutter run
```

---

## 🔋 Sensor & Battery Optimization Engine

The mobile client features an adaptive polling engine (`adaptive_location_engine.dart`) to optimize battery life:

| Movement State | Speed / Condition | GPS Accuracy | Sampling Interval | Distance Filter | Hardware Mode |
|---|---|---|---|---|---|
| **Stationary** | $\le 3\text{ km/h}$ for $>2\text{ min}$ | Balanced Power | 30–60 seconds | 50 meters | Fine GPS stopped; wakes up via motion coprocessor |
| **Walking** | $3\text{ km/h} - 15\text{ km/h}$ | High Accuracy | 10 seconds | 10 meters | Active GPS tracking |
| **Moving (Driving)** | $> 15\text{ km/h}$ | Best For Navigation | 3–5 seconds | 5 meters | High-frequency continuous GPS |

### Reverse Geocoding Rate-Limiting
To prevent excessive geocoding API calls and bill shock:
- When a user moves, address resolution is deferred.
- Only when a user remains within a **50-meter radius** for **$\ge 3$ minutes** is reverse geocoding triggered.
- Results are cached in spatial buckets ($0.0001^\circ$ precision) for 24 hours.

---

## 🛡️ Platform Permissions & Setup

### Android (`AndroidManifest.xml`)
The following permissions and foreground service declarations are configured:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```
Add your Google Maps API key in `AndroidManifest.xml`:
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY" />
```

### iOS (`Info.plist`)
Background execution requires location updates and motion detection:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to share your real-time position with your family circle.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Background location allows your circle to receive arrival alerts even when the app is closed.</string>
<key>NSMotionUsageDescription</key>
<string>Motion sensors detect when you are stationary or driving to optimize battery consumption.</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>fetch</string>
    <string>processing</string>
</array>
```

---

## 🌐 Telemetry WebSocket Protocol

### 1. Ingestion (`TELEMETRY_PING`)
```json
{
  "type": "TELEMETRY_PING",
  "userId": "user-uuid",
  "circleId": "circle-uuid",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "speed": 42.5,
  "heading": 180.0,
  "batteryLevel": 88,
  "isCharging": false,
  "timestamp": 1789488631000
}
```

### 2. Fan-out Broadcast (`TELEMETRY_UPDATE`)
```json
{
  "type": "TELEMETRY_UPDATE",
  "data": {
    "userId": "user-uuid",
    "latitude": 37.7749,
    "longitude": -122.4194,
    "speed": 42.5,
    "heading": 180.0,
    "batteryLevel": 88,
    "isCharging": false,
    "resolvedAddress": "Lincoln High School",
    "isStationary": false
  }
}
```

### 3. Geofence Alert (`GEOFENCE_ALERT`)
```json
{
  "type": "GEOFENCE_ALERT",
  "data": {
    "userId": "user-uuid",
    "userName": "Sarah",
    "placeId": "place-uuid",
    "placeName": "Home",
    "event": "ENTER",
    "timestamp": 1789488631000
  }
}
```
