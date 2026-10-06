import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MemberData, getMemberInitials } from '../models/Member';
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';
import { TileCacheService, CacheStats, CacheProgress, SmartCacheConfig } from '../services/TileCacheService';

export interface MapViewRef {
  animateToPosition: (lat: number, lng: number, zoom?: number, offsetY?: number) => void;
  fitBounds: (members: MemberData[]) => void;
  setMapStyle: (style: MapStyleConfig) => void;
  triggerReaction: (lat: number, lng: number, emoji: string) => void;
  showRouteReplay: (coords: [number, number][], color?: string) => void;
  clearRouteReplay: () => void;
  showTimelineRoute: (data: {
    coords: [number, number][];
    stops?: Array<{ latitude: number; longitude: number; stopNumber: number; title: string; duration?: string; address?: string }>;
    color?: string;
  }) => void;
  clearTimelineRoute: () => void;
  showBubble: (lat: number, lng: number, radiusMeters?: number, autoFit?: boolean) => void;
  fitBubble: (lat: number, lng: number, radiusMeters?: number) => void;
  clearBubble: () => void;
  cacheLocations: (locations: { id?: string; name: string; latitude: number; longitude: number }[]) => void;
  cacheCurrentView: () => void;
  clearTileCache: (styleId?: string) => void;
  refreshCacheStats: (styleId?: string) => void;
  invalidateSize: () => void;
  updateSmartConfig: (config: SmartCacheConfig) => void;
}

export interface MapViewportInfo {
  center: { lat: number; lng: number };
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: number;
}

interface MapViewProps {
  currentUserId: string;
  members: MemberData[];
  myPosition?: { latitude: number; longitude: number; heading: number } | null;
  isInCircle?: boolean;
  mapStyle?: MapStyleConfig;
  smartConfig?: SmartCacheConfig;
  onMemberPress?: (member: MemberData) => void;
  onMapPress?: (coords?: { latitude: number; longitude: number }) => void;
  nicknames?: Record<string, string>;
  selectedMemberId?: string | null;
  places?: any[];
  onViewportChange?: (viewport: MapViewportInfo) => void;
  onCacheStatsUpdated?: (stats: CacheStats) => void;
  onCacheProgress?: (progress: CacheProgress) => void;
}

function getMemberBubbleInfo(m: MemberData): { icon: string; text: string } {
  if (m.inBubble) {
    const km = Math.round((m.bubbleRadius || 2000) / 1000);
    return { icon: '🫧', text: `In Bubble (~${km}km)` };
  }
  if (m.isMoving) {
    return { icon: '🚗', text: `${Math.round(m.speed)} km/h` };
  }
  const sinceTime = m.stationarySince || m.lastLocationTime || m.lastOnlineAt || new Date();
  const diffMs = Date.now() - sinceTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffMinutes < 1) {
    return { icon: '📍', text: 'Just arrived' };
  } else if (diffMinutes < 60) {
    return { icon: '📍', text: `${diffMinutes}m ago` };
  } else if (diffHours < 24) {
    const remMins = diffMinutes % 60;
    const dur = remMins > 0 ? `${diffHours} hrs, ${remMins} min` : `${diffHours} hrs`;
    return { icon: '📍', text: `here for ${dur}` };
  } else {
    const days = Math.floor(diffHours / 24);
    return { icon: '📍', text: `${days}d ago` };
  }
}

