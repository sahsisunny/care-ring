# 🚀 CareRing: Production Deployment & Infrastructure Guide

This guide provides an end-to-end, production-ready deployment plan for the **CareRing** platform. It covers:
1. **Spatial Database**: PostgreSQL + PostGIS setup.
2. **Real-Time Backend**: Fastify HTTP REST & persistent WebSocket engine.
3. **Mobile Client**: React Native (Expo SDK 57) builds for iOS (TestFlight/App Store) & Android (APK/AAB via EAS).
4. **Web Preview (Optional)**: Exporting and deploying the Expo Web dashboard to Cloudflare Pages or Vercel.
5. **Self-Hosted VPS (Alternative)**: Running everything on a single Ubuntu VPS using Docker Compose & Caddy with automatic SSL.

---

## 🏗️ Architecture Overview

```mermaid
flowchart TD
    subgraph Clients ["Client Layer"]
        iOS["📱 iOS App\n(TestFlight / App Store)"]
        Android["🤖 Android App\n(Play Store / APK)"]
        Web["🌐 Web Dashboard\n(Cloudflare / Vercel)"]
    end

    subgraph Edge ["Network & Security"]
        DNS["🌐 Custom Domain\n(api.carering.app)"]
        SSL["🔒 SSL / TLS Termination\n(HTTPS & WSS)"]
    end

    subgraph Backend ["Application Layer"]
        Fastify["🚀 Fastify Node.js Service\n(Render / Railway / VPS)"]
        WS["📡 WebSocket Engine\n(/ws/circles/:circleId)"]
        REST["🔌 REST API\n(/api/auth, /api/circles)"]
    end

    subgraph Spatial ["Data Layer"]
        PostGIS[("🗺️ PostgreSQL 16 + PostGIS\n(Supabase / Neon / Managed Postgres)")]
    end

    iOS & Android & Web --> DNS
    DNS --> SSL
    SSL --> Fastify
    Fastify --- WS
    Fastify --- REST
    REST & WS -->|Spatial Queries & History| PostGIS
```

---

## ⚡ Deployment Comparison Matrix

| Component | Recommended (PaaS) | Self-Hosted (VPS) | Enterprise Cloud |
| :--- | :--- | :--- | :--- |
| **Database** | **Supabase** or **Neon** (PostGIS enabled) | Docker `postgis/postgis:16-3.4` | AWS RDS PostgreSQL with PostGIS |
| **Backend API / WS** | **Render** or **Railway** (Native WS & SSL) | Docker Compose + Caddy (Auto HTTPS/WSS) | AWS ECS (Fargate) + ALB |
| **Mobile Client** | **Expo EAS Build** | Local Fastlane / Xcode / Android Studio | Cloud CI/CD (GitHub Actions + EAS) |
| **Estimated Cost** | Free – $15 / month | $6 – $12 / month (Hetzner / DO) | $40+ / month |
| **DevOps Effort** | 🟢 Zero configuration | 🟡 Low (1 Docker Compose file) | 🔴 High (Terraform / CloudFormation) |

---

# 🚀 Strategy 1: Recommended PaaS Deployment (Fastest, Zero DevOps)

---

### Step 1: Deploy PostgreSQL + PostGIS (Supabase)

CareRing relies on spatial types (`GEOMETRY(Point, 4326)`) and PostGIS functions (`ST_DWithin`, `ST_MakePoint`, `ST_Distance`).

1. Create a free account at [Supabase](https://supabase.com) and create a new project.
2. In the left navigation, go to **Database** → **Extensions**.
3. Search for `postgis` and toggle it **ON**. Also ensure `uuid-ossp` is enabled.
4. Go to **SQL Editor** in Supabase:
   - Open [`database/schema.sql`](database/schema.sql) from this repository.
   - Paste the complete contents into the Supabase SQL Editor and click **Run**.
   - Verify that all tables (`users`, `circles`, `circle_members`, `places`, `geofence_events`, `location_history`, `chat_messages`, `direct_chat_messages`) and spatial indexes are created.
5. In **Project Settings** → **Database**, locate the **Connection String**:
   - Select the **URI** tab.
   - Choose **Session** (or Transaction with port 6543 / 5432).
   - Your connection string will look like:
     ```env
     postgresql://postgres:5QnH$rm_8Z4_2gM@db.rtmlxctrcunzxfvotgiv.supabase.co:5432/postgres
     ```

---

### Step 2: Configure Backend Database SSL

Cloud PostgreSQL instances (Supabase, Neon, AWS RDS) enforce SSL. Verify or update [`server/src/db.ts`](server/src/db.ts):

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export const query = async <T = any>(text: string, params?: any[]): Promise<T[]> => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 150) {
      console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return res.rows;
  } catch (err) {
    console.error('[DB] Query execution failed:', { text: text.substring(0, 100), err });
    throw err;
  }
};

export const getClient = () => pool.connect();
export default pool;
```

---

### Step 3: Deploy Backend on Render (or Railway)

#### 1. Add `server/Dockerfile`
Create `server/Dockerfile` to ensure reproducible container builds:

```dockerfile
# Multi-stage production Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

#### 2. Deploy Web Service to Render
1. Push your repository to GitHub.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Web Service**.
3. Connect your repository and configure the service:
   - **Name**: `carering-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node` (or `Docker`)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Configure **Environment Variables** in Render:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production SSL & performance mode |
