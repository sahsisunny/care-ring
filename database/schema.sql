-- ==============================================================================
-- LIFE360 MVP: POSTGRESQL + POSTGIS SCHEMA DEFINITION
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    battery_level INT CHECK (battery_level >= 0 AND battery_level <= 100),
    is_charging BOOLEAN DEFAULT FALSE,
    fcm_token TEXT,
    last_online_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Circles (Family / Groups)
CREATE TABLE IF NOT EXISTS circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    invite_code VARCHAR(16) UNIQUE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Circle Members (Many-to-Many with Role)
CREATE TABLE IF NOT EXISTS circle_members (
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (circle_id, user_id)
);

-- 5. Places (Geofence Circular Zones)
CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'other', -- 'home', 'school', 'work', 'gym'
    -- Using WGS84 Point (SRID 4326): Longitude first, Latitude second
    location GEOMETRY(Point, 4326) NOT NULL,
    radius_meters NUMERIC(10, 2) NOT NULL DEFAULT 200.0,
    notify_on_enter BOOLEAN DEFAULT TRUE,
    notify_on_exit BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. User Geofence Transition States
-- Keeps track of whether a user is currently inside or outside each geofence
CREATE TABLE IF NOT EXISTS user_geofence_states (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(id) ON DELETE CASCADE,
    is_inside BOOLEAN NOT NULL DEFAULT FALSE,
    last_transition_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, place_id)
);

-- 7. Geofence Event Audit Log
CREATE TABLE IF NOT EXISTS geofence_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(id) ON DELETE CASCADE,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('ENTER', 'EXIT')),
    location GEOMETRY(Point, 4326) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Location History (Time-series Spatiotemporal Trajectory)
CREATE TABLE IF NOT EXISTS location_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    speed NUMERIC(6, 2) DEFAULT 0.0,       -- in km/h
    heading NUMERIC(5, 2) DEFAULT 0.0,     -- 0 - 360 degrees
    altitude NUMERIC(7, 2),                -- meters
    accuracy NUMERIC(6, 2),               -- meters (GPS horizontal accuracy)
    battery_level INT,                     -- 0 - 100%
    is_charging BOOLEAN DEFAULT FALSE,
    resolved_address TEXT,                 -- Cached reverse-geocoded address
    stationary_duration_sec INT DEFAULT 0, -- How long stationary at this spot
    recorded_at TIMESTAMPTZ NOT NULL,      -- Device GPS timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PERFORMANCE & SPATIAL INDEXES
-- ==============================================================================

-- Spatial GiST Index on Places geofence location
CREATE INDEX IF NOT EXISTS idx_places_location_gist 
ON places USING GIST (location);

-- Spatial GiST Index on Location History
CREATE INDEX IF NOT EXISTS idx_location_history_location_gist 
ON location_history USING GIST (location);

-- Composite B-Tree Index for user time-series querying (telemetry replay)
CREATE INDEX IF NOT EXISTS idx_location_history_user_time 
ON location_history (user_id, recorded_at DESC);

-- Index for circle member lookups
CREATE INDEX IF NOT EXISTS idx_circle_members_user 
ON circle_members (user_id);

-- Index for geofence event querying
CREATE INDEX IF NOT EXISTS idx_geofence_events_user_place 
ON geofence_events (user_id, place_id, created_at DESC);

-- ==============================================================================
-- HELPER SPATIAL PROCEDURES & FUNCTIONS
-- ==============================================================================

-- Function to check if a user coordinate is within a place geofence (in meters)
CREATE OR REPLACE FUNCTION is_within_place(
    p_user_lon DOUBLE PRECISION,
    p_user_lat DOUBLE PRECISION,
    p_place_location GEOMETRY,
    p_radius_meters DOUBLE PRECISION
) RETURNS BOOLEAN AS $$
BEGIN
    -- ST_DWithin on geography calculates real geodesic distance on Earth in meters
    RETURN ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_user_lon, p_user_lat), 4326)::geography,
        p_place_location::geography,
        p_radius_meters
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