function generateLeafletHtml(
  tileUrl: string,
  subdomains: string[],
  initialLat = 20.5937,
  initialLng = 78.9629,
  initialZoom = 14,
  initialHeading = 0,
  hasInitialPosition = false,
  styleId = 'detailedOsm',
  initialMaxLimitMB = 0,
  initialIsInCircle = false
): string {
  const subdomainsStr = JSON.stringify(subdomains);
  const isDarkInitial = styleId.toLowerCase().includes('dark') || tileUrl.toLowerCase().includes('dark');
  const initialBg = isDarkInitial ? '#090D16' : '#F1F5F9';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js';"></script>
  <style>
    html, body, #map {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: ${initialBg};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .leaflet-control-attribution { display: none !important; }
    .leaflet-control-zoom { display: none !important; }

    /* Custom Leaflet Marker Container with Silky Gliding Transitions (Life360 style) */
    .custom-leaflet-marker {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
      transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
      will-change: transform;
    }
    .current-loc-leaflet-marker {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
      transition: transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) !important;
      will-change: transform;
    }

    /* Avatar Marker Styling */
    .marker-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      user-select: none;
      transform: translate3d(0, 0, 0);
      transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
      position: relative;
    }
    .marker-wrapper:active {
      transform: scale(0.92);
    }

    /* Floating Speech Bubble Callout */
    .callout-bubble {
      position: relative;
      background: #FFFFFF;
      border-radius: 14px;
      padding: 5px 11px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 7px;
      border: 1px solid rgba(0, 0, 0, 0.06);
      pointer-events: none;
    }
    .callout-bubble::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #FFFFFF;
    }
    .callout-icon {
      font-size: 13px;
      display: inline-block;
      transform-origin: center bottom;
      vertical-align: middle;
    }
    .callout-text {
      font-size: 11px;
      font-weight: 700;
      color: #1E293B;
    }

    .callout-bubble.is-moving {
      border-color: rgba(99, 102, 241, 0.35);
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.22);
    }

    @keyframes emojiWalk {
      0%, 100% { transform: translateY(0) rotate(-6deg); }
      50% { transform: translateY(-3.5px) rotate(6deg); }
    }
    .emoji-anim-walking {
      animation: emojiWalk 0.75s ease-in-out infinite;
      display: inline-block;
    }

    @keyframes emojiRun {
      0%, 100% { transform: translateY(0) rotate(10deg); }
      50% { transform: translateY(-5px) rotate(16deg) scale(1.08); }
    }
    .emoji-anim-running {
      animation: emojiRun 0.42s ease-in-out infinite;
      display: inline-block;
    }

    @keyframes emojiCycle {
      0%, 100% { transform: translateY(0) rotate(-4deg); }
      25% { transform: translateY(-2.5px) rotate(3deg); }
      50% { transform: translateY(1px) rotate(-3deg); }
      75% { transform: translateY(-2px) rotate(2deg); }
    }
    .emoji-anim-cycling {
      animation: emojiCycle 0.55s ease-in-out infinite;
      display: inline-block;
    }

    @keyframes emojiDrive {
      0%, 100% { transform: translate(0, 0); }
      25% { transform: translate(1px, -1px); }
      50% { transform: translate(0, 1px); }
      75% { transform: translate(-1px, -0.5px); }
    }
    .emoji-anim-driving {
      animation: emojiDrive 0.22s ease-in-out infinite;
      display: inline-block;
    }

    @keyframes emojiHighSpeed {
      0%, 100% { transform: translateX(0) scale(1); }
      25% { transform: translateX(2.5px) scale(1.08); }
      50% { transform: translateX(-2px) scale(0.96); }
      75% { transform: translateX(2px) scale(1.05); }
    }
    .emoji-anim-highspeed {
      animation: emojiHighSpeed 0.16s ease-in-out infinite;
      display: inline-block;
    }

    /* Avatar Halo Circle */
    .avatar-halo {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3.5px solid #FFFFFF;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      position: relative;
      font-weight: 800;
      color: #FFFFFF;
      font-size: 16px;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
    }
    .avatar-halo.is-selected {
      border-color: #007AFF !important;
      box-shadow: 0 0 0 5px rgba(0, 122, 255, 0.45), 0 8px 24px rgba(0, 122, 255, 0.55) !important;
      transform: scale(1.12);
      z-index: 100;
    }
    .avatar-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .avatar-initials {
      color: #FFFFFF;
      font-weight: 800;
      font-size: 16px;
      text-transform: uppercase;
    }

    /* Battery Badge attached to avatar */
    .avatar-battery-pill {
      position: absolute;
      bottom: -4px;
      right: -8px;
      background: #FFFFFF;
      border-radius: 9px;
      padding: 1px 5px;
      display: flex;
      align-items: center;
      gap: 2px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.22);
      font-size: 9px;
      font-weight: 800;
      color: #1E293B;
      border: 1px solid #E2E8F0;
      z-index: 5;
    }

    /* Name Tag below avatar */
    .avatar-name-pill {
      margin-top: 4px;
      background: rgba(15, 23, 42, 0.88);
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 10px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      white-space: nowrap;
      pointer-events: none;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ========================================================
       CARERING DISTINCTIVE CO-LOCATION CLUSTER & CALLOUT
       ======================================================== */
    .carering-cluster-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      user-select: none;
      position: relative;
      transform: translate3d(0, 0, 0);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .carering-cluster-wrapper:active {
      transform: scale(0.96);
    }

    /* Floating Glass Callout Pill */
    .carering-callout-pill {
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 5px 12px 5px 8px;
      box-shadow: 0 4px 16px rgba(124, 58, 237, 0.20), 0 1px 3px rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      gap: 7px;
      white-space: nowrap;
      margin-bottom: 7px;
      border: 1.5px solid rgba(124, 58, 237, 0.20);
      position: relative;
      pointer-events: none;
    }
    .carering-callout-emoji {
      font-size: 17px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .carering-callout-texts {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      text-align: left;
    }
    .carering-callout-title {
      font-size: 11px;
      font-weight: 800;
      color: #0F172A;
    }
    .carering-callout-sub {
      font-size: 10px;
      font-weight: 600;
      color: #7C3AED;
    }

    /* =========================================================================
       LIFE360 CLUSTER STYLING (ZOOM-IN GRID & ZOOM-OUT 1-FACE + N)
    ========================================================================= */
    .life360-cluster-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      user-select: none;
      position: relative;
    }

    /* Top Arrival / Place Callout Pill (matches user screenshot) */
    .life360-cluster-callout {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: #FFFFFF;
      border-radius: 18px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
      border: 1px solid rgba(0, 0, 0, 0.06);
      margin-bottom: 6px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 20;
    }
    .life360-callout-icon {
      font-size: 16px;
      line-height: 1;
    }
    .life360-callout-text-col {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      text-align: left;
    }
    .life360-callout-title {
      font-size: 11px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.2px;
    }
    .life360-callout-time {
      font-size: 9.5px;
      font-weight: 600;
      color: #64748B;
      margin-top: 1px;
    }

    /* LIFE360 CLUSTER POD (Matches user screenshots Image 1 & 2) */
    .cluster-bubble-pod {
      position: relative;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #FFFFFF;
      border-radius: 26px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 15;
    }
    .cluster-bubble-pod::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #FFFFFF;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.18));
    }
    .cluster-faces-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .cluster-faces-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 3px;
    }
    .cluster-face-cell {
      position: relative;
      cursor: pointer;
      user-select: none;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .cluster-face-cell:hover, .cluster-face-cell:active {
      transform: scale(1.15);
      z-index: 25 !important;
    }
    .cluster-face-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #E2E8F0;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      border-width: 3px;
      border-style: solid;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    /* White borders for non-selected members */
    .cluster-face-circle.ring-white {
      border-color: #FFFFFF;
    }
    /* Bold Purple border for the currently-selected member */
    .cluster-face-circle.ring-purple {
      border-color: #8B5CF6;
      border-width: 3.5px;
      box-shadow: 0 0 0 2px #FFFFFF, 0 0 16px rgba(139, 92, 246, 0.95);
    }
    .cluster-face-cell.is-selected {
      transform: scale(1.1);
      z-index: 30 !important;
    }
    .cluster-face-more {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #8B5CF6;
      border: 3px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    .cluster-spotlight-cone {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      width: 70px;
      height: 82px;
      background: linear-gradient(to bottom, rgba(139, 92, 246, 0.40), rgba(139, 92, 246, 0.02));
      clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
      pointer-events: none;
      z-index: 10;
    }

    /* Fallback Grid Pod */
    .life360-grid-pod {
      background: #FFFFFF;
      border-radius: 22px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.26);
      border: 2px solid #FFFFFF;
      position: relative;
      z-index: 15;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .life360-grid-pod::after {
      content: '';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid #FFFFFF;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.15));
    }

    /* Grid Layouts inside Pod */
    .life360-faces-grid {
      display: grid;
      gap: 3px;
      background: transparent;
    }
    .life360-faces-grid.grid-2 {
      grid-template-columns: repeat(2, 42px);
    }
    .life360-faces-grid.grid-3 {
      grid-template-columns: repeat(2, 40px);
    }
    .life360-faces-grid.grid-4, .life360-faces-grid.grid-many {
      grid-template-columns: repeat(2, 40px);
    }

    /* Face Cell */
    .life360-face-cell {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: pointer;
      background: #E2E8F0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.8);
      transition: transform 0.15s ease;
    }
    .life360-face-cell:hover, .life360-face-cell:active {
      transform: scale(1.12);
      z-index: 25;
    }
    .life360-face-cell.grid-3-last {
      grid-column: 1 / -1;
      justify-self: center;
    }
    .life360-face-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .life360-face-initials {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .life360-face-more {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #7C3AED;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    }

    /* MODE 2: ZOOMED-OUT POD (1 Face + N Badge) */
    .life360-compact-pod {
      position: relative;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      border: 3px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 15;
    }
    .life360-compact-pod::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid #FFFFFF;
    }
    .life360-compact-avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #E2E8F0;
    }
    .life360-plus-badge {
      position: absolute;
      bottom: -3px;
      right: -6px;
      background: #7C3AED;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      padding: 1.5px 6px;
      border-radius: 10px;
      border: 2px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      z-index: 20;
      line-height: 1.2;
    }

    /* Coordinate Pin Dot / Pulse under beak */
    .life360-pin-dot {
      width: 7px;
      height: 7px;
      border-radius: 4px;
      background: #7C3AED;
      margin-top: 10px;
      box-shadow: 0 0 6px #7C3AED;
    }

    /* Directional Radar Flashlight Beam */
    .carering-radar-beam, .life360-radar-beam {
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -75px;
      margin-top: -4px;
      width: 150px;
      height: 140px;
      pointer-events: none;
      transform-origin: 75px 0px;
      z-index: 1;
    }
    .cluster-summary-pill {
      margin-top: 3px;
      background: rgba(15, 23, 42, 0.94);
      color: #FFFFFF;
      font-size: 10.5px;
      font-weight: 800;
      padding: 2.5px 8px;
      border-radius: 12px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .cluster-summary-pill .cluster-icon {
      font-size: 10px;
    }

    /* Spiderfy Center Anchor Pin */
    .spiderfy-center-anchor {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #EF4444;
      border: 2px solid #FFFFFF;
      box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transform: translate3d(0, 0, 0);
      transition: transform 0.15s ease;
    }
    .spiderfy-center-anchor:active {
      transform: scale(0.9);
    }



    /* Current Location Radar Marker */
    .current-location-marker {
      width: 60px;
      height: 60px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .radar-pulse {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #007AFF;
      opacity: 0.6;
      animation: pulseWave 2s infinite ease-out;
    }
    @keyframes pulseWave {
      0% { transform: scale(0.8); opacity: 0.6; }
      70% { opacity: 0.25; }
      100% { transform: scale(2.8); opacity: 0; }
    }
    .accuracy-halo {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0, 122, 255, 0.2);
      border: 1px solid rgba(0, 122, 255, 0.35);
    }
    .white-ring {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 2px 8px rgba(0, 122, 255, 0.45), 0 1px 3px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .blue-dot-core {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #007AFF;
      box-shadow: inset 0 1px 2px rgba(255,255,255,0.4);
    }
    .heading-beam {
      position: absolute;
      top: -14px;
      width: 0;
      height: 0;
      border-left: 14px solid transparent;
      border-right: 14px solid transparent;
      border-bottom: 28px solid rgba(0, 122, 255, 0.4);
      transform-origin: center 44px;
    }

    /* Floating Emoji Reactions */
    @keyframes emojiFloatUp {
      0% {
        opacity: 1;
        transform: translateY(0) scale(0.6);
      }
      35% {
        opacity: 1;
        transform: translateY(-30px) scale(1.4) rotate(-6deg);
      }
      70% {
        opacity: 0.9;
        transform: translateY(-65px) scale(1.6) rotate(8deg);
      }
      100% {
        opacity: 0;
        transform: translateY(-100px) scale(1.8) rotate(-4deg);
      }
    }
    .floating-emoji {
      position: absolute;
      font-size: 28px;
      pointer-events: none;
      animation: emojiFloatUp 2s ease-out forwards;
      z-index: 9999;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    var AVATAR_PALETTE = [
      '#744BE4', '#2563EB', '#059669', '#D97706', '#DC2626',
      '#9333EA', '#0891B2', '#EA580C', '#4F46E5', '#BE185D'
    ];

    function getAvatarColor(name) {
      if (!name || !name.trim()) return AVATAR_PALETTE[0];
      var hash = 0;
      for (var i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
    }

    function handleAvatarImgError(img) {
      try {
        img.style.display = 'none';
        if (img.nextElementSibling) {
          img.nextElementSibling.style.display = 'flex';
        }
      } catch (e) {}
    }

    var map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: ${initialZoom},
      zoomControl: false,
      attributionControl: false
    });

    function postToReactNative(type, data) {
      var msg = JSON.stringify({ type: type, data: data });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(msg, '*');
      }
    }

    // -------------------------------------------------------------
    // OFFLINE RASTER TILE CACHE ENGINE (IndexedDB + Leaflet)
    // Isolated per Map Style ID (e.g. CareRing_Tiles_detailedOsm)
    // -------------------------------------------------------------
    var STORE_NAME = 'raster_tiles';
    var activeStyleId = '${styleId}';
    var dbInstances = {};

    function getDBName(sId) {
      var id = sId || activeStyleId || 'detailedOsm';
      return 'CareRing_Tiles_' + id;
    }

    function openTileDB(sId) {
      var targetStyle = sId || activeStyleId || 'detailedOsm';
      var dbName = getDBName(targetStyle);
      if (dbInstances[targetStyle]) return Promise.resolve(dbInstances[targetStyle]);
      return new Promise(function(resolve) {
        try {
          if (!window.indexedDB) {
            resolve(null);
            return;
          }
          var req = window.indexedDB.open(dbName, 1);
          req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              var store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            }
          };
          req.onsuccess = function(e) {
            dbInstances[targetStyle] = e.target.result;
            resolve(dbInstances[targetStyle]);
          };
          req.onerror = function() {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    }

    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return '0 B';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    function calculateDBStats(sId) {
      var targetStyle = sId || activeStyleId || 'detailedOsm';
      return openTileDB(targetStyle).then(function(db) {
        if (!db) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B', styleId: targetStyle });
          return;
        }
        try {
          var tx = db.transaction(STORE_NAME, 'readonly');
          var store = tx.objectStore(STORE_NAME);
          var count = 0;
          var totalBytes = 0;
          var cursorReq = store.openCursor();
          cursorReq.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
              count++;
              totalBytes += (cursor.value.sizeBytes || 0);
              cursor.continue();
            } else {
              var formatted = formatBytes(totalBytes);
              postToReactNative('CACHE_STATS_UPDATED', {
                count: count,
                sizeBytes: totalBytes,
                formattedSize: formatted,
                styleId: targetStyle
              });
            }
          };
          cursorReq.onerror = function() {
            postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B', styleId: targetStyle });
          };
        } catch (err) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B', styleId: targetStyle });
        }
      });
    }

    var statsDebounceTimer = null;
    function scheduleStatsUpdate(sId) {
      var targetStyle = sId || activeStyleId;
      if (statsDebounceTimer) clearTimeout(statsDebounceTimer);
      statsDebounceTimer = setTimeout(function() {
        calculateDBStats(targetStyle);
      }, 700);
    }

    var maxCacheBytes = ${initialMaxLimitMB <= 0 ? 0 : initialMaxLimitMB * 1024 * 1024}; // 0 = Unlimited (no eviction quota)

    function smartPruneIfExceeded(db, sId) {
      if (!db) return;
      // If quota is 0 or negative, UNLIMITED caching is enabled - do not prune any offline tiles!
      if (!maxCacheBytes || maxCacheBytes <= 0) {
        return;
      }
      var targetStyle = sId || activeStyleId;
      try {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var totalBytes = 0;
        var nonProtected = [];

        var req = store.openCursor();
        req.onsuccess = function(e) {
          var cursor = e.target.result;
          if (cursor) {
            var val = cursor.value;
            totalBytes += (val.sizeBytes || 0);
            if (!val.priority || val.priority === 0) {
              nonProtected.push({
                key: val.key,
                size: val.sizeBytes || 0,
                score: (val.hitCount || 0) * 1000 + (val.timestamp || 0)
              });
            }
            cursor.continue();
          } else {
            if (totalBytes > maxCacheBytes && nonProtected.length > 0) {
              nonProtected.sort(function(a, b) { return a.score - b.score; });
              var deleteKeys = [];
              var freed = 0;
              var targetToFree = totalBytes - (maxCacheBytes * 0.8);
              for (var i = 0; i < nonProtected.length; i++) {
                deleteKeys.push(nonProtected[i].key);
                freed += nonProtected[i].size;
                if (freed >= targetToFree) break;
              }

              if (deleteKeys.length > 0) {
                var delTx = db.transaction(STORE_NAME, 'readwrite');
                var delStore = delTx.objectStore(STORE_NAME);
                deleteKeys.forEach(function(k) { delStore.delete(k); });
                delTx.oncomplete = function() {
                  scheduleStatsUpdate(targetStyle);
                };
              }
            }
          }
        };
      } catch (err) {}
    }

    function getCachedTile(key, sId) {
      var targetStyle = sId || activeStyleId;
      return openTileDB(targetStyle).then(function(db) {
        if (!db) return null;
        return new Promise(function(resolve) {
          try {
            var tx = db.transaction(STORE_NAME, 'readwrite');
            var store = tx.objectStore(STORE_NAME);
            var req = store.get(key);
            req.onsuccess = function() {
              var rec = req.result;
              if (rec) {
                rec.hitCount = (rec.hitCount || 1) + 1;
                rec.timestamp = Date.now();
                try { store.put(rec); } catch (_) {}
              }
              resolve(rec || null);
            };
            req.onerror = function() {
              resolve(null);
            };
          } catch (e) {
            resolve(null);
          }
        });
      });
    }

    function saveCachedTile(key, url, dataUrl, sizeBytes, z, x, y, priority, sId) {
      var targetStyle = sId || activeStyleId;
      return openTileDB(targetStyle).then(function(db) {
        if (!db) return;
        return new Promise(function(resolve) {
          try {
            var tx = db.transaction(STORE_NAME, 'readwrite');
            var store = tx.objectStore(STORE_NAME);
            store.put({
              key: key,
              url: url,
              dataUrl: dataUrl,
              sizeBytes: sizeBytes || 0,
              timestamp: Date.now(),
              hitCount: 1,
              priority: priority !== undefined ? priority : 0,
              z: z,
              x: x,
              y: y
            });
            tx.oncomplete = function() {
              scheduleStatsUpdate(targetStyle);
              smartPruneIfExceeded(db, targetStyle);
              resolve();
            };
            tx.onerror = function() {
              resolve();
            };
          } catch (e) {
            resolve();
          }
        });
      });
    }

    function clearTileCache(sId) {
      var targetStyle = sId || activeStyleId;
      return openTileDB(targetStyle).then(function(db) {
        if (!db) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B', styleId: targetStyle });
          return;
        }
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          store.clear();
          tx.oncomplete = function() {
            postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B', styleId: targetStyle });
          };
        } catch (e) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B', styleId: targetStyle });
        }
      });
    }

    function fetchAndSaveTile(url, key, z, x, y, priority, sId) {
      if (!url) return Promise.resolve(null);
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 8000) : null;
      var fetchOpts = { mode: 'cors' };
      if (controller) fetchOpts.signal = controller.signal;

      return fetch(url, fetchOpts)
        .then(function(res) {
          if (timeoutId) clearTimeout(timeoutId);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function(blob) {
          return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function() {
              var dataUrl = reader.result;
              saveCachedTile(key, url, dataUrl, blob.size, z, x, y, priority, sId);
              resolve(dataUrl);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        })
        .catch(function() {
          if (timeoutId) clearTimeout(timeoutId);
          return null;
        });
    }

    var OfflineTileLayer = L.TileLayer.extend({
      createTile: function(coords, done) {
        var tile = document.createElement('img');
        L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));

        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }
        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        var url = this.getTileUrl(coords);
        var sId = this.options.styleId || activeStyleId || '${styleId}';
        var tileKey = sId + '_' + coords.z + '_' + coords.x + '_' + coords.y;

        var isDarkArea = sId.toLowerCase().indexOf('dark') !== -1 || (activeTileUrl && activeTileUrl.toLowerCase().indexOf('dark') !== -1);
        var bgFill = isDarkArea ? '#090D16' : '#F1F5F9';
        var strokeCol = isDarkArea ? '#1E293B' : '#E2E8F0';
        var txtCol = isDarkArea ? '#475569' : '#94A3B8';
        var fallbackTileSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="' + bgFill + '" stroke="' + strokeCol + '" stroke-width="1"/><text x="128" y="128" text-anchor="middle" fill="' + txtCol + '" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Offline Area</text></svg>'
        );

        var hasRecovered = false;
        L.DomEvent.on(tile, 'error', function() {
          if (hasRecovered) return;
          hasRecovered = true;
          getCachedTile(tileKey, sId).then(function(cached) {
            if (cached && cached.dataUrl) {
              tile.src = cached.dataUrl;
            } else {
              tile.src = fallbackTileSvg;
            }
          }).catch(function() {
            tile.src = fallbackTileSvg;
          });
        });

        getCachedTile(tileKey, sId).then(function(cached) {
          if (cached && cached.dataUrl) {
            tile.src = cached.dataUrl;
          } else {
            tile.src = url;
            fetchAndSaveTile(url, tileKey, coords.z, coords.x, coords.y, 0, sId).catch(function() {});
          }
        }).catch(function() {
          tile.src = url;
        });

        return tile;
      }
    });

    var activeTileUrl = '${tileUrl}';
    var activeSubdomains = ${subdomainsStr};

    var currentTileLayer = new OfflineTileLayer(activeTileUrl, {
      subdomains: activeSubdomains,
      maxZoom: 19,
      styleId: '${styleId}',
      crossOrigin: 'anonymous'
    }).addTo(map);

    // Initial stats check on startup for active style
    calculateDBStats('${styleId}');

    var memberMarkers = {};
    var memberBubbleCircles = {};
    var renderedMemberLayers = [];
    var cachedMembers = [];
    var cachedCurrentUserId = null;
    var cachedIsInCircle = ${initialIsInCircle ? 'true' : 'false'};
    var expandedClusterKey = null;
    var myLocationMarker = null;
    var activeSelectedMemberId = null;
    var cachedPlaces = [];
    var activeRoutePolyline = null;
    var activeRouteMarkers = [];
    var activeBubbleCircle = null;
    var activeTimelineGroup = null;

    function getMemberPlace(m, places) {
      if (!places || places.length === 0 || !m || m.latitude == null || m.longitude == null) return null;
      var mLat = parseFloat(m.latitude);
      var mLng = parseFloat(m.longitude);
      if (isNaN(mLat) || isNaN(mLng)) return null;

      for (var i = 0; i < places.length; i++) {
        var p = places[i];
        var pLat = parseFloat(p.latitude);
        var pLng = parseFloat(p.longitude);
        if (isNaN(pLat) || isNaN(pLng)) continue;
        var radius = parseFloat(p.radius_meters || p.radiusMeters || p.radius) || 250;

        var dLat = (pLat - mLat) * Math.PI / 180;
        var dLng = (pLng - mLng) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(mLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var distMeters = 6371000 * c;
        if (distMeters <= radius) {
          return p;
        }
      }
      return null;
    }

    function getPlaceEmoji(category) {
      var cat = (category || '').toLowerCase();
      if (cat.indexOf('home') !== -1) return '🏠';
      if (cat.indexOf('office') !== -1 || cat.indexOf('work') !== -1) return '🏢';
      if (cat.indexOf('college') !== -1 || cat.indexOf('campus') !== -1) return '🎓';
      if (cat.indexOf('school') !== -1) return '🏫';
      if (cat.indexOf('gym') !== -1 || cat.indexOf('fitness') !== -1) return '🏋️';
      if (cat.indexOf('trip') !== -1 || cat.indexOf('camp') !== -1) return '⛺';
      if (cat.indexOf('cafe') !== -1 || cat.indexOf('coffee') !== -1) return '☕';
      return '📍';
    }

    map.on('click', function(e) {
      if (expandedClusterKey) {
        expandedClusterKey = null;
        if (typeof reclusterAndRender === 'function') reclusterAndRender();
      }
      postToReactNative('MAP_CLICKED', {
        lat: e && e.latlng ? e.latlng.lat : undefined,
        lng: e && e.latlng ? e.latlng.lng : undefined
      });
    });

    map.on('zoomstart', function() {
      if (expandedClusterKey) {
        expandedClusterKey = null;
      }
    });

    function postViewport() {
      try {
        var c = map.getCenter();
        var b = map.getBounds();
        postToReactNative('MAP_VIEWPORT_CHANGED', {
          center: { lat: c.lat, lng: c.lng },
          bounds: {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest()
          },
          zoom: map.getZoom()
        });
      } catch (e) {}
    }

    map.on('moveend', function() {
      postViewport();
      if (typeof reclusterAndRender === 'function') reclusterAndRender();
    });

    map.on('zoomend', function() {
      postViewport();
      if (typeof reclusterAndRender === 'function') reclusterAndRender();
    });

    function setTileLayer(url, subdomains, customStyleId) {
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      activeTileUrl = url;
      activeSubdomains = subdomains || ['a', 'b', 'c', 'd'];
      activeStyleId = customStyleId || 'detailedOsm';
      var sId = activeStyleId;
      var isDark = sId.toLowerCase().indexOf('dark') !== -1 || url.toLowerCase().indexOf('dark') !== -1;

      currentTileLayer = new OfflineTileLayer(url, {
        subdomains: activeSubdomains,
        maxZoom: 19,
        styleId: sId,
        crossOrigin: 'anonymous'
      }).addTo(map);

      document.body.style.backgroundColor = isDark ? '#090D16' : '#F1F5F9';
      var mapElem = document.getElementById('map');
      if (mapElem) mapElem.style.backgroundColor = isDark ? '#090D16' : '#F1F5F9';

      calculateDBStats(sId);
    }

    function lon2tile(lon, zoom) {
      return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    }

    function lat2tile(lat, zoom) {
      var clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
      var rad = clamped * Math.PI / 180;
      return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom));
    }

    function precacheLocations(locationsList) {
      if (!locationsList || !locationsList.length) return;

      var zooms = [13, 14, 15, 16];
      var queue = [];
      var seen = {};

      locationsList.forEach(function(loc) {
        if (!loc.latitude || !loc.longitude) return;
        zooms.forEach(function(z) {
          var cx = lon2tile(loc.longitude, z);
          var cy = lat2tile(loc.latitude, z);
          for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
              var tx = cx + dx;
              var ty = cy + dy;
              var activeSId = (currentTileLayer && currentTileLayer.options && currentTileLayer.options.styleId) || '${styleId}';
              var k = activeSId + '_' + z + '_' + tx + '_' + ty;
              if (!seen[k]) {
                seen[k] = true;
                var sub = (activeSubdomains && activeSubdomains.length > 0)
                  ? activeSubdomains[Math.abs(tx + ty) % activeSubdomains.length]
                  : '';
                var u = activeTileUrl
                  .replace('{s}', sub)
                  .replace('{z}', z)
                  .replace('{x}', tx)
                  .replace('{y}', ty);
                queue.push({
                  key: k,
                  url: u,
                  z: z,
                  x: tx,
                  y: ty,
                  locationName: loc.name || 'Location'
                });
              }
            }
          }
        });
      });

      var total = queue.length;
      var completed = 0;
      var activeCount = 0;
      var maxParallel = 2; // Throttled to 2 concurrent requests to avoid provider HTTP 429 bans

      postToReactNative('CACHE_PROGRESS', {
        current: 0,
        total: total,
        locationName: 'Preparing ' + locationsList.length + ' frequent locations...',
        isDone: false
      });

      function step() {
        if (queue.length === 0) {
          if (activeCount === 0) {
            calculateDBStats(activeSId);
            postToReactNative('CACHE_PROGRESS', {
              current: total,
              total: total,
              locationName: 'All frequent locations cached!',
              isDone: true
            });
          }
          return;
        }

        while (activeCount < maxParallel && queue.length > 0) {
          (function() {
            var item = queue.shift();
            activeCount++;

            getCachedTile(item.key, activeSId).then(function(existing) {
              if (existing && existing.dataUrl) {
                completed++;
                activeCount--;
                postToReactNative('CACHE_PROGRESS', {
                  current: completed,
                  total: total,
                  locationName: item.locationName,
                  isDone: completed >= total
                });
                setTimeout(step, 20);
              } else {
                fetchAndSaveTile(item.url, item.key, item.z, item.x, item.y, 2, activeSId)
                  .then(function() {
                    completed++;
                    activeCount--;
                    postToReactNative('CACHE_PROGRESS', {
                      current: completed,
                      total: total,
                      locationName: item.locationName,
                      isDone: completed >= total
                    });
                    setTimeout(step, 30);
                  })
                  .catch(function() {
                    completed++;
                    activeCount--;
                    postToReactNative('CACHE_PROGRESS', {
                      current: completed,
                      total: total,
                      locationName: item.locationName,
                      isDone: completed >= total
                    });
                    setTimeout(step, 30);
                  });
              }
            });
          })();
        }
      }

      step();
    }

    function cacheCurrentViewport() {
      var bounds = map.getBounds();
      var currentZoom = map.getZoom();
      var targetZooms = [currentZoom, Math.min(18, currentZoom + 1)];

      var queue = [];
      var seen = {};

      var activeSId = (currentTileLayer && currentTileLayer.options && currentTileLayer.options.styleId) || activeStyleId || '${styleId}';

      targetZooms.forEach(function(z) {
        var x1 = lon2tile(bounds.getWest(), z);
        var x2 = lon2tile(bounds.getEast(), z);
        var y1 = lat2tile(bounds.getNorth(), z);
        var y2 = lat2tile(bounds.getSouth(), z);
        var minX = Math.min(x1, x2);
        var maxX = Math.max(x1, x2);
        var minY = Math.min(y1, y2);
        var maxY = Math.max(y1, y2);

        for (var x = minX; x <= maxX; x++) {
          for (var y = minY; y <= maxY; y++) {
            var k = activeSId + '_' + z + '_' + x + '_' + y;
            if (!seen[k]) {
              seen[k] = true;
              var sub = (activeSubdomains && activeSubdomains.length > 0)
                ? activeSubdomains[Math.abs(x + y) % activeSubdomains.length]
                : '';
              var u = activeTileUrl
                .replace('{s}', sub)
                .replace('{z}', z)
                .replace('{x}', x)
                .replace('{y}', y);
              queue.push({ key: k, url: u, z: z, x: x, y: y, locationName: 'Current View Area' });
            }
          }
        }
      });

      var total = queue.length;
      var completed = 0;
      var activeCount = 0;
      var maxParallel = 2; // Throttled to 2 concurrent requests to avoid provider HTTP 429 bans

      postToReactNative('CACHE_PROGRESS', {
        current: 0,
        total: total,
        locationName: 'Downloading current view area...',
        isDone: false
      });

      function step() {
        if (queue.length === 0) {
          if (activeCount === 0) {
            calculateDBStats(activeSId);
            postToReactNative('CACHE_PROGRESS', {
              current: total,
              total: total,
              locationName: 'Current view area cached!',
              isDone: true
            });
          }
          return;
        }

        while (activeCount < maxParallel && queue.length > 0) {
          (function() {
            var item = queue.shift();
            activeCount++;

            getCachedTile(item.key, activeSId).then(function(existing) {
              if (existing && existing.dataUrl) {
                completed++;
                activeCount--;
                postToReactNative('CACHE_PROGRESS', {
                  current: completed,
                  total: total,
                  locationName: item.locationName,
                  isDone: completed >= total
                });
                setTimeout(step, 20);
              } else {
                fetchAndSaveTile(item.url, item.key, item.z, item.x, item.y, 1, activeSId)
                  .then(function() {
                    completed++;
                    activeCount--;
                    postToReactNative('CACHE_PROGRESS', {
                      current: completed,
                      total: total,
                      locationName: item.locationName,
                      isDone: completed >= total
                    });
                    setTimeout(step, 30);
                  })
                  .catch(function() {
                    completed++;
                    activeCount--;
                    postToReactNative('CACHE_PROGRESS', {
                      current: completed,
                      total: total,
                      locationName: item.locationName,
                      isDone: completed >= total
                    });
                    setTimeout(step, 30);
                  });
              }
            });
          })();
        }
      }

      step();
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function getActivityDetails(speed, isMoving) {
      if (!isMoving || speed < 1.8) {
        return { type: 'stationary', emoji: '🧍', label: 'Stationary', animClass: '' };
      }
      if (speed < 7.5) {
        return { type: 'walking', emoji: '🚶', label: 'Walking', animClass: 'emoji-anim-walking' };
      }
      if (speed < 16.0) {
        return { type: 'running', emoji: '🏃', label: 'Running', animClass: 'emoji-anim-running' };
      }
      if (speed < 32.0) {
        return { type: 'cycling', emoji: '🚴', label: 'Cycling', animClass: 'emoji-anim-cycling' };
      }
      if (speed < 85.0) {
        return { type: 'driving', emoji: '🚗', label: 'Driving', animClass: 'emoji-anim-driving' };
      }
      return { type: 'high_speed', emoji: '🏎️', label: 'Highway Speed', animClass: 'emoji-anim-highspeed' };
    }

    function createMemberHtml(m) {
      var nickname = (m.nickname && m.nickname.trim()) ? m.nickname.trim() : '';
      var rawName = (m.fullName && m.fullName.trim()) ? m.fullName.trim() : 'Family';
      var firstName = rawName.split(' ')[0];
      var displayName = escapeHtml(nickname ? nickname : firstName);
      var initials = escapeHtml(m.initials || 'U');
      var bgColor = getAvatarColor(m.fullName);
      var speedNum = (typeof m.speed === 'number' && !isNaN(m.speed) && m.speed > 0) ? m.speed : 0;
      var isMovingNow = Boolean(m.isMoving || (speedNum >= 1.8 && !m.isStationary));
      var act = getActivityDetails(speedNum, isMovingNow);
      var ringColor = m.inBubble ? '#8B5CF6' : (m.isOnline ? (isMovingNow ? '#10B981' : '#4F46E5') : '#94A3B8');
      var namePrefix = m.inBubble ? '🫧 ' : '';

      var matchedPlace = getMemberPlace(m, cachedPlaces);
      var isAtHome = false;
      if (matchedPlace) {
        var pName = (matchedPlace.name || matchedPlace.category || '').toLowerCase();
        if (pName.indexOf('home') !== -1 || (matchedPlace.category && matchedPlace.category.toLowerCase().indexOf('home') !== -1)) {
          isAtHome = true;
        }
      } else if (!isMovingNow) {
        var addr = (m.resolvedAddress || '').toLowerCase();
        if (addr.indexOf('home') !== -1 || addr.indexOf('residence') !== -1 || addr.indexOf('apartment') !== -1 || addr.indexOf('house') !== -1 || !addr) {
          isAtHome = true;
        }
      }

      var bubbleIcon = m.bubbleIcon;
      var bubbleText = m.bubbleText;
      var iconAnimClass = '';

      if (isMovingNow) {
        bubbleIcon = act.emoji;
        bubbleText = escapeHtml(act.label + ' • ' + Math.round(speedNum) + ' km/h');
        iconAnimClass = act.animClass;
      } else {
        if (!bubbleIcon) {
          bubbleIcon = isAtHome ? '🏠' : (matchedPlace ? getPlaceEmoji(matchedPlace.category) : '📍');
        }
        if (!bubbleText) {
          bubbleText = escapeHtml(isAtHome ? 'At home' : (matchedPlace ? ('At ' + (matchedPlace.name || 'Place')) : (m.resolvedAddress || 'Family Member')));
        }
      }

      var avatarInner = '';
      if (m.avatarUrl && m.avatarUrl.trim().length > 0) {
        avatarInner = '<img src="' + m.avatarUrl + '" class="avatar-img" onerror="handleAvatarImgError(this)" />' +
                      '<div class="avatar-initials" style="display:none; width:100%; height:100%; background:' + bgColor + '; align-items:center; justify-content:center;">' + initials + '</div>';
      } else {
        avatarInner = '<div class="avatar-initials" style="width:100%; height:100%; background:' + bgColor + '; display:flex; align-items:center; justify-content:center;">' + initials + '</div>';
      }

      var isSelected = (activeSelectedMemberId && m.id === activeSelectedMemberId);
      var haloRingColor = isSelected ? '#007AFF' : ringColor;
      var haloClass = 'avatar-halo' + (isSelected ? ' is-selected' : '');

      var heading = null;
      if (typeof m.heading === 'number' && !isNaN(m.heading) && m.heading > 0) {
        heading = m.heading;
      } else if (isMovingNow) {
        heading = 190;
      }

      var radarHtml = '';
      if (heading != null) {
        var gradId = 'memRadarGrad_' + escapeHtml(m.id);
        radarHtml = '<div class="carering-radar-beam" style="transform: rotate(' + heading + 'deg);">' +
                      '<svg width="150" height="140" viewBox="0 0 150 140" style="overflow:visible;">' +
                        '<defs>' +
                          '<radialGradient id="' + gradId + '" cx="50%" cy="0%" r="100%">' +
                            '<stop offset="0%" stop-color="#7C3AED" stop-opacity="0.55" />' +
                            '<stop offset="55%" stop-color="#8B5CF6" stop-opacity="0.22" />' +
                            '<stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.22" />' +
                          '</radialGradient>' +
                        '</defs>' +
                        '<polygon points="75,0 12,140 138,140" fill="url(#' + gradId + ')" />' +
                      '</svg>' +
                    '</div>';
      }

      return '<div class="marker-wrapper">' +
               radarHtml +
               '<div class="callout-bubble' + (isMovingNow ? ' is-moving' : '') + '">' +
                 '<span class="callout-icon ' + iconAnimClass + '">' + bubbleIcon + '</span>' +
                 '<span class="callout-text">' + bubbleText + '</span>' +
               '</div>' +
               '<div class="' + haloClass + '" style="border-color:' + haloRingColor + ';">' +
                 '<div class="avatar-inner">' + avatarInner + '</div>' +
               '</div>' +
               '<div class="avatar-name-pill">' + namePrefix + displayName + '</div>' +
             '</div>';
    }

    function formatMemberTime(m) {
      if (!m) return { title: 'arrived', time: 'Just arrived', icon: '🏠', animClass: '' };
      var spd = (typeof m.speed === 'number' && !isNaN(m.speed)) ? Math.round(m.speed) : 0;
      var isMovingNow = Boolean(m.isMoving || (spd >= 1.8 && !m.isStationary));
      if (isMovingNow) {
        var act = getActivityDetails(spd, true);
        return { title: act.label, time: spd + ' km/h', icon: act.emoji, animClass: act.animClass };
      }

      var matchedPlace = getMemberPlace(m, cachedPlaces);
      var isAtHome = false;
      if (matchedPlace) {
        var pName = (matchedPlace.name || matchedPlace.category || '').toLowerCase();
        if (pName.indexOf('home') !== -1 || (matchedPlace.category && matchedPlace.category.toLowerCase().indexOf('home') !== -1)) {
          isAtHome = true;
        }
      } else if (!isMovingNow) {
        var addr = (m.resolvedAddress || '').toLowerCase();
        if (addr.indexOf('home') !== -1 || addr.indexOf('residence') !== -1 || addr.indexOf('apartment') !== -1 || addr.indexOf('house') !== -1 || !addr) {
          isAtHome = true;
        }
      }

      var placeEmoji = isAtHome ? '🏠' : (matchedPlace ? getPlaceEmoji(matchedPlace.category) : '📍');
      var placeName = isAtHome ? 'At home' : (matchedPlace ? ('At ' + (matchedPlace.name || 'Home')) : 'At home');

      var sinceTime = null;
      if (m.stationarySince) {
        var parsed = new Date(m.stationarySince);
        if (!isNaN(parsed.getTime())) sinceTime = parsed;
      }
      var diffMs = sinceTime ? Math.max(0, Date.now() - sinceTime.getTime()) : 0;
      var diffMinutes = Math.floor(diffMs / (1000 * 60));
      var diffHours = Math.floor(diffMinutes / 60);

      var timeText = 'Just now';
      var title = '';
      if (diffMinutes < 1) {
        timeText = 'Just arrived';
      } else if (diffMinutes >= 1 && diffMinutes < 60) {
        timeText = diffMinutes + ' minutes ago';
        title = '';
      } else if (diffHours >= 1 && diffHours < 24) {
        var remMins = diffMinutes % 60;
        timeText = remMins > 0 ? (diffHours + ' hrs, ' + remMins + ' min') : (diffHours + ' hours');
        title = 'here for';
      } else if (diffHours >= 24) {
        var days = Math.floor(diffHours / 24);
        timeText = days + (days === 1 ? ' day' : ' days');
        title = 'here for';
      }

      var nameStr = (m.nickname && m.nickname.trim()) ? m.nickname.trim() : ((m.fullName || 'Member').trim());
      var firstName = (m.nickname && m.nickname.trim()) ? m.nickname.trim() : (nameStr.split(' ')[0] || 'Member');
      if (!isAtHome && !title) {
        title = firstName + ' arrived';
      }

      return { title: title, time: timeText, icon: placeEmoji, placeName: placeName, animClass: '' };
    }

    function renderLife360FaceCell(m, isLastOf3) {
      if (!m) return '';
      var name = escapeHtml((m.fullName && m.fullName.trim()) ? m.fullName.trim() : 'Member');
      var initials = escapeHtml(m.initials || name.charAt(0) || 'U');
      var bgColor = getAvatarColor(m.fullName);
      var extraClass = isLastOf3 ? ' grid-3-last' : '';

      var inner = '';
      if (m.avatarUrl && m.avatarUrl.trim().length > 0) {
        inner = '<img src="' + escapeHtml(m.avatarUrl) + '" class="life360-face-img" onerror="handleAvatarImgError(this)" />' +
                '<div class="life360-face-initials" style="display:none;background:' + bgColor + ';">' + initials + '</div>';
      } else {
        inner = '<div class="life360-face-initials" style="background:' + bgColor + ';">' + initials + '</div>';
      }

      return '<div class="life360-face-cell' + extraClass + '" data-member-id="' + escapeHtml(m.id) + '" title="' + name + '">' +
               inner +
             '</div>';
    }

    function renderClusterFaceCell(m, isSelected) {
      if (!m) return '';
      var name = escapeHtml((m.fullName && m.fullName.trim()) ? m.fullName.trim() : 'Member');
      var initials = escapeHtml(m.initials || name.charAt(0) || 'U');
      var bgColor = getAvatarColor(m.fullName);
      var selClass = isSelected ? ' is-selected' : '';

      var inner = '';
      if (m.avatarUrl && m.avatarUrl.trim().length > 0) {
        inner = '<img src="' + escapeHtml(m.avatarUrl) + '" class="life360-face-img" onerror="handleAvatarImgError(this)" />' +
                '<div class="life360-face-initials" style="display:none;background:' + bgColor + ';">' + initials + '</div>';
      } else {
        inner = '<div class="life360-face-initials" style="background:' + bgColor + ';">' + initials + '</div>';
      }

      return '<div class="cluster-face-cell' + selClass + '" data-member-id="' + escapeHtml(m.id) + '" title="' + name + '">' +
               '<div class="cluster-face-circle' + (isSelected ? ' ring-purple' : ' ring-white') + '">' +
                 inner +
               '</div>' +
             '</div>';
    }

    function createClusterHtml(clusterMembers, currentUserId, currentZoom) {
      if (!clusterMembers || clusterMembers.length === 0) return '';
      var count = clusterMembers.length;
      var primary = null;
      if (activeSelectedMemberId) {
        for (var p = 0; p < clusterMembers.length; p++) {
          if (clusterMembers[p].id === activeSelectedMemberId) {
            primary = clusterMembers[p];
            break;
          }
        }
      }
      if (!primary) {
        for (var p = 0; p < clusterMembers.length; p++) {
          if (clusterMembers[p].id === currentUserId) {
            primary = clusterMembers[p];
            break;
          }
        }
      }
      if (!primary && clusterMembers.length > 0) primary = clusterMembers[0];
      var timeInfo = formatMemberTime(primary);

      // Callout Pill (matches user screenshot): "🏠 here for • 5 hrs, 2 min" or "🏠 2 minutes ago"
      var calloutHtml = '<div class="life360-cluster-callout">' +
                          '<span class="life360-callout-icon">' + timeInfo.icon + '</span>' +
                          '<div class="life360-callout-text-col">' +
                            (timeInfo.title ? '<div class="life360-callout-title">' + escapeHtml(timeInfo.title) + '</div>' : '') +
                            '<div class="life360-callout-time">' + escapeHtml(timeInfo.time) + '</div>' +
                          '</div>' +
                        '</div>';

      var isZoomedIn = (typeof currentZoom === 'number' ? currentZoom : 15) >= 12;

      if (isZoomedIn) {
        // MATCH USER SCREENSHOTS (Image 1 & Image 2):
        // Arrange members so selected member is placed at bottom-left (index 1 for 3, index 2 for 4)
        var orderedMembers = clusterMembers.slice();
        if (activeSelectedMemberId) {
          var selIdx = -1;
          for (var si = 0; si < orderedMembers.length; si++) {
            if (orderedMembers[si].id === activeSelectedMemberId) {
              selIdx = si;
              break;
            }
          }
          if (selIdx >= 0) {
            var selItem = orderedMembers.splice(selIdx, 1)[0];
            if (count === 3) {
              // 1 top, 2 bottom (Index 1 is bottom left)
              orderedMembers.splice(1, 0, selItem);
            } else if (count >= 4) {
              // 2 top, 2 bottom (Index 2 is bottom left)
              orderedMembers.splice(2, 0, selItem);
            } else {
              orderedMembers.unshift(selItem);
            }
          }
        }

        var topRowMembers = [];
        var bottomRowMembers = [];

        if (count === 2) {
          topRowMembers = [orderedMembers[0], orderedMembers[1]];
        } else if (count === 3) {
          // Exactly like Image 1: 1 centered on top, 2 on bottom!
          topRowMembers = [orderedMembers[0]];
          bottomRowMembers = [orderedMembers[1], orderedMembers[2]];
        } else if (count === 4) {
          // Exactly like Image 2: 2 on top, 2 on bottom!
          topRowMembers = [orderedMembers[0], orderedMembers[1]];
          bottomRowMembers = [orderedMembers[2], orderedMembers[3]];
        } else if (count === 5) {
          topRowMembers = [orderedMembers[0], orderedMembers[1]];
          bottomRowMembers = [orderedMembers[2], orderedMembers[3], orderedMembers[4]];
        } else {
          // 6 or more
          topRowMembers = [orderedMembers[0], orderedMembers[1]];
          bottomRowMembers = [orderedMembers[2], orderedMembers[3]];
        }

        var topRowHtml = '';
        for (var t = 0; t < topRowMembers.length; t++) {
          var itemT = topRowMembers[t];
          var isSelT = Boolean(activeSelectedMemberId && itemT && itemT.id === activeSelectedMemberId);
          topRowHtml += renderClusterFaceCell(itemT, isSelT);
        }

        var bottomRowHtml = '';
        for (var b = 0; b < bottomRowMembers.length; b++) {
          var itemB = bottomRowMembers[b];
          var isSelB = Boolean(activeSelectedMemberId && itemB && itemB.id === activeSelectedMemberId);
          bottomRowHtml += renderClusterFaceCell(itemB, isSelB);
        }
        if (count > 4) {
          bottomRowHtml += '<div class="cluster-face-cell" title="More members">' +
                             '<div class="cluster-face-more">+' + (count - 4) + '</div>' +
                           '</div>';
        }

        var facesContainerHtml = '<div class="cluster-faces-container">' +
                                   '<div class="cluster-faces-row">' + topRowHtml + '</div>' +
                                   (bottomRowHtml ? '<div class="cluster-faces-row">' + bottomRowHtml + '</div>' : '') +
                                 '</div>';

        var podHtml = '<div class="cluster-bubble-pod">' +
                        facesContainerHtml +
                        '<div class="cluster-spotlight-cone"></div>' +
                      '</div>';

        return '<div class="life360-cluster-wrapper zoomed-in">' +
                 calloutHtml +
                 podHtml +
               '</div>';
      } else {
        // MODE B: ZOOMED OUT (< 12) -> Show 1 person face + n badge (e.g. +3)
        var primaryName = escapeHtml((primary.fullName && primary.fullName.trim()) ? primary.fullName.trim() : 'Family');
        var primaryInitials = escapeHtml(primary.initials || primaryName.charAt(0) || 'U');
        var primaryBg = getAvatarColor(primary.fullName);

        var innerAvatar = '';
        if (primary.avatarUrl && primary.avatarUrl.trim().length > 0) {
          innerAvatar = '<img src="' + escapeHtml(primary.avatarUrl) + '" class="life360-face-img" onerror="handleAvatarImgError(this)" />' +
                        '<div class="life360-face-initials" style="display:none;background:' + primaryBg + ';">' + primaryInitials + '</div>';
        } else {
          innerAvatar = '<div class="life360-face-initials" style="background:' + primaryBg + ';">' + primaryInitials + '</div>';
        }

        var plusCount = count - 1;
        var badgeHtml = '<div class="life360-plus-badge">+' + plusCount + '</div>';

        var compactPodHtml = '<div class="life360-compact-pod" data-member-id="' + escapeHtml(primary.id) + '">' +
                               '<div class="life360-compact-avatar">' + innerAvatar + '</div>' +
                               badgeHtml +
                             '</div>';

        return '<div class="life360-cluster-wrapper zoomed-out">' +
                 calloutHtml +
                 compactPodHtml +
                 '<div class="life360-pin-dot"></div>' +
               '</div>';
      }
    }

    function computeClusters(members) {
      var validMembers = members.filter(function(m) {
        return m.latitude != null && m.longitude != null;
      });

      var clusters = [];
      var visited = {};
      var CLUSTER_PIXEL_RADIUS = 46;

      for (var i = 0; i < validMembers.length; i++) {
        var m1 = validMembers[i];
        if (visited[m1.id]) continue;

        var pt1 = null;
        try {
          pt1 = map.latLngToContainerPoint([m1.latitude, m1.longitude]);
        } catch (e) {}

        var currentCluster = [m1];
        visited[m1.id] = true;

        for (var j = i + 1; j < validMembers.length; j++) {
          var m2 = validMembers[j];
          if (visited[m2.id]) continue;

          var isClose = false;
          if (pt1 && !isNaN(pt1.x) && !isNaN(pt1.y)) {
            try {
              var pt2 = map.latLngToContainerPoint([m2.latitude, m2.longitude]);
              if (pt2 && !isNaN(pt2.x) && !isNaN(pt2.y)) {
                var dist = Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);
                if (dist <= CLUSTER_PIXEL_RADIUS) isClose = true;
              }
            } catch (e) {}
          }
          if (!isClose) {
            var dLat = Math.abs(m1.latitude - m2.latitude);
            var dLng = Math.abs(m1.longitude - m2.longitude);
            if (dLat < 0.00065 && dLng < 0.00065) isClose = true;
          }

          if (isClose) {
            currentCluster.push(m2);
            visited[m2.id] = true;
          }
        }

        var sumLat = 0, sumLng = 0;
        for (var k = 0; k < currentCluster.length; k++) {
          sumLat += parseFloat(currentCluster[k].latitude) || 0;
          sumLng += parseFloat(currentCluster[k].longitude) || 0;
        }
        var centerLat = sumLat / currentCluster.length;
        var centerLng = sumLng / currentCluster.length;

        var clusterKey = currentCluster.map(function(m) { return m.id; }).sort().join('_');

        clusters.push({
          key: clusterKey,
          members: currentCluster,
          center: [centerLat, centerLng]
        });
      }

      return clusters;
    }

    function reclusterAndRender() {
      try {
        // 1. Clean up previously rendered member layers
        if (renderedMemberLayers && renderedMemberLayers.length > 0) {
          renderedMemberLayers.forEach(function(l) {
            try { map.removeLayer(l); } catch (e) {}
          });
          renderedMemberLayers = [];
        }

        if (!cachedMembers || cachedMembers.length === 0) return;

        var validMembers = cachedMembers.filter(function(m) {
          return m && m.latitude != null && m.longitude != null && !isNaN(parseFloat(m.latitude)) && !isNaN(parseFloat(m.longitude));
        });

        // Maintain bubble geofence circles
        var activeIds = {};
        validMembers.forEach(function(m) {
          activeIds[m.id] = true;
          if (m.inBubble) {
            var bRadius = m.bubbleRadius || 2000;
            if (memberBubbleCircles[m.id]) {
              memberBubbleCircles[m.id].setLatLng([m.latitude, m.longitude]);
              memberBubbleCircles[m.id].setRadius(bRadius);
            } else {
              memberBubbleCircles[m.id] = L.circle([m.latitude, m.longitude], {
                radius: bRadius,
                color: '#8B5CF6',
                weight: 2.5,
                dashArray: '6, 8',
                fillColor: '#8B5CF6',
                fillOpacity: 0.18
              }).addTo(map);
            }
          } else {
            if (memberBubbleCircles[m.id]) {
              map.removeLayer(memberBubbleCircles[m.id]);
              delete memberBubbleCircles[m.id];
            }
          }
        });

        for (var bId in memberBubbleCircles) {
          if (!activeIds[bId]) {
            map.removeLayer(memberBubbleCircles[bId]);
            delete memberBubbleCircles[bId];
          }
        }

        // 2. Compute Clusters
        var clusters = computeClusters(validMembers);

        clusters.forEach(function(cluster) {
          if (cluster.members.length === 1) {
            // Single individual member
            var m = cluster.members[0];
            var html = createMemberHtml(m);
            var icon = L.divIcon({
              html: html,
              className: 'custom-leaflet-marker',
              iconSize: [120, 110],
              iconAnchor: [60, 85]
            });
            var marker = L.marker([parseFloat(m.latitude), parseFloat(m.longitude)], { icon: icon }).addTo(map);
            marker.on('click', function(e) {
              L.DomEvent.stopPropagation(e);
              postToReactNative('MEMBER_CLICKED', { memberId: m.id });
            });
            renderedMemberLayers.push(marker);
          } else {
            // Multiple members in cluster
            var isExpanded = (expandedClusterKey === cluster.key);

            if (isExpanded) {
              // SPIDERFY FAN-OUT EXPANDED STATE
              var count = cluster.members.length;
              var centerLatLng = cluster.center;
              var centerPt = map.latLngToContainerPoint(centerLatLng);
              var radius = Math.min(65 + count * 6, 95);

              // Center red close anchor
              var centerHtml = '<div class="spiderfy-center-anchor" title="Collapse">✕</div>';
              var centerIcon = L.divIcon({
                html: centerHtml,
                className: 'custom-leaflet-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });
              var centerMarker = L.marker(centerLatLng, { icon: centerIcon, zIndexOffset: 2000 }).addTo(map);
              centerMarker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                expandedClusterKey = null;
                reclusterAndRender();
              });
              renderedMemberLayers.push(centerMarker);

              cluster.members.forEach(function(m, idx) {
                var angle = (2 * Math.PI * idx) / count - Math.PI / 2;
                var targetPt = L.point(
                  centerPt.x + radius * Math.cos(angle),
                  centerPt.y + radius * Math.sin(angle)
                );
                var targetLatLng = map.containerPointToLatLng(targetPt);

                // Connecting dashed line
                var line = L.polyline([centerLatLng, targetLatLng], {
                  color: '#94A3B8',
                  weight: 2,
                  dashArray: '3, 4',
                  opacity: 0.85
                }).addTo(map);
                renderedMemberLayers.push(line);

                // Offset member marker
                var html = createMemberHtml(m);
                var icon = L.divIcon({
                  html: html,
                  className: 'custom-leaflet-marker',
                  iconSize: [120, 110],
                  iconAnchor: [60, 85]
                });
                var memberMarker = L.marker(targetLatLng, { icon: icon, zIndexOffset: 1500 }).addTo(map);
                memberMarker.on('click', function(e) {
                  L.DomEvent.stopPropagation(e);
                  postToReactNative('MEMBER_CLICKED', { memberId: m.id });
                });
                renderedMemberLayers.push(memberMarker);
              });
            } else {
              // OLYMPIC CLUSTER STATE: ZOOM-IN (Olympic Rings Logo) vs ZOOM-OUT (1 Face + N)
              var currentZoom = map.getZoom();
              var isZoomedIn = (currentZoom >= 12);
              var count = cluster.members.length;
              var clusterHtml = createClusterHtml(cluster.members, cachedCurrentUserId, currentZoom);

              var w = isZoomedIn ? (count >= 5 ? 165 : (count >= 3 ? 140 : 120)) : 120;
              var h = isZoomedIn ? (count > 2 ? 145 : 120) : 100;

              var clusterIcon = L.divIcon({
                html: clusterHtml,
                className: 'custom-leaflet-marker',
                iconSize: [w, h],
                iconAnchor: [Math.round(w / 2), h - 4]
              });
              var clusterMarker = L.marker(cluster.center, { icon: clusterIcon, zIndexOffset: 1200 }).addTo(map);
              clusterMarker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                var origEv = e.originalEvent || window.event;
                var target = origEv ? (origEv.target || origEv.srcElement) : null;
                var cell = target ? (target.closest ? (
                  target.closest('.cluster-face-cell') ||
                  target.closest('.olympic-ring-wrapper') ||
                  target.closest('.life360-face-cell') ||
                  target.closest('.life360-compact-pod') ||
                  target.closest('.carering-avatar-cell')
                ) : null) : null;
                var clickedMemberId = cell ? cell.getAttribute('data-member-id') : null;
                if (clickedMemberId) {
                  postToReactNative('MEMBER_CLICKED', { memberId: clickedMemberId });
                  return;
                }

                // If user clicks on the zoomed-out cluster, smoothly zoom in to reveal all faces
                if (map.getZoom() < 12) {
                  map.flyTo(cluster.center, 15, { animate: true, duration: 0.8 });
                  return;
                }

                var primary = null;
                for (var p = 0; p < cluster.members.length; p++) {
                  if (cluster.members[p].id === cachedCurrentUserId) {
                    primary = cluster.members[p];
                    break;
                  }
                }
                if (!primary && cluster.members.length > 0) primary = cluster.members[0];
                if (primary) {
                  postToReactNative('MEMBER_CLICKED', { memberId: primary.id });
                }
              });
              renderedMemberLayers.push(clusterMarker);
            }
          }
        });
      } catch (err) {
        console.error('[MapView] reclusterAndRender error:', err);
      }
    }

    function updateMembers(members, currentUserId, isInCircle) {
      cachedMembers = Array.isArray(members) ? members : [];
      cachedCurrentUserId = currentUserId;
      if (typeof isInCircle === 'boolean') {
        cachedIsInCircle = isInCircle;
      } else {
        cachedIsInCircle = cachedMembers.length > 0;
      }

      // If user is in any circle, remove the blue dot
      if (cachedIsInCircle || cachedMembers.length > 0) {
        if (myLocationMarker) {
          try { map.removeLayer(myLocationMarker); } catch (e) {}
          myLocationMarker = null;
        }
      }

      reclusterAndRender();
    }

    function updateMyPosition(lat, lng, heading) {
      if (lat == null || lng == null) return;

      // Do NOT show the blue dot when current user is in any circle
      if (cachedIsInCircle || (cachedMembers && cachedMembers.length > 0)) {
        if (myLocationMarker) {
          try { map.removeLayer(myLocationMarker); } catch (e) {}
          myLocationMarker = null;
        }
        return;
      }

      var beamHtml = '';
      if (heading > 0) {
        beamHtml = '<div class="heading-beam" style="transform: rotate(' + heading + 'deg);"></div>';
      }

      var html = '<div class="current-location-marker">' +
                   beamHtml +
                   '<div class="radar-pulse"></div>' +
                   '<div class="accuracy-halo"></div>' +
                   '<div class="white-ring"><div class="blue-dot-core"></div></div>' +
                 '</div>';

      var icon = L.divIcon({
        html: html,
        className: 'current-loc-leaflet-marker',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      });

      var isFirstFix = !myLocationMarker;
      if (myLocationMarker) {
        myLocationMarker.setLatLng([lat, lng]);
        myLocationMarker.setIcon(icon);
      } else {
        myLocationMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
      }

      if (isFirstFix && !cachedIsInCircle && cachedMembers.length === 0) {
        map.setView([lat, lng], 16);
      }
    }

    function panToPosition(lat, lng, zoom, offsetY) {
      var targetZoom = zoom || 16;
      if (typeof offsetY === 'number' && offsetY !== 0) {
        try {
          var targetPoint = map.project([lat, lng], targetZoom);
          var shiftedCenterPoint = targetPoint.add([0, offsetY]);
          var shiftedCenterLatLng = map.unproject(shiftedCenterPoint, targetZoom);
          map.flyTo(shiftedCenterLatLng, targetZoom, { duration: 1.0, easeLinearity: 0.25 });
          return;
        } catch (err) {}
      }
      map.flyTo([lat, lng], targetZoom, { duration: 1.1, easeLinearity: 0.25 });
    }

    function fitBoundsCoords(coords) {
      if (!coords || coords.length === 0) return;
      if (coords.length === 1) {
        map.flyTo(coords[0], 16, { duration: 1.0 });
        return;
      }
      var bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 100],
        paddingBottomRight: [40, 240],
        maxZoom: 16.5,
        animate: true,
        duration: 1.0
      });
    }

    function triggerEmojiBurst(lat, lng, emoji) {
      if (!lat || !lng) return;
      var count = 6;
      for (var i = 0; i < count; i++) {
        (function(idx) {
          setTimeout(function() {
            var randomOffsetLat = (Math.random() - 0.5) * 0.00012;
            var randomOffsetLng = (Math.random() - 0.5) * 0.00012;
            var animDelay = (idx * 0.1) + 's';
            var rot = (Math.random() * 24 - 12) + 'deg';

            var iconHtml = '<div class="floating-emoji" style="animation-delay:' + animDelay + '; transform: rotate(' + rot + ');">' + (emoji || '💖') + '</div>';
            var icon = L.divIcon({
              html: iconHtml,
              className: 'custom-leaflet-marker',
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            });

            var burstMarker = L.marker([lat + randomOffsetLat, lng + randomOffsetLng], {
              icon: icon,
              zIndexOffset: 5000
            }).addTo(map);

            setTimeout(function() {
              map.removeLayer(burstMarker);
            }, 2200);
          }, idx * 100);
        })(i);
      }
    }

    function showRouteReplay(coords, color) {
      clearRouteReplay();
      if (!coords || coords.length < 2) return;
      activeRoutePolyline = L.polyline(coords, {
        color: color || '#4F46E5',
        weight: 5,
        opacity: 0.88,
        smoothFactor: 1
      }).addTo(map);

      // Start marker (green dot)
      var startIcon = L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#10B981;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
        className: 'custom-leaflet-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      var startM = L.marker(coords[0], { icon: startIcon }).addTo(map);
      activeRouteMarkers.push(startM);

      // End marker (indigo dot)
      var endIcon = L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#4F46E5;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
        className: 'custom-leaflet-marker',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      var endM = L.marker(coords[coords.length - 1], { icon: endIcon }).addTo(map);
      activeRouteMarkers.push(endM);

      map.fitBounds(activeRoutePolyline.getBounds(), { padding: [60, 60], animate: true });
    }

    function clearRouteReplay() {
      if (activeRoutePolyline) {
        map.removeLayer(activeRoutePolyline);
        activeRoutePolyline = null;
      }
      activeRouteMarkers.forEach(function(m) { map.removeLayer(m); });
      activeRouteMarkers = [];
    }

    function showBubbleCircle(lat, lng, radiusMeters, autoFit) {
      var r = parseFloat(radiusMeters) || 2000;
      if (activeBubbleCircle) {
        activeBubbleCircle.setLatLng([lat, lng]);
        activeBubbleCircle.setRadius(r);
      } else {
        activeBubbleCircle = L.circle([lat, lng], {
          radius: r,
          color: '#8B5CF6',
          weight: 2.5,
          dashArray: '6, 8',
          fillColor: '#8B5CF6',
          fillOpacity: 0.22
        }).addTo(map);
      }
      if (autoFit && activeBubbleCircle) {
        try {
          map.fitBounds(activeBubbleCircle.getBounds().pad(0.18), { animate: true, duration: 0.4 });
        } catch (e) {}
      }
    }

    function fitBubbleCircle(lat, lng, radiusMeters) {
      var r = parseFloat(radiusMeters) || 2000;
      showBubbleCircle(lat, lng, r, false);
      if (activeBubbleCircle) {
        try {
          map.fitBounds(activeBubbleCircle.getBounds().pad(0.18), { animate: true, duration: 0.45 });
        } catch (e) {}
      }
    }

    function clearBubbleCircle() {
      if (activeBubbleCircle) {
        map.removeLayer(activeBubbleCircle);
        activeBubbleCircle = null;
      }
    }

    function clearTimelineRoute() {
      if (activeTimelineGroup) {
        map.removeLayer(activeTimelineGroup);
        activeTimelineGroup = null;
      }
    }

    function showTimelineRoute(coords, stops, color) {
      clearTimelineRoute();
      activeTimelineGroup = L.featureGroup().addTo(map);

      var lineColor = color || '#4F46E5';

      // 1. Draw glowing polyline route
      if (coords && coords.length >= 2) {
        // Subtle glow backdrop line
        var glow = L.polyline(coords, {
          color: '#818CF8',
          weight: 7,
          opacity: 0.35,
          smoothFactor: 1
        });
        activeTimelineGroup.addLayer(glow);

        // Core dynamic route line
        var mainRoute = L.polyline(coords, {
          color: lineColor,
          weight: 4.5,
          opacity: 0.95,
          smoothFactor: 1
        });
        activeTimelineGroup.addLayer(mainRoute);
      }

      // 2. Add numbered Stop Dots along the path
      if (stops && stops.length > 0) {
        stops.forEach(function(stop, idx) {
          if (!stop.latitude || !stop.longitude) return;
          var num = stop.stopNumber || (idx + 1);
          var isFirst = idx === 0;
          var isLatest = idx === stops.length - 1;
          var bgGradient = isLatest
            ? 'linear-gradient(135deg, #10B981, #059669)'
            : isFirst
              ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
              : 'linear-gradient(135deg, #3B82F6, #1D4ED8)';

          var stopHtml = '<div style="'
            + 'width:28px;height:28px;border-radius:50%;'
            + 'background:' + bgGradient + ';'
            + 'border:2.5px solid #FFFFFF;'
            + 'box-shadow:0 3px 10px rgba(0,0,0,0.35);'
            + 'display:flex;align-items:center;justify-content:center;'
            + 'color:#FFFFFF;font-family:system-ui,-apple-system,sans-serif;'
            + 'font-size:12px;font-weight:800;letter-spacing:-0.5px;'
            + '">' + num + '</div>';

          var stopIcon = L.divIcon({
            html: stopHtml,
            className: 'timeline-stop-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
          });

          var marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon });
          var popupContent = '<div style="font-family:system-ui,-apple-system,sans-serif;padding:3px;min-width:140px;">'
            + '<div style="font-weight:700;font-size:13px;color:#1E293B;">Stop #' + num + ' &bull; ' + (stop.title || 'Stop') + '</div>'
            + (stop.duration ? '<div style="font-size:11px;color:#64748B;margin-top:2px;">⏱ ' + stop.duration + '</div>' : '')
            + (stop.address ? '<div style="font-size:11px;color:#475569;margin-top:2px;">📍 ' + stop.address + '</div>' : '')
            + '</div>';
          marker.bindPopup(popupContent);
          activeTimelineGroup.addLayer(marker);
        });
      }

      // Auto-fit bounds
      try {
        var bounds = activeTimelineGroup.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
        }
      } catch (err) {}
    }

    function handleIncomingMapMessage(e) {
      try {
        var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!msg || !msg.action) return;

        switch (msg.action) {
          case 'UPDATE_MEMBERS':
            updateMembers(msg.members, msg.currentUserId, msg.isInCircle);
            break;
          case 'UPDATE_MY_POSITION':
            updateMyPosition(msg.latitude, msg.longitude, msg.heading);
            break;
          case 'PAN_TO':
            panToPosition(msg.lat, msg.lng, msg.zoom, msg.offsetY);
            break;
          case 'FIT_BOUNDS':
            fitBoundsCoords(msg.coords);
            break;
          case 'SET_STYLE':
            setTileLayer(msg.urlTemplate, msg.subdomains, msg.styleId);
            break;
          case 'TRIGGER_REACTION':
            triggerEmojiBurst(msg.lat, msg.lng, msg.emoji);
            break;
          case 'SHOW_ROUTE_REPLAY':
            showRouteReplay(msg.coords, msg.color);
            break;
          case 'CLEAR_ROUTE_REPLAY':
            clearRouteReplay();
            break;
          case 'SHOW_TIMELINE_ROUTE':
            showTimelineRoute(msg.coords, msg.stops, msg.color);
            break;
          case 'CLEAR_TIMELINE_ROUTE':
            clearTimelineRoute();
            break;
          case 'SHOW_BUBBLE':
            showBubbleCircle(msg.lat, msg.lng, msg.radiusMeters, msg.autoFit);
            break;
          case 'FIT_BUBBLE':
            fitBubbleCircle(msg.lat, msg.lng, msg.radiusMeters);
            break;
          case 'CLEAR_BUBBLE':
            clearBubbleCircle();
            break;
          case 'CACHE_LOCATIONS':
            precacheLocations(msg.locations);
            break;
          case 'CACHE_CURRENT_VIEW':
            cacheCurrentViewport();
            break;
          case 'CLEAR_TILE_CACHE':
            clearTileCache(msg.styleId);
            break;
          case 'REQUEST_CACHE_STATS':
            calculateDBStats(msg.styleId);
            break;
          case 'INVALIDATE_SIZE':
            if (typeof map !== 'undefined' && map) {
              map.invalidateSize();
            }
            break;
          case 'UPDATE_SMART_CONFIG':
            if (msg.config) {
              maxCacheBytes = (!msg.config.maxLimitMB || msg.config.maxLimitMB <= 0)
                ? 0
                : msg.config.maxLimitMB * 1024 * 1024;
            }
            break;
          case 'SET_SELECTED_MEMBER':
            activeSelectedMemberId = msg.memberId || null;
            reclusterAndRender();
            break;
          case 'UPDATE_PLACES':
            cachedPlaces = Array.isArray(msg.places) ? msg.places : [];
            reclusterAndRender();
            break;
        }
      } catch (err) {}
    }

    window.addEventListener('message', handleIncomingMapMessage);
    document.addEventListener('message', handleIncomingMapMessage);

    if (${hasInitialPosition}) {
      updateMyPosition(${initialLat}, ${initialLng}, ${initialHeading});
    }

    // Automatic container resize & visibility observer (solves tab switching and modal display:none)
    if (typeof ResizeObserver !== 'undefined') {
      var mapEl = document.getElementById('map');
      if (mapEl) {
        var ro = new ResizeObserver(function() {
          if (typeof map !== 'undefined' && map) {
            map.invalidateSize({ debounceMoveEvents: true });
          }
        });
        ro.observe(mapEl);
      }
    }

    window.addEventListener('resize', function() {
      if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
      }
    });

    [100, 300, 700, 1500].forEach(function(delay) {
      setTimeout(function() {
        if (typeof map !== 'undefined' && map) {
          map.invalidateSize();
        }
        if (delay === 100) {
          postToReactNative('MAP_READY', {});
        }
        postViewport();
      }, delay);
    });
  </script>