| `PORT` | `4000` | Port Fastify binds to (Render sets this automatically) |
| `HOST` | `0.0.0.0` | Required for Docker/PaaS container binding |
| `DATABASE_URL` | `postgresql://...` | Supabase / PostGIS URI connection string |
| `GEOCODING_PROVIDER` | `nominatim` *(or `google`)* | Reverse geocoding engine |
| `GOOGLE_MAPS_API_KEY`| *(Optional)* | Required only if `GEOCODING_PROVIDER=google` |
| `STATIONARY_RADIUS_METERS` | `50` | Threshold for stationary stay detection |
| `STATIONARY_DURATION_THRESHOLD_MS` | `180000` | 3 minutes dwell time before geocoding |

5. Click **Create Web Service**.
6. Render will provision an HTTPS endpoint and an SSL WebSocket gateway:
   - **REST Base**: `https://carering-api.onrender.com`
   - **WebSocket Base**: `wss://carering-api.onrender.com`
   - Test health check: `https://carering-api.onrender.com/health`

---

### Step 4: Configure Mobile Client Environment

Update [`mobile/src/services/backendUrl.ts`](mobile/src/services/backendUrl.ts) so it reads from Expo's public environment variables:

```typescript
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getBackendWsUrl(): string {
  // 1. Environment variable injected via EAS or .env
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }

  // 2. Web browser fallback
  if (Platform.OS === 'web') {
    return 'ws://127.0.0.1:4000';
  }

  // 3. Expo Go on physical device or simulator
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `ws://${host}:4000`;
    }
  }

  // 4. Default local development machine fallback
  return 'ws://192.168.0.8:4000';
}
```

Create `mobile/.env.production`:
```env
EXPO_PUBLIC_BACKEND_URL=wss://carering-api.onrender.com
```

---

### Step 5: Mobile App Build & Distribution (Expo EAS)

EAS (Expo Application Services) compiles native iOS `.ipa` and Android `.aab`/`.apk` binaries in the cloud.

#### 1. Initialize EAS in `mobile/`
```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest project:init
```

#### 2. Create `mobile/eas.json`
```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "wss://carering-api.onrender.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_BACKEND_URL": "wss://carering-api.onrender.com"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

#### 3. Run Production Builds

- **Android Standalone APK (Immediate testing on real devices)**:
  ```bash
  npx eas-cli@latest build --platform android --profile preview
  ```
  *When finished, EAS generates an installable `.apk` download link and QR code.*

- **Android AAB (For Google Play Store submission)**:
  ```bash
  npx eas-cli@latest build --platform android --profile production
  ```

- **iOS Build (For Apple TestFlight / App Store)**:
  ```bash
  npx eas-cli@latest build --platform ios --profile production
  ```
  *(Requires an Apple Developer account. EAS handles all provisioning profiles and distribution certificates automatically).*

---

### Step 6: Deploy Web Client (Optional)

You can export CareRing as a progressive web application or desktop dashboard:

```bash
cd mobile
npx expo export -p web
```

This outputs static web assets to `mobile/dist`. Deploy this directory to:
- **Cloudflare Pages**: Connect repo, set build command `cd mobile && npx expo export -p web`, output dir `mobile/dist`.
- **Vercel**: Deploy with `npx vercel mobile/dist --prod`.

---

# 🖥️ Strategy 2: Self-Hosted Production VPS (DigitalOcean / Hetzner)

If you prefer full control, minimum latency, and a single $6-$10/month server hosting both PostGIS, Node.js, and automatic SSL:

### 1. Provision Ubuntu 22.04 / 24.04 Server
Install Docker and Docker Compose:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Production `docker-compose.prod.yml`
Save this at the root of your project:

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - server

  postgres:
    image: postgis/postgis:16-3.4
    container_name: carering_postgis_prod
    restart: unless-stopped
    environment:
      POSTGRES_DB: carering
      POSTGRES_USER: carering_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgis_prod_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U carering_user -d carering"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4000
      HOST: 0.0.0.0
      DATABASE_URL: postgresql://carering_user:${DB_PASSWORD}@postgres:5432/carering
      GEOCODING_PROVIDER: ${GEOCODING_PROVIDER:-nominatim}
      GOOGLE_MAPS_API_KEY: ${GOOGLE_MAPS_API_KEY:-}
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgis_prod_data:
  caddy_data:
  caddy_config:
```

### 3. Caddyfile (Automatic Let's Encrypt SSL & WebSocket Proxy)
Create `Caddyfile` at project root:

```caddy
api.yourdomain.com {
    # Automatic HTTP to HTTPS and WSS reverse proxy
    reverse_proxy server:4000 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

### 4. Start Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Caddy automatically provisions SSL certificates from Let's Encrypt. Your API and WebSocket engine will be live at `https://api.yourdomain.com` and `wss://api.yourdomain.com`.

---

## 🔒 Production Security & Performance Checklist

- [ ] **Database Connection Pooling**: Ensure `max: 20` pool limit in `server/src/db.ts` to avoid exceeding connection quotas.
- [ ] **Geocoding Protection**: Nominatim has an official rate limit of 1 request/sec. In high-traffic circles, configure a Google Maps Geocoding API key or LocationIQ to prevent IP throttling.
- [ ] **CORS Settings**: In `server/src/index.ts`, replace `origin: '*'` with your specific app schemas and web domains if restricting web origins.
- [ ] **App Store Privacy Disclosures**:
  - **Apple App Store**: Specify **Location (Always)** and **Motion & Fitness** usage strings in `app.json`. Declare that coordinates are used strictly for circle member safety and are never sold to data brokers.
  - **Google Play Store**: Complete the **Location in background** declaration form and link to a video showing background safety updates.
- [ ] **Server Uptime Monitoring**:
  - Register a free HTTP check on [UptimeRobot](https://uptimerobot.com) targeting `https://[YOUR_DOMAIN]/health`. This also prevents Render free instances from sleeping.
