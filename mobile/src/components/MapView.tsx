import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MemberData, getMemberInitials } from '../models/Member';
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';
import { TileCacheService, CacheStats, CacheProgress, SmartCacheConfig } from '../services/TileCacheService';
import { formatSpeed, formatCompactDistance } from '../utils/distance';
import { distancePreferencesService, DistanceUnit, DistancePreferences } from '../services/DistancePreferencesService';

export interface LiveLocationPayload {
  memberId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp?: number;
  activity?: string;
}

export interface MapViewRef {
  animateToPosition: (lat: number, lng: number, zoom?: number, offsetY?: number) => void;
  updateLiveLocation?: (data: LiveLocationPayload) => void;
  setFollowingMember?: (memberId: string | null) => void;
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
  myPosition?: {
    latitude: number;
    longitude: number;
    heading: number;
    speed?: number;
    accuracy?: number;
    timestamp?: number;
    activity?: string;
  } | null;
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

function getMemberBubbleInfo(m: MemberData, isSelf: boolean = false, unit: DistanceUnit = 'metric'): { icon: string; text: string } {
  if (isSelf && m.inBubble) {
    const compactRadius = formatCompactDistance(m.bubbleRadius || 2000, unit);
    return { icon: '👻', text: `Ghost Zone (~${compactRadius})` };
  }
  if (m.isMoving) {
    return { icon: '🚗', text: formatSpeed(m.speed || 0, unit) };
  }
  const rawSince = m.stationarySince || m.lastLocationTime || m.lastOnlineAt;
  const sinceDate = rawSince ? (rawSince instanceof Date ? rawSince : new Date(rawSince)) : new Date();
  const validSince = isNaN(sinceDate.getTime()) ? new Date() : sinceDate;
  const diffMs = Math.max(0, Date.now() - validSince.getTime());
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
  initialIsInCircle = false,
  initialDistanceUnit: DistanceUnit = 'metric'
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
  <meta name="referrer" content="no-referrer" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" onerror="this.onerror=null;this.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css';" />
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
      will-change: transform;
    }
    .current-loc-leaflet-marker {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
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

    /* Sleek Modern Status Tag (Replaces clunky white speech bubble) */
    .sleek-status-tag {
      position: relative;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 12px;
      padding: 3px 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
      display: flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      font-size: 10px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 5px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      pointer-events: none;
      z-index: 20;
    }
    .sleek-status-tag.is-moving {
      background: rgba(16, 185, 129, 0.92);
      border-color: rgba(255, 255, 255, 0.35);
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.45);
    }
    .sleek-status-tag.is-selected {
      background: rgba(0, 122, 255, 0.94);
      border-color: rgba(255, 255, 255, 0.45);
      box-shadow: 0 4px 16px rgba(0, 122, 255, 0.55);
    }
    .sleek-status-icon {
      font-size: 11px;
      line-height: 1;
      display: inline-block;
    }
    .sleek-status-text {
      font-size: 10px;
      font-weight: 700;
      color: #FFFFFF;
    }