</body>
</html>
  `;
}

export const MapView = forwardRef<MapViewRef, MapViewProps>(
  (
    {
      currentUserId,
      members,
      myPosition,
      isInCircle,
      mapStyle = MAP_STYLES.detailedOsm,
      smartConfig,
      nicknames = {},
      selectedMemberId = null,
      places = [],
      onMemberPress,
      onMapPress,
      onCacheStatsUpdated,
      onCacheProgress,
      onViewportChange,
    },
    ref
  ) => {
    const webViewRef = useRef<WebView | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const postMessageToMap = (actionObj: Record<string, any>) => {
      const json = JSON.stringify(actionObj);
      if (Platform.OS === 'web') {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(json, '*');
        }
      } else {
        if (webViewRef.current) {
          webViewRef.current.postMessage(json);
        }
      }
    };

    useImperativeHandle(ref, () => ({
      animateToPosition: (lat: number, lng: number, zoom = 16, offsetY = 0) => {
        postMessageToMap({ action: 'PAN_TO', lat, lng, zoom, offsetY });
      },
      fitBounds: (memberList: MemberData[]) => {
        const coords = memberList
          .filter((m) => m.latitude && m.longitude)
          .map((m) => [m.latitude, m.longitude]);
        postMessageToMap({ action: 'FIT_BOUNDS', coords });
      },
      setMapStyle: (style: MapStyleConfig) => {
        TileCacheService.setActiveStyleId(style.id);
        postMessageToMap({
          action: 'SET_STYLE',
          urlTemplate: style.urlTemplate,
          subdomains: style.subdomains,
          styleId: style.id,
        });
      },
      triggerReaction: (lat: number, lng: number, emoji: string) => {
        postMessageToMap({
          action: 'TRIGGER_REACTION',
          lat,
          lng,
          emoji,
        });
      },
      showRouteReplay: (coords: [number, number][], color?: string) => {
        postMessageToMap({
          action: 'SHOW_ROUTE_REPLAY',
          coords,
          color,
        });
      },
      clearRouteReplay: () => {
        postMessageToMap({ action: 'CLEAR_ROUTE_REPLAY' });
      },
      showTimelineRoute: (data: {
        coords: [number, number][];
        stops?: Array<{ latitude: number; longitude: number; stopNumber: number; title: string; duration?: string; address?: string }>;
        color?: string;
      }) => {
        postMessageToMap({
          action: 'SHOW_TIMELINE_ROUTE',
          coords: data.coords,
          stops: data.stops,
          color: data.color,
        });
      },
      clearTimelineRoute: () => {
        postMessageToMap({ action: 'CLEAR_TIMELINE_ROUTE' });
      },
      showBubble: (lat: number, lng: number, radiusMeters?: number, autoFit?: boolean) => {
        postMessageToMap({
          action: 'SHOW_BUBBLE',
          lat,
          lng,
          radiusMeters,
          autoFit: Boolean(autoFit),
        });
      },
      fitBubble: (lat: number, lng: number, radiusMeters?: number) => {
        postMessageToMap({
          action: 'FIT_BUBBLE',
          lat,
          lng,
          radiusMeters,
        });
      },
      clearBubble: () => {
        postMessageToMap({ action: 'CLEAR_BUBBLE' });
      },
      cacheLocations: (locations: { id?: string; name: string; latitude: number; longitude: number }[]) => {
        postMessageToMap({ action: 'CACHE_LOCATIONS', locations });
      },
      cacheCurrentView: () => {
        postMessageToMap({ action: 'CACHE_CURRENT_VIEW' });
      },
      clearTileCache: (styleId?: string) => {
        postMessageToMap({ action: 'CLEAR_TILE_CACHE', styleId });
      },
      refreshCacheStats: (styleId?: string) => {
        postMessageToMap({ action: 'REQUEST_CACHE_STATS', styleId });
      },
      invalidateSize: () => {
        postMessageToMap({ action: 'INVALIDATE_SIZE' });
      },
      updateSmartConfig: (config: SmartCacheConfig) => {
        postMessageToMap({ action: 'UPDATE_SMART_CONFIG', config });
      },
    }));

    // Dynamically sync smart cache config (e.g. Unlimited vs MB thresholds)
    useEffect(() => {
      if (smartConfig) {
        postMessageToMap({ action: 'UPDATE_SMART_CONFIG', config: smartConfig });
      }
    }, [smartConfig]);

    const getSerializableMembers = useCallback(() => {
      return members.map((m) => {
        const bubble = getMemberBubbleInfo(m);
        const nickname = nicknames[m.id]?.trim() || '';
        const effectiveName = nickname || m.fullName;
        return {
          id: m.id,
          fullName: m.fullName,
          nickname: nickname,
          avatarUrl: m.avatarUrl,
          latitude: m.latitude,
          longitude: m.longitude,
          speed: m.speed,
          heading: m.heading,
          batteryLevel: m.batteryLevel,
          isCharging: m.isCharging,
          isStationary: m.isStationary,
          isOnline: m.isOnline,
          initials: getMemberInitials(effectiveName),
          bubbleIcon: bubble.icon,
          bubbleText: bubble.text,
          inBubble: Boolean(m.inBubble),
          bubbleRadius: m.bubbleRadius || 2000,
          bubbleUntil: m.bubbleUntil ? m.bubbleUntil.toISOString() : null,
          stationarySince: m.stationarySince ? m.stationarySince.toISOString() : (m.lastOnlineAt ? m.lastOnlineAt.toISOString() : null),
        };
      });
    }, [members, nicknames]);

    const syncStateToMap = useCallback(() => {
      postMessageToMap({
        action: 'SET_STYLE',
        urlTemplate: mapStyle.urlTemplate,
        subdomains: mapStyle.subdomains,
        styleId: mapStyle.id,
      });
      const effectiveIsInCircle = Boolean(isInCircle ?? (members && members.length > 0));
      if (!effectiveIsInCircle && myPosition && myPosition.latitude && myPosition.longitude) {
        postMessageToMap({
          action: 'UPDATE_MY_POSITION',
          latitude: myPosition.latitude,
          longitude: myPosition.longitude,
          heading: myPosition.heading,
        });
      }
      postMessageToMap({
        action: 'UPDATE_MEMBERS',
        members: getSerializableMembers(),
        currentUserId,
        isInCircle: effectiveIsInCircle,
      });
      if (selectedMemberId !== undefined) {
        postMessageToMap({
          action: 'SET_SELECTED_MEMBER',
          memberId: selectedMemberId || null,
        });
      }
      if (places) {
        postMessageToMap({
          action: 'UPDATE_PLACES',
          places: places,
        });
      }
    }, [myPosition, getSerializableMembers, currentUserId, isInCircle, members, mapStyle.id, mapStyle.urlTemplate, mapStyle.subdomains, selectedMemberId, places]);

    // Update members whenever member data changes
    useEffect(() => {
      const effectiveIsInCircle = Boolean(isInCircle ?? (members && members.length > 0));
      postMessageToMap({
        action: 'UPDATE_MEMBERS',
        members: getSerializableMembers(),
        currentUserId,
        isInCircle: effectiveIsInCircle,
      });
    }, [getSerializableMembers, currentUserId, isInCircle, members]);

    // Update selected member highlight
    useEffect(() => {
      postMessageToMap({
        action: 'SET_SELECTED_MEMBER',
        memberId: selectedMemberId || null,
      });
    }, [selectedMemberId]);

    // Update places for geofence emoji detection
    useEffect(() => {
      postMessageToMap({
        action: 'UPDATE_PLACES',
        places: places || [],
      });
    }, [places]);

    // Update my position whenever device location updates (only when not in any circle)
    useEffect(() => {
      const effectiveIsInCircle = Boolean(isInCircle ?? (members && members.length > 0));
      if (!effectiveIsInCircle && myPosition && myPosition.latitude && myPosition.longitude) {
        postMessageToMap({
          action: 'UPDATE_MY_POSITION',
          latitude: myPosition.latitude,
          longitude: myPosition.longitude,
          heading: myPosition.heading,
        });
      }
    }, [myPosition, isInCircle, members]);

    // Update style if prop changes
    useEffect(() => {
      postMessageToMap({
        action: 'SET_STYLE',
        urlTemplate: mapStyle.urlTemplate,
        subdomains: mapStyle.subdomains,
        styleId: mapStyle.id,
      });
    }, [mapStyle.id, mapStyle.urlTemplate]);

    const handleIncomingMessage = (msgData: string) => {
      try {
        const parsed = JSON.parse(msgData);
        if (parsed.type === 'MAP_READY') {
          syncStateToMap();
        } else if (parsed.type === 'MEMBER_CLICKED') {
          const found = members.find((m) => m.id === parsed.data.memberId);
          if (found && onMemberPress) {
            onMemberPress(found);
          }
        } else if (parsed.type === 'MAP_CLICKED') {
          const coords = (parsed.data?.lat != null && parsed.data?.lng != null)
            ? { latitude: Number(parsed.data.lat), longitude: Number(parsed.data.lng) }
            : undefined;
          onMapPress?.(coords);
        } else if (parsed.type === 'CACHE_STATS_UPDATED') {
          if (parsed.data) {
            TileCacheService.updateCacheStats(parsed.data);
            onCacheStatsUpdated?.(parsed.data);
          }
        } else if (parsed.type === 'CACHE_PROGRESS') {
          if (parsed.data) {
            TileCacheService.notifyProgress(parsed.data);
            onCacheProgress?.(parsed.data);
          }
        } else if (parsed.type === 'MAP_VIEWPORT_CHANGED') {
          if (parsed.data && onViewportChange) {
            onViewportChange(parsed.data);
          }
        }
      } catch (err) {}
    };

    // Web-specific listener
    useEffect(() => {
      if (Platform.OS !== 'web') return;
      const handler = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          handleIncomingMessage(event.data);
        }
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [members, onMemberPress, onMapPress, onViewportChange, syncStateToMap]);

    const initialCoordsRef = useRef<{
      lat: number;
      lng: number;
      zoom: number;
      heading: number;
      hasInitialPosition: boolean;
    } | null>(null);

    if (!initialCoordsRef.current) {
      const effectiveIsInCircle = Boolean(isInCircle ?? (members && members.length > 0));
      initialCoordsRef.current = {
        lat: myPosition?.latitude || members[0]?.latitude || 20.5937,
        lng: myPosition?.longitude || members[0]?.longitude || 78.9629,
        zoom: myPosition?.latitude || members[0]?.latitude ? 16 : 14,
        heading: myPosition?.heading || 0,
        hasInitialPosition: Boolean(myPosition && myPosition.latitude && myPosition.longitude && !effectiveIsInCircle),
      };
    }

    // Keep htmlContent completely stable so srcDoc never reloads the iframe
    const htmlContent = useMemo(() => {
      const effectiveIsInCircle = Boolean(isInCircle ?? (members && members.length > 0));
      return generateLeafletHtml(
        mapStyle.urlTemplate,
        mapStyle.subdomains,
        initialCoordsRef.current!.lat,
        initialCoordsRef.current!.lng,
        initialCoordsRef.current!.zoom,
        initialCoordsRef.current!.heading,
        initialCoordsRef.current!.hasInitialPosition,
        mapStyle.id,
        smartConfig?.maxLimitMB ?? 0,
        effectiveIsInCircle
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isDarkStyle = mapStyle.id.toLowerCase().includes('dark') || mapStyle.urlTemplate.toLowerCase().includes('dark');

    if (Platform.OS === 'web') {
      return (
        <View style={[styles.container, { backgroundColor: isDarkStyle ? '#090D16' : '#F1F5F9' }]}>
          <iframe
            key="care-ring-leaflet-map"
            ref={iframeRef}
            srcDoc={htmlContent}
            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 } as any}
            title="CareRing Map"
            onLoad={syncStateToMap}
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: isDarkStyle ? '#090D16' : '#F1F5F9' }]}>
        <WebView
          key="care-ring-leaflet-map"
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: 'https://localhost' }}
          style={[styles.webView, { backgroundColor: isDarkStyle ? '#090D16' : '#F1F5F9' }]}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={syncStateToMap}
          onMessage={(event) => handleIncomingMessage(event.nativeEvent.data)}
          onError={(syntheticEvent) => {
            console.warn('[MapView] WebView error:', syntheticEvent.nativeEvent);
          }}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
});