    /* Animated Moving Border Ring Engine (Centered Pure CSS Animation) */
    /* Clean & Simple Movement Ripple Animation (Native iOS / Life360 Design System) */
    @keyframes cleanPulseRipple {
      0% {
        transform: scale(0.96);
        opacity: 0.75;
      }
      100% {
        transform: scale(1.42);
        opacity: 0;
      }
    }
    @keyframes cleanPulseRippleOuter {
      0% {
        transform: scale(0.96);
        opacity: 0.45;
      }
      100% {
        transform: scale(1.68);
        opacity: 0;
      }
    }
    @keyframes selfLocPulseWave {
      0% { transform: scale(0.85); opacity: 0.7; }
      60% { opacity: 0.3; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    .avatar-pin-container {
      position: relative;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Self User Accuracy Pulse (Apple/Google Maps style beacon) */
    .self-loc-pulse {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 48px;
      height: 48px;
      margin-left: -24px;
      margin-top: -24px;
      border-radius: 50%;
      background: rgba(0, 122, 255, 0.28);
      pointer-events: none;
      animation: selfLocPulseWave 2.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
      z-index: 0;
    }

    /* Self User Real-Time Heading Flashlight / Beam (Apple/Google Maps style) */
    .self-heading-beam {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 120px;
      height: 100px;
      margin-left: -60px;
      margin-top: -100px;
      pointer-events: none;
      transform-origin: 60px 100px;
      z-index: 1;
    }

    /* Clean Subtle Movement Waves (Matching App Design System) */
    .clean-pulse-ripple {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 50%;
      border: 2px solid rgba(16, 185, 129, 0.75);
      background: rgba(16, 185, 129, 0.12);
      pointer-events: none;
      animation: cleanPulseRipple 2.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
      z-index: 1;
    }
    .clean-pulse-ripple-outer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border-radius: 50%;
      border: 1.5px solid rgba(16, 185, 129, 0.45);
      pointer-events: none;
      animation: cleanPulseRippleOuter 2.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite 0.75s;
      z-index: 0;
    }
    .clean-pulse-ripple.is-selected {
      border-color: rgba(0, 122, 255, 0.85);
      background: rgba(0, 122, 255, 0.15);
    }
    .clean-pulse-ripple-outer.is-selected {
      border-color: rgba(0, 122, 255, 0.5);
    }

    .pin-anchor-shadow {
      width: 14px;
      height: 4px;
      background: rgba(0, 0, 0, 0.28);
      border-radius: 50%;
      margin-top: 3px;
      filter: blur(1px);
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
    @keyframes emojiRide {
      0%, 100% { transform: translateY(0) rotate(0deg); }
      25% { transform: translateY(-1.5px) rotate(-4deg); }
      50% { transform: translateY(0.5px) rotate(0deg); }
      75% { transform: translateY(-1px) rotate(4deg); }
    }
    .emoji-anim-riding {
      animation: emojiRide 0.28s ease-in-out infinite;
      display: inline-block;
    }

    /* Avatar Halo Circle (Crisp, clean Apple design system) */
    .avatar-halo {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: 3.5px solid #FFFFFF;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: visible;
      position: relative;
      font-weight: 800;
      color: #FFFFFF;
      font-size: 16px;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
      box-sizing: border-box;
      z-index: 5;
    }
    .avatar-halo.is-moving {
      box-shadow: 0 0 0 2.5px #10B981, 0 4px 14px rgba(16, 185, 129, 0.4);
    }
    .avatar-halo.is-selected {
      border-color: #FFFFFF !important;
      box-shadow: 0 0 0 3.5px #007AFF, 0 6px 20px rgba(0, 122, 255, 0.5) !important;
      transform: scale(1.08);
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

    /* Top Arrival / Place Callout Pill (Sleek Frosted Glass Design) */
    .life360-cluster-callout {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3.5px 10px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 14px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.16);
      margin-bottom: 5px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 20;
    }
    .life360-callout-icon {
      font-size: 14px;
      line-height: 1;
    }
    .life360-callout-text-col {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      text-align: left;
    }
    .life360-callout-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #FFFFFF;
      letter-spacing: -0.2px;
    }
    .life360-callout-time {
      font-size: 9px;
      font-weight: 600;
      color: #CBD5E1;
      margin-top: 1px;
    }

    /* LIFE360 CLUSTER FREEFORM (Grouped avatars together naturally, without square or pod container) */
    .cluster-faces-freeform {
      position: relative;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      z-index: 15;
    }
    .cluster-faces-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: transparent;
      padding: 2px;
    }
    .cluster-faces-row {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
    }
    .cluster-faces-row:not(:first-child) {
      margin-top: -12px;
    }
    .cluster-face-cell {
      position: relative;
      cursor: pointer;
      user-select: none;
      transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .cluster-face-cell:not(:first-child) {
      margin-left: -12px;
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
      border: 3.5px solid #FFFFFF;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
      box-sizing: border-box;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
    }
    /* White borders for non-selected members */
    .cluster-face-circle.ring-white {
      border-color: #FFFFFF;
    }
    .cluster-face-circle.is-moving {
      box-shadow: 0 0 0 2.5px #10B981, 0 3px 10px rgba(16, 185, 129, 0.35);
    }
    /* Active Blue border for the currently-selected member */
    .cluster-face-circle.is-selected {
      box-shadow: 0 0 0 3.5px #007AFF, 0 6px 18px rgba(0, 122, 255, 0.45);
    }
    .cluster-face-cell.is-selected {
      transform: scale(1.1);
      z-index: 35 !important;
    }
    .cluster-face-more {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #7C3AED;
      border: 3.5px solid #FFFFFF;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
      box-sizing: border-box;
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
    var isImperialUnit = ${initialDistanceUnit === 'imperial'};
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

    var activeMemberMarkers = {};
    var activeClusterMarkers = {};
    var renderedSpiderfyLayers = [];
    var renderedClusterLayers = [];
    var isUserInteracting = false;
    var interactionCooldownTimer = null;
    var activeFollowingMemberId = null;
    var memberBubbleCircles = {};
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

    map.on('movestart dragstart zoomstart', function() {
      isUserInteracting = true;
      if (interactionCooldownTimer) clearTimeout(interactionCooldownTimer);
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

    map.on('moveend dragend zoomend', function() {
      postViewport();
      if (typeof reclusterAndRender === 'function') reclusterAndRender();
      if (interactionCooldownTimer) clearTimeout(interactionCooldownTimer);
      interactionCooldownTimer = setTimeout(function() {
        isUserInteracting = false;
      }, 7000);
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

    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function getActivityDetails(speed, isMoving, activityType) {
      var act = (activityType || '').toLowerCase();
      if (act === 'riding') {
        return { type: 'riding', emoji: '🏍️', label: 'Riding', animClass: 'emoji-anim-riding' };
      }
      if (act === 'driving') {
        if (speed >= 85) return { type: 'high_speed', emoji: '🏎️', label: 'Highway Speed', animClass: 'emoji-anim-highspeed' };
        return { type: 'driving', emoji: '🚗', label: 'Driving', animClass: 'emoji-anim-driving' };
      }
      if (act === 'walking') {
        return { type: 'walking', emoji: '🚶', label: 'Walking', animClass: 'emoji-anim-walking' };
      }
      if (act === 'running') {
        return { type: 'running', emoji: '🏃', label: 'Running', animClass: 'emoji-anim-running' };
      }
      if (act === 'cycling') {
        return { type: 'cycling', emoji: '🚴', label: 'Cycling', animClass: 'emoji-anim-cycling' };
      }
      if (act === 'high_speed') {
        return { type: 'high_speed', emoji: '🏎️', label: 'Highway Speed', animClass: 'emoji-anim-highspeed' };
      }
      if (act === 'unknown' || act === 'moving') {
        if (speed < 1.8) {
          return { type: 'stationary', emoji: '🧍', label: 'Stationary', animClass: '' };
        }
        return { type: 'unknown', emoji: '📍', label: 'Moving', animClass: '' };
      }
      if (act === 'stationary') {
        // Rule: Never show "Stationary" if speed > 5 km/h
        if (speed > 5.0) {
          return { type: 'unknown', emoji: '📍', label: 'Moving', animClass: '' };
        }
        return { type: 'stationary', emoji: '🧍', label: 'Stationary', animClass: '' };
      }

      // ONLY when activity is missing / not provided:
      if (speed < 1.8 || !isMoving) {
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
      var lastLocTime = m.lastLocationTime ? new Date(m.lastLocationTime).getTime() : 0;
      if (!lastLocTime && m.lastOnlineAt) lastLocTime = new Date(m.lastOnlineAt).getTime();
      var isStale = lastLocTime > 0 && (Date.now() - lastLocTime > 120000);

      var speedNum = (typeof m.speed === 'number' && !isNaN(m.speed) && m.speed > 0) ? m.speed : 0;
      var hasMovingActivity = !isStale && Boolean(
        m.activityType &&
        m.activityType !== 'stationary' &&
        m.activityType !== 'still' &&
        m.activityType !== 'unknown'
      );
      // STRICT RULE: A member CANNOT be moving if speed is under 1.8 km/h
      var isTrulyMoving = !isStale && speedNum >= 1.8 && (
        speedNum > 3.5 ||
        hasMovingActivity ||
        (m.isMoving && !m.isStationary)
      );
      var act = isStale
        ? { type: 'stale', emoji: '⏱️', label: 'Last seen', animClass: '' }
        : getActivityDetails(speedNum, isTrulyMoving, m.activityType || m.activity);
      var isGhostSelf = isSelf && Boolean(m.inBubble);
      var ringColor = isGhostSelf ? '#8B5CF6' : (m.isOnline && !isStale ? (isTrulyMoving ? '#10B981' : '#4F46E5') : '#94A3B8');
      var namePrefix = isGhostSelf ? '🫧 ' : '';

      var matchedPlace = getMemberPlace(m, cachedPlaces);
      var isAtHome = false;
      if (matchedPlace) {
        var pName = (matchedPlace.name || matchedPlace.category || '').toLowerCase();
        if (pName.indexOf('home') !== -1 || (matchedPlace.category && matchedPlace.category.toLowerCase().indexOf('home') !== -1)) {
          isAtHome = true;
        }
      } else if (!isTrulyMoving) {
        var addr = (m.resolvedAddress || '').toLowerCase();
        if (addr.indexOf('home') !== -1 || addr.indexOf('residence') !== -1 || addr.indexOf('apartment') !== -1 || addr.indexOf('house') !== -1 || !addr) {
          isAtHome = true;
        }
      }

      var bubbleIcon = m.bubbleIcon;
      var bubbleText = m.bubbleText;
      var iconAnimClass = '';

      if (isStale) {
        var diffMin = Math.floor((Date.now() - lastLocTime) / 60000);
        var staleText = diffMin < 1 ? 'just now' : (diffMin < 60 ? (diffMin + 'm ago') : (Math.floor(diffMin / 60) + 'h ago'));
        bubbleIcon = '⏱️';
        bubbleText = escapeHtml('Last seen ' + staleText);
        iconAnimClass = '';
      } else if (isTrulyMoving && speedNum >= 1.8) {
        bubbleIcon = act.emoji;
        var spdFormatted = isImperialUnit ? (Math.round(speedNum * 0.621371) + ' mph') : (Math.round(speedNum) + ' km/h');
        bubbleText = escapeHtml(act.label + ' • ' + spdFormatted);
        iconAnimClass = act.animClass;
      } else {
        if (!bubbleIcon) {
          bubbleIcon = isAtHome ? '🏠' : (matchedPlace ? getPlaceEmoji(matchedPlace.category) : '📍');
        }
        if (!bubbleText) {
          bubbleText = escapeHtml(isAtHome ? 'At home' : (matchedPlace ? ('At ' + (matchedPlace.name || 'Place')) : (m.resolvedAddress || 'Stationary')));
        }
      }

      var avatarInner = '';
      if (m.avatarUrl && m.avatarUrl.trim().length > 0) {
        avatarInner = '<img src="' + escapeAttr(m.avatarUrl) + '" class="avatar-img" referrerpolicy="no-referrer" loading="eager" crossorigin="anonymous" onerror="handleAvatarImgError(this)" />' +
                      '<div class="avatar-initials" style="display:none; width:100%; height:100%; background:' + bgColor + '; align-items:center; justify-content:center;">' + initials + '</div>';
      } else {
        avatarInner = '<div class="avatar-initials" style="width:100%; height:100%; background:' + bgColor + '; display:flex; align-items:center; justify-content:center;">' + initials + '</div>';
      }

      var isSelected = (activeSelectedMemberId && m.id === activeSelectedMemberId);
      var isSelf = Boolean(cachedCurrentUserId && m.id === cachedCurrentUserId);
      var haloRingColor = isSelected ? '#FFFFFF' : ringColor;
      var haloClass = 'avatar-halo' + (isSelected ? ' is-selected' : (isMovingNow ? ' is-moving' : ''));

      // Radar & accuracy pulse ONLY for self user (Apple / Google Maps style)
      // Never show radar beam for other circle members!
      var radarHtml = '';
      var selfPulseHtml = '';
      if (isSelf) {
        selfPulseHtml = '<div class="self-loc-pulse"></div>';
        var hasRealHeading = (typeof m.heading === 'number' && !isNaN(m.heading) && m.heading >= 0);
        if (hasRealHeading) {
          radarHtml = '<div class="self-heading-beam" style="transform: rotate(' + m.heading + 'deg);">' +
                        '<svg width="120" height="100" viewBox="0 0 120 100" style="overflow:visible;">' +
                          '<defs>' +
                            '<radialGradient id="selfHeadingGrad" cx="50%" cy="100%" r="100%">' +
                              '<stop offset="0%" stop-color="#007AFF" stop-opacity="0.45" />' +
                              '<stop offset="55%" stop-color="#007AFF" stop-opacity="0.18" />' +
                              '<stop offset="100%" stop-color="#007AFF" stop-opacity="0.0" />' +
                            '</radialGradient>' +
                          '</defs>' +
                          '<path d="M 60,100 L 20,18 A 65,65 0 0,1 100,18 Z" fill="url(#selfHeadingGrad)" />' +
                        '</svg>' +
                      '</div>';
        }
      }

      var liveAnimHtml = '';
      if (isMovingNow || isSelected) {
        var rippleClass = isSelected ? 'clean-pulse-ripple is-selected' : 'clean-pulse-ripple';
        var rippleOuterClass = isSelected ? 'clean-pulse-ripple-outer is-selected' : 'clean-pulse-ripple-outer';
        liveAnimHtml = '<div class="' + rippleOuterClass + '"></div>' +
                       '<div class="' + rippleClass + '"></div>';
      }

      var statusTagHtml = '';
      if (isMovingNow || isSelected) {
        var tagClass = 'sleek-status-tag' + (isMovingNow ? ' is-moving' : '') + (isSelected ? ' is-selected' : '');
        statusTagHtml = '<div class="' + tagClass + '">' +
                          '<span class="sleek-status-icon ' + iconAnimClass + '">' + bubbleIcon + '</span>' +
                          '<span class="sleek-status-text">' + bubbleText + '</span>' +
                        '</div>';
      }

      return '<div class="marker-wrapper">' +
               statusTagHtml +
               '<div class="avatar-pin-container">' +
                 radarHtml +
                 selfPulseHtml +
                 liveAnimHtml +
                 '<div class="' + haloClass + '" style="border-color:' + haloRingColor + ';">' +
                   '<div class="avatar-inner">' + avatarInner + '</div>' +
                 '</div>' +
               '</div>' +
               '<div class="avatar-name-pill">' + namePrefix + displayName + '</div>' +
               '<div class="pin-anchor-shadow"></div>' +
             '</div>';
    }

    function formatMemberTime(m) {
      if (!m) return { title: 'arrived', time: 'Just arrived', icon: '🏠', animClass: '' };
      var spd = (typeof m.speed === 'number' && !isNaN(m.speed)) ? Math.round(m.speed) : 0;

      // Staleness rule: if the last update is older than 2 minutes, show "Last seen X ago" instead of a live mode
      var lastLocTime = m.lastLocationTime ? new Date(m.lastLocationTime).getTime() : 0;
      if (!lastLocTime && m.lastOnlineAt) lastLocTime = new Date(m.lastOnlineAt).getTime();
      var isStale = lastLocTime > 0 && (Date.now() - lastLocTime > 120000);
      if (isStale) {
        var diffSec = Math.floor((Date.now() - lastLocTime) / 1000);
        var diffMin = Math.floor(diffSec / 60);
        var staleText = diffMin < 1 ? 'just now' : (diffMin < 60 ? (diffMin + 'm ago') : (Math.floor(diffMin / 60) + 'h ago'));
        return { title: 'Last seen', time: 'Last seen ' + staleText, icon: '⏱️', placeName: '', animClass: '' };
      }

      var hasMovingActivity = Boolean(
        m.activityType &&
        m.activityType !== 'stationary' &&
        m.activityType !== 'still' &&
        m.activityType !== 'unknown'
      );
      if (spd >= 1.8 && (spd > 3.5 || hasMovingActivity || (m.isMoving && !m.isStationary))) {
        var act = getActivityDetails(spd, true, m.activityType || m.activity);
        var timeStr = isImperialUnit ? (Math.round(spd * 0.621371) + ' mph') : (spd + ' km/h');
        return { title: act.label, time: timeStr, icon: act.emoji, animClass: act.animClass };
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
        inner = '<img src="' + escapeAttr(m.avatarUrl) + '" class="life360-face-img" referrerpolicy="no-referrer" loading="eager" crossorigin="anonymous" onerror="handleAvatarImgError(this)" />' +
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
        inner = '<img src="' + escapeAttr(m.avatarUrl) + '" class="life360-face-img" referrerpolicy="no-referrer" loading="eager" crossorigin="anonymous" onerror="handleAvatarImgError(this)" />' +
                '<div class="life360-face-initials" style="display:none;background:' + bgColor + ';">' + initials + '</div>';
      } else {
        inner = '<div class="life360-face-initials" style="background:' + bgColor + ';">' + initials + '</div>';
      }

      var spd = (typeof m.speed === 'number' && !isNaN(m.speed) && m.speed > 0) ? m.speed : 0;
      var isMovingNow = Boolean(m.isMoving || (spd >= 1.8 && !m.isStationary));

      var circleStateClass = isSelected ? ' is-selected' : (isMovingNow ? ' is-moving' : '');

      return '<div class="cluster-face-cell' + selClass + '" data-member-id="' + escapeHtml(m.id) + '" title="' + name + '">' +
               '<div class="cluster-face-circle' + circleStateClass + '">' +
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
        // STABLE MEMBER ORDER: Keep natural positions so selecting a member NEVER shifts or changes face position!
        var orderedMembers = clusterMembers.slice();

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

        var freeformHtml = '<div class="cluster-faces-freeform">' +
                             facesContainerHtml +
                           '</div>';

        return '<div class="life360-cluster-wrapper zoomed-in">' +
                 calloutHtml +
                 freeformHtml +
                 '<div class="pin-anchor-shadow" style="margin-top: 4px;"></div>' +
               '</div>';
      } else {
        // MODE B: ZOOMED OUT (< 12) -> Show 1 person face + n badge (e.g. +3)
        var primaryName = escapeHtml((primary.fullName && primary.fullName.trim()) ? primary.fullName.trim() : 'Family');
        var primaryInitials = escapeHtml(primary.initials || primaryName.charAt(0) || 'U');
        var primaryBg = getAvatarColor(primary.fullName);

        var innerAvatar = '';
        if (primary.avatarUrl && primary.avatarUrl.trim().length > 0) {
          innerAvatar = '<img src="' + escapeAttr(primary.avatarUrl) + '" class="life360-face-img" referrerpolicy="no-referrer" loading="eager" crossorigin="anonymous" onerror="handleAvatarImgError(this)" />' +
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

    // =========================================================================
    // Visual Smoothing & Interpolation Engine (Leaflet WebView Layer)
    // =========================================================================
    function HaversineDistMeters(lat1, lon1, lat2, lon2) {
      if (lat1 === lat2 && lon1 === lon2) return 0;
      var R = 6371000;
      var p1 = (lat1 * Math.PI) / 180;
      var p2 = (lat2 * Math.PI) / 180;
      var dp = ((lat2 - lat1) * Math.PI) / 180;
      var dl = ((lon2 - lon1) * Math.PI) / 180;
      var a = Math.sin(dp / 2) * Math.sin(dp / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
      var c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
      return R * c;
    }

    function ShortestAngleDelta(fromAngle, toAngle) {
      var delta = (toAngle - fromAngle) % 360;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      return delta;
    }

    function NormalizeAngle(deg) {
      var n = deg % 360;
      if (n < 0) n += 360;
      return n;
    }

    function NormalizeAct(act) {
      if (!act) return 'UNKNOWN';
      var u = String(act).toUpperCase();
      if (u === 'STATIONARY' || u === 'STILL') return 'STATIONARY';
      if (u === 'WALKING' || u === 'ON_FOOT') return 'WALKING';
      if (u === 'RUNNING') return 'RUNNING';
      if (u === 'CYCLING' || u === 'ON_BICYCLE') return 'CYCLING';
      if (u === 'DRIVING' || u === 'IN_VEHICLE' || u === 'HIGH_SPEED') return 'DRIVING';
      if (u === 'RIDING') return 'RIDING';
      return 'UNKNOWN';
    }

    var VisualSmoothingEngine = (function() {
      var tracks = {};

      return {
        processUpdate: function(input, leafletMarker) {
          if (!input || !leafletMarker) return;
          var memberId = input.memberId || input.id;
          if (!memberId) return;

          var lat = parseFloat(input.latitude != null ? input.latitude : input.lat);
          var lng = parseFloat(input.longitude != null ? input.longitude : input.lng);
          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

          var heading = parseFloat(input.heading != null ? input.heading : 0);
          if (isNaN(heading)) heading = 0;
          heading = NormalizeAngle(heading);

          var speed = parseFloat(input.speed != null ? input.speed : 0);
          if (isNaN(speed) || speed < 0) speed = 0;

          var accuracy = parseFloat(input.accuracy != null ? input.accuracy : 10);
          if (isNaN(accuracy) || accuracy < 0) accuracy = 15;

          var timestamp = typeof input.timestamp === 'number' ? input.timestamp : Date.now();
          var activity = NormalizeAct(input.activity || input.activityType);
          var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

          var track = tracks[memberId];
          var candidatePos = { lat: lat, lng: lng };

          if (!track) {
            track = {
              memberId: memberId,
              marker: leafletMarker,
              startPos: candidatePos,
              targetPos: candidatePos,
              currentPos: candidatePos,
              startHeading: heading,
              targetHeading: heading,
              currentHeading: heading,
              startTime: now,
              durationMs: 0,
              lastUpdateTimestamp: timestamp,
              lastConfirmedPos: candidatePos,
              lastReportedSpeed: speed,
              lastReportedAccuracy: accuracy,
              activity: activity,
              consecutiveSpikes: 0,
              rafId: null
            };
            tracks[memberId] = track;
            leafletMarker.setLatLng([lat, lng]);
            return;
          }

          track.marker = leafletMarker;

          var retargetStartPos = track.currentPos || candidatePos;
          var retargetStartHeading = track.currentHeading != null ? track.currentHeading : heading;

          var distMeters = HaversineDistMeters(
            track.lastConfirmedPos.lat,
            track.lastConfirmedPos.lng,
            candidatePos.lat,
            candidatePos.lng
          );
          var rawDt = (timestamp - track.lastUpdateTimestamp) / 1000;
          var dtSeconds = rawDt > 0 ? Math.min(rawDt, 60) : 1.0;

          // Outlier Spike Protection (Requirement 9)
          var maxPlausibleMps = 45.0;
          if (activity === 'STATIONARY') maxPlausibleMps = 9.0;
          else if (activity === 'WALKING') maxPlausibleMps = 8.5;
          else if (activity === 'RUNNING') maxPlausibleMps = 14.0;
          else if (activity === 'CYCLING') maxPlausibleMps = 25.0;
          else if (activity === 'DRIVING' || activity === 'RIDING') maxPlausibleMps = 65.0;

          var impliedMps = dtSeconds > 0 ? (distMeters / dtSeconds) : 0;
          var isSpike = (impliedMps > maxPlausibleMps && distMeters > 35 && (activity === 'STATIONARY' || activity === 'WALKING' || impliedMps > 80));

          if (isSpike) {
            track.consecutiveSpikes++;
            if (track.consecutiveSpikes === 1) {
              return;
            }
          } else {
            track.consecutiveSpikes = 0;
          }

          // Noise Deadband (Requirements 4, 8)
          var deadbandMeters = 1.5;
          if (activity === 'STATIONARY') {
            deadbandMeters = Math.max(5.0, Math.min(16.0, accuracy * 0.55));
          } else if (activity === 'WALKING') {
            deadbandMeters = Math.max(1.5, Math.min(4.5, accuracy * 0.25));
          } else if (activity === 'RUNNING') {
            deadbandMeters = 2.0;
          } else if (activity === 'CYCLING') {
            deadbandMeters = 2.5;
          } else if (activity === 'DRIVING' || activity === 'RIDING') {
            deadbandMeters = speed > 15 ? 0.8 : 2.0;
          }

          if (distMeters < deadbandMeters) {
            var deltaH = Math.abs(ShortestAngleDelta(retargetStartHeading, heading));
            if (deltaH > 4) {
              this.startAnimation(track, retargetStartPos, retargetStartPos, retargetStartHeading, heading, 600, now);
            }
            return;
          }

          // Accuracy weighting (Requirement 5)
          var targetPos = candidatePos;
          if (accuracy > 30) {
            var confidenceWeight = Math.max(0.25, Math.min(0.85, 25 / accuracy));
            targetPos = {
              lat: retargetStartPos.lat + (candidatePos.lat - retargetStartPos.lat) * confidenceWeight,
              lng: retargetStartPos.lng + (candidatePos.lng - retargetStartPos.lng) * confidenceWeight
            };
          }

          // Dynamic duration (Requirements 2, 3, 6)
          var intervalMs = rawDt > 0 ? rawDt * 1000 : 1200;
          var durationMs = 1000;
          if (activity === 'DRIVING' || activity === 'RIDING') {
            durationMs = speed > 50 ? Math.min(intervalMs * 0.95, 1100) : Math.min(intervalMs * 1.05, 1400);
            durationMs = Math.max(durationMs, 500);
          } else if (activity === 'WALKING' || activity === 'RUNNING') {
            durationMs = Math.min(intervalMs * 1.05, 2000);
            durationMs = Math.max(durationMs, 800);
          } else if (activity === 'STATIONARY') {
            durationMs = Math.min(intervalMs * 0.8, 1200);
            durationMs = Math.max(durationMs, 600);
          } else {
            durationMs = Math.min(intervalMs * 1.0, 2200);
            durationMs = Math.max(durationMs, 700);
          }

          var shortestDelta = ShortestAngleDelta(retargetStartHeading, heading);
          var targetAdjustedHeading = retargetStartHeading + shortestDelta;

          track.lastConfirmedPos = candidatePos;
          track.lastUpdateTimestamp = timestamp;
          track.lastReportedSpeed = speed;
          track.lastReportedAccuracy = accuracy;
          track.activity = activity;

          this.startAnimation(
            track,
            retargetStartPos,
            targetPos,
            retargetStartHeading,
            targetAdjustedHeading,
            durationMs,
            now
          );
        },

        startAnimation: function(track, startPos, targetPos, startHeading, targetHeading, durationMs, now) {
          if (track.rafId) {
            cancelAnimationFrame(track.rafId);
            track.rafId = null;
          }

          track.startPos = startPos;
          track.targetPos = targetPos;
          track.currentPos = startPos;
          track.startHeading = startHeading;
          track.targetHeading = targetHeading;
          track.currentHeading = startHeading;
          track.startTime = now;
          track.durationMs = durationMs;

          function step() {
            var curTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            var elapsed = Math.max(0, curTime - track.startTime);
            var rawProgress = track.durationMs > 0 ? Math.min(1.0, elapsed / track.durationMs) : 1.0;

            var easedT;
            if (track.lastReportedSpeed > 15) {
              easedT = rawProgress * (2 - rawProgress);
            } else {
              easedT = 1 - Math.pow(1 - rawProgress, 3);
            }

            var curLat = track.startPos.lat + (track.targetPos.lat - track.startPos.lat) * easedT;
            var curLng = track.startPos.lng + (track.targetPos.lng - track.startPos.lng) * easedT;
            var curHead = NormalizeAngle(track.startHeading + (track.targetHeading - track.startHeading) * easedT);

            track.currentPos = { lat: curLat, lng: curLng };
            track.currentHeading = curHead;

            if (track.marker) {
              track.marker.setLatLng([curLat, curLng]);
              var el = track.marker.getElement();
              if (el) {
                var beam = el.querySelector('.carering-radar-beam, .life360-radar-beam, .heading-beam, .self-heading-beam');
                if (beam) {
                  beam.style.transform = 'rotate(' + curHead + 'deg)';
                }
              }
            }

            // Smooth Map Camera Follow (Requirement 10)
            if (typeof activeFollowingMemberId !== 'undefined' && activeFollowingMemberId === track.memberId && !isUserInteracting) {
              var center = map.getCenter();
              var d = HaversineDistMeters(center.lat, center.lng, curLat, curLng);
              if (d > 16) {
                map.panTo([curLat, curLng], { animate: true, duration: 0.8, easeLinearity: 0.25 });
              }
            }

            if (rawProgress < 1.0) {
              track.rafId = requestAnimationFrame(step);
            } else {
              track.rafId = null;
            }
          }

          track.rafId = requestAnimationFrame(step);
        },

        removeTrack: function(memberId) {
          var t = tracks[memberId];
          if (t && t.rafId) {
            cancelAnimationFrame(t.rafId);
          }
          delete tracks[memberId];
        }
      };
    })();

    function reclusterAndRender() {
      try {
        // 1. Clean up temporary spiderfy fan-out layers only
        if (renderedSpiderfyLayers && renderedSpiderfyLayers.length > 0) {
          renderedSpiderfyLayers.forEach(function(l) {
            try { map.removeLayer(l); } catch (e) {}
          });
          renderedSpiderfyLayers = [];
        }

        if (!cachedMembers || cachedMembers.length === 0) {
          for (var mId in activeMemberMarkers) {
            try { map.removeLayer(activeMemberMarkers[mId].marker); } catch (e) {}
            VisualSmoothingEngine.removeTrack(mId);
          }
          activeMemberMarkers = {};
          for (var cK in activeClusterMarkers) {
            try { map.removeLayer(activeClusterMarkers[cK].marker); } catch (e) {}
          }
          activeClusterMarkers = {};
          return;
        }

        var validMembers = cachedMembers.filter(function(m) {
          return m && m.latitude != null && m.longitude != null && !isNaN(parseFloat(m.latitude)) && !isNaN(parseFloat(m.longitude));
        });

        // Maintain bubble geofence circles
        var activeIds = {};
        validMembers.forEach(function(m) {
          activeIds[m.id] = true;
          var isGhostSelf = Boolean(cachedCurrentUserId && m.id === cachedCurrentUserId && m.inBubble);
          if (isGhostSelf) {
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
        var activeSingleIds = {};
        var activeClusterKeys = {};

        clusters.forEach(function(cluster) {
          if (cluster.members.length === 1) {
            // Single individual member - reconcile with persistent marker
            var m = cluster.members[0];
            activeSingleIds[m.id] = true;
            var html = createMemberHtml(m);
            var mLat = parseFloat(m.latitude);
            var mLng = parseFloat(m.longitude);

            var existing = activeMemberMarkers[m.id];
            if (existing) {
              if (existing.currentHtml !== html) {
                var icon = L.divIcon({
                  html: html,
                  className: 'custom-leaflet-marker',
                  iconSize: [120, 110],
                  iconAnchor: [60, 85]
                });
                existing.marker.setIcon(icon);
                existing.currentHtml = html;
              }
              VisualSmoothingEngine.processUpdate({
                memberId: m.id,
                latitude: mLat,
                longitude: mLng,
                heading: m.heading,
                speed: m.speed,
                accuracy: m.accuracy,
                timestamp: m.timestamp,
                activity: m.activityType
              }, existing.marker);
            } else {
              var icon = L.divIcon({
                html: html,
                className: 'custom-leaflet-marker',
                iconSize: [120, 110],
                iconAnchor: [60, 85]
              });
              var marker = L.marker([mLat, mLng], { icon: icon }).addTo(map);
              marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                postToReactNative('MEMBER_CLICKED', { memberId: m.id });
              });
              activeMemberMarkers[m.id] = { marker: marker, currentHtml: html };
              VisualSmoothingEngine.processUpdate({
                memberId: m.id,
                latitude: mLat,
                longitude: mLng,
                heading: m.heading,
                speed: m.speed,
                accuracy: m.accuracy,
                timestamp: m.timestamp,
                activity: m.activityType
              }, marker);
            }
          } else {
            // Multiple members in cluster
            cluster.members.forEach(function(m) {
              if (activeMemberMarkers[m.id]) {
                try { map.removeLayer(activeMemberMarkers[m.id].marker); } catch (e) {}
                VisualSmoothingEngine.removeTrack(m.id);
                delete activeMemberMarkers[m.id];
              }
            });

            var isExpanded = (expandedClusterKey === cluster.key);

            if (isExpanded) {
              // If previously rendered as normal pod, remove the pod marker
              if (activeClusterMarkers[cluster.key]) {
                try { map.removeLayer(activeClusterMarkers[cluster.key].marker); } catch (e) {}
                delete activeClusterMarkers[cluster.key];
              }

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
              renderedSpiderfyLayers.push(centerMarker);

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
                renderedSpiderfyLayers.push(line);

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
                renderedSpiderfyLayers.push(memberMarker);
              });
            } else {
              // OLYMPIC CLUSTER STATE - PERSISTENT MARKER REUSE (Prevents Blinking & Flickering)
              activeClusterKeys[cluster.key] = true;
              var currentZoom = map.getZoom();
              var isZoomedIn = (currentZoom >= 12);
              var count = cluster.members.length;
              var clusterHtml = createClusterHtml(cluster.members, cachedCurrentUserId, currentZoom);

              var w = isZoomedIn ? (count >= 5 ? 165 : (count >= 3 ? 140 : 120)) : 120;
              var h = isZoomedIn ? (count > 2 ? 145 : 120) : 100;

              var existingCluster = activeClusterMarkers[cluster.key];
              if (existingCluster) {
                // Smoothly update center without destroying DOM if moved
                var curPos = existingCluster.marker.getLatLng();
                if (Math.abs(curPos.lat - cluster.center[0]) > 0.000005 || Math.abs(curPos.lng - cluster.center[1]) > 0.000005) {
                  existingCluster.marker.setLatLng(cluster.center);
                }

                // ONLY update icon DOM if HTML actually changed!
                if (existingCluster.currentHtml !== clusterHtml) {
                  var clusterIcon = L.divIcon({
                    html: clusterHtml,
                    className: 'custom-leaflet-marker',
                    iconSize: [w, h],
                    iconAnchor: [Math.round(w / 2), h - 4]
                  });
                  existingCluster.marker.setIcon(clusterIcon);
                  existingCluster.currentHtml = clusterHtml;
                }
              } else {
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
                activeClusterMarkers[cluster.key] = {
                  marker: clusterMarker,
                  currentHtml: clusterHtml
                };
              }
            }
          }
        });

        // 3. Remove cluster markers for clusters that are no longer active
        for (var cKey in activeClusterMarkers) {
          if (!activeClusterKeys[cKey]) {
            try { map.removeLayer(activeClusterMarkers[cKey].marker); } catch (e) {}
            delete activeClusterMarkers[cKey];
          }
        }

        // 4. Remove single markers for members that are no longer single
        for (var singleId in activeMemberMarkers) {
          if (!activeSingleIds[singleId]) {
            try { map.removeLayer(activeMemberMarkers[singleId].marker); } catch (e) {}
            VisualSmoothingEngine.removeTrack(singleId);
            delete activeMemberMarkers[singleId];
          }
        }
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
          VisualSmoothingEngine.removeTrack('__my_location__');
        }
      }

      reclusterAndRender();
    }

    function updateMyPosition(lat, lng, heading, speed, accuracy, timestamp, activity) {
      if (lat == null || lng == null) return;

      // Do NOT show the blue dot when current user is in any circle
      if (cachedIsInCircle || (cachedMembers && cachedMembers.length > 0)) {
        if (myLocationMarker) {
          try { map.removeLayer(myLocationMarker); } catch (e) {}
          myLocationMarker = null;
          VisualSmoothingEngine.removeTrack('__my_location__');
        }
        return;
      }

      var isFirstFix = !myLocationMarker;
      if (!myLocationMarker) {
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

        myLocationMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
        if (isFirstFix && !cachedIsInCircle && cachedMembers.length === 0) {
          map.setView([lat, lng], 16);
        }
      }

      VisualSmoothingEngine.processUpdate({
        memberId: '__my_location__',
        latitude: lat,
        longitude: lng,
        heading: heading,
        speed: speed,
        accuracy: accuracy,
        timestamp: timestamp,
        activity: activity
      }, myLocationMarker);
    }

    function panToPosition(lat, lng, zoom, offsetY) {
      if (!map || typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
      isUserInteracting = false;
      var targetZoom = zoom || 16;
      var targetLatLng = L.latLng(lat, lng);

      if (typeof offsetY === 'number' && offsetY !== 0) {
        try {
          var targetPoint = map.project([lat, lng], targetZoom);
          var shiftedCenterPoint = targetPoint.add([0, offsetY]);
          targetLatLng = map.unproject(shiftedCenterPoint, targetZoom);
        } catch (err) {}
      }

      var currentCenter = map.getCenter();
      var currentZoom = map.getZoom();
      var distMeters = currentCenter.distanceTo(targetLatLng);

      // 1. If camera is already focused on this member / cluster (< 25m distance), do NOT shake or bounce!
      if (distMeters < 25 && Math.abs(currentZoom - targetZoom) < 0.3) {
        return;
      }

      // Stop any ongoing animation to prevent camera fight and stutter
      try {
        if (typeof map.stop === 'function') map.stop();
      } catch (e) {}

      // 2. Smooth ground pan when nearby (< 4.5km) without parabolic zoom drop or shaking
      if (distMeters < 4500 && Math.abs(currentZoom - targetZoom) <= 1.2) {
        if (Math.abs(currentZoom - targetZoom) < 0.1) {
          map.panTo(targetLatLng, {
            animate: true,
            duration: Math.min(0.55, Math.max(0.3, distMeters / 1500)),
            easeLinearity: 0.25,
            noMoveStart: true
          });
        } else {
          map.setView(targetLatLng, targetZoom, {
            animate: true,
            duration: 0.5
          });
        }
        return;
      }

      // 3. For medium-long distance, smooth flight without jarring zoom drops
      map.flyTo(targetLatLng, targetZoom, {
        animate: true,
        duration: distMeters < 15000 ? 0.75 : 1.0,
        easeLinearity: 0.35
      });
    }

    function fitBoundsCoords(coords) {
      if (!coords || coords.length === 0) return;
      if (coords.length === 1) {
        panToPosition(coords[0][0], coords[0][1], 16, 0);
        return;
      }
      var bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 100],
        paddingBottomRight: [40, 240],
        maxZoom: 16.5,
        animate: true,
        duration: 0.8
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
            updateMyPosition(msg.latitude, msg.longitude, msg.heading, msg.speed, msg.accuracy, msg.timestamp, msg.activity);
            break;
          case 'SMOOTH_LOCATION_UPDATE':
            if (msg.memberId === '__my_location__') {
              updateMyPosition(msg.latitude, msg.longitude, msg.heading, msg.speed, msg.accuracy, msg.timestamp, msg.activity);
            } else if (activeMemberMarkers[msg.memberId]) {
              VisualSmoothingEngine.processUpdate(msg, activeMemberMarkers[msg.memberId].marker);
            } else {
              var memFound = false;
              var oldLat = null, oldLng = null;
              for (var mi = 0; mi < cachedMembers.length; mi++) {
                if (cachedMembers[mi].id === msg.memberId) {
                  oldLat = cachedMembers[mi].latitude;
                  oldLng = cachedMembers[mi].longitude;
                  cachedMembers[mi].latitude = msg.latitude;
                  cachedMembers[mi].longitude = msg.longitude;
                  if (msg.heading != null) cachedMembers[mi].heading = msg.heading;
                  if (msg.speed != null) cachedMembers[mi].speed = msg.speed;
                  if (msg.accuracy != null) cachedMembers[mi].accuracy = msg.accuracy;
                  if (msg.activity != null) cachedMembers[mi].activityType = msg.activity;
                  memFound = true;
                  break;
                }
              }
              if (memFound) {
                var moveDist = (oldLat != null && oldLng != null)
                  ? Math.hypot((msg.latitude - oldLat) * 111320, (msg.longitude - oldLng) * 111320)
                  : 999;
                if (moveDist > 25) {
                  reclusterAndRender();
                } else {
                  // If member is clustered and movement is small (<25m), smoothly update the cluster center without full recluster
                  for (var ck in activeClusterMarkers) {
                    if (ck.indexOf(msg.memberId) !== -1) {
                      var clusterMems = cachedMembers.filter(function(m) { return ck.indexOf(m.id) !== -1; });
                      if (clusterMems.length > 0) {
                        var sumLa = 0, sumLo = 0;
                        for (var cmi = 0; cmi < clusterMems.length; cmi++) {
                          sumLa += parseFloat(clusterMems[cmi].latitude) || 0;
                          sumLo += parseFloat(clusterMems[cmi].longitude) || 0;
                        }
                        activeClusterMarkers[ck].marker.setLatLng([sumLa / clusterMems.length, sumLo / clusterMems.length]);
                      }
                      break;
                    }
                  }
                }
              }
            }
            break;
          case 'SET_FOLLOWING_MEMBER':
            activeFollowingMemberId = msg.memberId || null;
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
          case 'SET_DISTANCE_UNIT':
            isImperialUnit = msg.unit === 'imperial';
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

    const [distancePrefs, setDistancePrefs] = React.useState<DistancePreferences>(() => distancePreferencesService.getPreferencesSync());

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

    useEffect(() => {
      const unsub = distancePreferencesService.subscribe((p) => {
        setDistancePrefs(p);
        postMessageToMap({ action: 'SET_DISTANCE_UNIT', unit: p.unit });
      });
      return unsub;
    }, []);

    useImperativeHandle(ref, () => ({
      animateToPosition: (lat: number, lng: number, zoom = 16, offsetY = 0) => {
        postMessageToMap({ action: 'PAN_TO', lat, lng, zoom, offsetY });
      },
      updateLiveLocation: (data: LiveLocationPayload) => {
        postMessageToMap({ action: 'SMOOTH_LOCATION_UPDATE', ...data });
      },
      setFollowingMember: (memberId: string | null) => {
        postMessageToMap({ action: 'SET_FOLLOWING_MEMBER', memberId });
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
      const toTimeMs = (val: any): number => {
        if (!val) return Date.now();
        if (typeof val === 'number') return val;
        if (val instanceof Date) return isNaN(val.getTime()) ? Date.now() : val.getTime();
        const d = new Date(val);
        return isNaN(d.getTime()) ? Date.now() : d.getTime();
      };

      const toIsoStr = (val: any): string | null => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString();
        try {
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : d.toISOString();
        } catch (_) {
          return null;
        }
      };

      return members.map((m) => {
        const isSelf = m.id === currentUserId;
        const isGhostSelf = isSelf && Boolean(m.inBubble);
        const bubble = getMemberBubbleInfo(m, isSelf, distancePrefs.unit);
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
          accuracy: (m as any).accuracy,
          activityType: m.activityType,
          timestamp: m.lastLocationTime ? toTimeMs(m.lastLocationTime) : (m.lastOnlineAt ? toTimeMs(m.lastOnlineAt) : Date.now()),
          batteryLevel: m.batteryLevel,
          isCharging: m.isCharging,
          isStationary: m.isStationary,
          isOnline: m.isOnline,
          initials: getMemberInitials(effectiveName),
          bubbleIcon: bubble.icon,
          bubbleText: bubble.text,
          inBubble: isGhostSelf,
          bubbleRadius: isGhostSelf ? (m.bubbleRadius || 2000) : 0,
          bubbleUntil: isGhostSelf ? toIsoStr(m.bubbleUntil) : null,
          stationarySince: m.stationarySince ? toIsoStr(m.stationarySince) : toIsoStr(m.lastOnlineAt),
        };
      });
    }, [members, nicknames, currentUserId, distancePrefs.unit]);

    const syncStateToMap = useCallback(() => {
      postMessageToMap({
        action: 'SET_STYLE',
        urlTemplate: mapStyle.urlTemplate,
        subdomains: mapStyle.subdomains,
        styleId: mapStyle.id,
      });
      postMessageToMap({
        action: 'SET_DISTANCE_UNIT',
        unit: distancePrefs.unit,
      });
      const effectiveIsInCircle = Boolean(isInCircle ?? (members && members.length > 0));
      if (!effectiveIsInCircle && myPosition && myPosition.latitude && myPosition.longitude) {
        postMessageToMap({
          action: 'UPDATE_MY_POSITION',
          latitude: myPosition.latitude,
          longitude: myPosition.longitude,
          heading: myPosition.heading,
          speed: myPosition.speed,
          accuracy: myPosition.accuracy,
          timestamp: myPosition.timestamp,
          activity: myPosition.activity,
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
          speed: myPosition.speed,
          accuracy: myPosition.accuracy,
          timestamp: myPosition.timestamp,
          activity: myPosition.activity,
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
        effectiveIsInCircle,
        distancePrefs.unit
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
          source={{ html: htmlContent, baseUrl: 'https://care-ring.onrender.com' }}
          mixedContentMode="always"
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
