import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MemberData, getMemberInitials } from '../models/Member';
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';
import { TileCacheService, CacheStats, CacheProgress } from '../services/TileCacheService';

export interface MapViewRef {
  animateToPosition: (lat: number, lng: number, zoom?: number) => void;
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
  showBubble: (lat: number, lng: number, radiusMeters?: number) => void;
  clearBubble: () => void;
  cacheLocations: (locations: { id?: string; name: string; latitude: number; longitude: number }[]) => void;
  cacheCurrentView: () => void;
  clearTileCache: () => void;
  refreshCacheStats: () => void;
}

interface MapViewProps {
  currentUserId: string;
  members: MemberData[];
  myPosition?: { latitude: number; longitude: number; heading: number } | null;
  mapStyle?: MapStyleConfig;
  onMemberPress?: (member: MemberData) => void;
  onMapPress?: () => void;
  onCacheStatsUpdated?: (stats: CacheStats) => void;
  onCacheProgress?: (progress: CacheProgress) => void;
}

function getMemberBubbleInfo(m: MemberData): { icon: string; text: string } {
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
  styleId = 'careRingMinimal'
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
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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

    /* Custom Leaflet Marker Container */
    .custom-leaflet-marker {
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
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
      font-size: 12px;
    }
    .callout-text {
      font-size: 11px;
      font-weight: 700;
      color: #1E293B;
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
    // -------------------------------------------------------------
    var DB_NAME = 'CareRing_TileDB_v2';
    var DB_VERSION = 1;
    var STORE_NAME = 'raster_tiles';
    var dbInstance = null;

    function openTileDB() {
      if (dbInstance) return Promise.resolve(dbInstance);
      return new Promise(function(resolve) {
        try {
          if (!window.indexedDB) {
            resolve(null);
            return;
          }
          var req = window.indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              var store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            }
          };
          req.onsuccess = function(e) {
            dbInstance = e.target.result;
            resolve(dbInstance);
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

    function calculateDBStats() {
      return openTileDB().then(function(db) {
        if (!db) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B' });
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
                formattedSize: formatted
              });
            }
          };
          cursorReq.onerror = function() {
            postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B' });
          };
        } catch (err) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B' });
        }
      });
    }

    var statsDebounceTimer = null;
    function scheduleStatsUpdate() {
      if (statsDebounceTimer) clearTimeout(statsDebounceTimer);
      statsDebounceTimer = setTimeout(function() {
        calculateDBStats();
      }, 700);
    }

    var MAX_CACHE_BYTES = 60 * 1024 * 1024; // 60 MB smart quota

    function smartPruneIfExceeded(db) {
      if (!db) return;
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
            // Collect un-protected normal tiles (priority === 0)
            if (!val.priority || val.priority === 0) {
              nonProtected.push({
                key: val.key,
                size: val.sizeBytes || 0,
                score: (val.hitCount || 0) * 1000 + (val.timestamp || 0)
              });
            }
            cursor.continue();
          } else {
            // If totalBytes exceeds MAX_CACHE_BYTES, prune lowest score non-protected tiles
            if (totalBytes > MAX_CACHE_BYTES && nonProtected.length > 0) {
              nonProtected.sort(function(a, b) { return a.score - b.score; });
              var deleteKeys = [];
              var freed = 0;
              var targetToFree = totalBytes - (MAX_CACHE_BYTES * 0.8);
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
                  scheduleStatsUpdate();
                };
              }
            }
          }
        };
      } catch (err) {}
    }

    function getCachedTile(key) {
      return openTileDB().then(function(db) {
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

    function saveCachedTile(key, url, dataUrl, sizeBytes, z, x, y, priority) {
      return openTileDB().then(function(db) {
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
              scheduleStatsUpdate();
              smartPruneIfExceeded(db);
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

    function clearTileCache() {
      return openTileDB().then(function(db) {
        if (!db) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B' });
          return;
        }
        try {
          var tx = db.transaction(STORE_NAME, 'readwrite');
          var store = tx.objectStore(STORE_NAME);
          store.clear();
          tx.oncomplete = function() {
            postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B' });
          };
        } catch (e) {
          postToReactNative('CACHE_STATS_UPDATED', { count: 0, sizeBytes: 0, formattedSize: '0 B' });
        }
      });
    }

    function fetchAndSaveTile(url, key, z, x, y, priority) {
      return fetch(url, { mode: 'cors' })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function(blob) {
          return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function() {
              var dataUrl = reader.result;
              saveCachedTile(key, url, dataUrl, blob.size, z, x, y, priority);
              resolve(dataUrl);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        });
    }

    var OfflineTileLayer = L.TileLayer.extend({
      createTile: function(coords, done) {
        var tile = document.createElement('img');
        L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
        L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }
        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        var url = this.getTileUrl(coords);
        var sId = this.options.styleId || '${styleId}';
        var tileKey = sId + '_' + coords.z + '_' + coords.x + '_' + coords.y;

        getCachedTile(tileKey).then(function(cached) {
          if (cached && cached.dataUrl) {
            tile.src = cached.dataUrl;
          } else {
            if (navigator && navigator.onLine === false) {
              var isDarkArea = sId.toLowerCase().indexOf('dark') !== -1;
              var bgFill = isDarkArea ? '#090D16' : '#F1F5F9';
              var strokeCol = isDarkArea ? '#1E293B' : '#E2E8F0';
              var txtCol = isDarkArea ? '#475569' : '#94A3B8';
              tile.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="' + bgFill + '" stroke="' + strokeCol + '"/><text x="128" y="128" text-anchor="middle" fill="' + txtCol + '" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600">Offline Area</text></svg>'
              );
              return;
            }

            // Immediately assign tile.src to display dark/light map without network delays
            tile.src = url;

            // Cache in background for offline use without blocking
            fetchAndSaveTile(url, tileKey, coords.z, coords.x, coords.y, 0).catch(function() {});
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
      styleId: '${styleId}'
    }).addTo(map);

    // Initial stats check on startup
    calculateDBStats();

    var memberMarkers = {};
    var myLocationMarker = null;
    var activeRoutePolyline = null;
    var activeRouteMarkers = [];
    var activeBubbleCircle = null;
    var activeTimelineGroup = null;

    map.on('click', function() {
      postToReactNative('MAP_CLICKED', {});
    });

    function setTileLayer(url, subdomains, customStyleId) {
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      activeTileUrl = url;
      activeSubdomains = subdomains || ['a', 'b', 'c', 'd'];
      var sId = customStyleId || (url.toLowerCase().indexOf('dark') !== -1 ? 'darkMinimal' : 'careRingMinimal');
      var isDark = sId.toLowerCase().indexOf('dark') !== -1 || url.toLowerCase().indexOf('dark') !== -1;

      currentTileLayer = new OfflineTileLayer(url, {
        subdomains: activeSubdomains,
        maxZoom: 19,
        styleId: sId
      }).addTo(map);

      document.body.style.backgroundColor = isDark ? '#090D16' : '#F1F5F9';
      var mapElem = document.getElementById('map');
      if (mapElem) mapElem.style.backgroundColor = isDark ? '#090D16' : '#F1F5F9';
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
                var sub = activeSubdomains[Math.abs(tx + ty) % activeSubdomains.length];
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
      var maxParallel = 4;

      postToReactNative('CACHE_PROGRESS', {
        current: 0,
        total: total,
        locationName: 'Preparing ' + locationsList.length + ' frequent locations...',
        isDone: false
      });

      function step() {
        if (queue.length === 0) {
          if (activeCount === 0) {
            calculateDBStats();
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

            getCachedTile(item.key).then(function(existing) {
              if (existing && existing.dataUrl) {
                completed++;
                activeCount--;
                postToReactNative('CACHE_PROGRESS', {
                  current: completed,
                  total: total,
                  locationName: item.locationName,
                  isDone: completed >= total
                });
                step();
              } else {
                fetchAndSaveTile(item.url, item.key, item.z, item.x, item.y, 2)
                  .then(function() {
                    completed++;
                    activeCount--;
                    postToReactNative('CACHE_PROGRESS', {
                      current: completed,
                      total: total,
                      locationName: item.locationName,
                      isDone: completed >= total
                    });
                    step();
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
                    step();
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
            var activeSId = (currentTileLayer && currentTileLayer.options && currentTileLayer.options.styleId) || '${styleId}';
            var k = activeSId + '_' + z + '_' + x + '_' + y;
            if (!seen[k]) {
              seen[k] = true;
              var sub = activeSubdomains[Math.abs(x + y) % activeSubdomains.length];
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
      var maxParallel = 4;

      postToReactNative('CACHE_PROGRESS', {
        current: 0,
        total: total,
        locationName: 'Downloading current view area...',
        isDone: false
      });

      function step() {
        if (queue.length === 0) {
          if (activeCount === 0) {
            calculateDBStats();
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

            getCachedTile(item.key).then(function(existing) {
              if (existing && existing.dataUrl) {
                completed++;
                activeCount--;
                postToReactNative('CACHE_PROGRESS', {
                  current: completed,
                  total: total,
                  locationName: item.locationName,
                  isDone: completed >= total
                });
                step();
              } else {
                fetchAndSaveTile(item.url, item.key, item.z, item.x, item.y, 1)
                  .then(function() {
                    completed++;
                    activeCount--;
                    postToReactNative('CACHE_PROGRESS', {
                      current: completed,
                      total: total,
                      locationName: item.locationName,
                      isDone: completed >= total
                    });
                    step();
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
                    step();
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

    function createMemberHtml(m) {
      var name = escapeHtml((m.fullName && m.fullName.trim()) ? m.fullName.trim() : 'Family');
      var firstName = name.split(' ')[0];
      var initials = escapeHtml(m.initials || 'U');
      var bgColor = getAvatarColor(m.fullName);
      var ringColor = m.isOnline ? (m.isMoving ? '#10B981' : '#4F46E5') : '#94A3B8';

      var bubbleIcon = m.bubbleIcon || (m.isMoving ? '🚗' : '📍');
      var bubbleText = escapeHtml(m.bubbleText || (m.isMoving ? Math.round(m.speed) + ' km/h' : 'Family Member'));

      var batteryHtml = '';
      if (m.batteryLevel !== undefined && m.batteryLevel !== null) {
        var bColor = m.isCharging ? '#10B981' : (m.batteryLevel <= 20 ? '#EF4444' : (m.batteryLevel <= 50 ? '#F59E0B' : '#10B981'));
        var bolt = m.isCharging ? '⚡' : '';
        batteryHtml = '<div class="avatar-battery-pill">' +
                        '<span style="color:' + bColor + ';">' + (bolt || '🔋') + '</span>' +
                        '<span>' + m.batteryLevel + '%</span>' +
                      '</div>';
      }

      var avatarInner = '';
      if (m.avatarUrl && m.avatarUrl.trim().length > 0) {
        avatarInner = '<img src="' + m.avatarUrl + '" class="avatar-img" onerror="handleAvatarImgError(this)" />' +
                      '<div class="avatar-initials" style="display:none; width:100%; height:100%; background:' + bgColor + '; align-items:center; justify-content:center;">' + initials + '</div>';
      } else {
        avatarInner = '<div class="avatar-initials" style="width:100%; height:100%; background:' + bgColor + '; display:flex; align-items:center; justify-content:center;">' + initials + '</div>';
      }

      return '<div class="marker-wrapper">' +
               '<div class="callout-bubble">' +
                 '<span class="callout-icon">' + bubbleIcon + '</span>' +
                 '<span class="callout-text">' + bubbleText + '</span>' +
               '</div>' +
               '<div class="avatar-halo" style="border-color:' + ringColor + ';">' +
                 '<div class="avatar-inner">' + avatarInner + '</div>' +
                 batteryHtml +
               '</div>' +
               '<div class="avatar-name-pill">' + firstName + '</div>' +
             '</div>';
    }



    function updateMembers(members, currentUserId) {
      var activeIds = {};

      members.forEach(function(m) {
        if (m.latitude == null || m.longitude == null) return;
        activeIds[m.id] = true;

        var html = createMemberHtml(m);
        var icon = L.divIcon({
          html: html,
          className: 'custom-leaflet-marker',
          iconSize: [120, 110],
          iconAnchor: [60, 85]
        });

        if (memberMarkers[m.id]) {
          memberMarkers[m.id].setLatLng([m.latitude, m.longitude]);
          memberMarkers[m.id].setIcon(icon);
        } else {
          var marker = L.marker([m.latitude, m.longitude], { icon: icon }).addTo(map);
          marker.on('click', function(e) {
            L.DomEvent.stopPropagation(e);
            postToReactNative('MEMBER_CLICKED', { memberId: m.id });
          });
          memberMarkers[m.id] = marker;
        }
      });

      // Remove inactive markers
      for (var id in memberMarkers) {
        if (!activeIds[id]) {
          map.removeLayer(memberMarkers[id]);
          delete memberMarkers[id];
        }
      }
    }



    function updateMyPosition(lat, lng, heading) {
      if (lat == null || lng == null) return;

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

      if (isFirstFix && Object.keys(memberMarkers).length <= 1) {
        map.setView([lat, lng], 16);
      }
    }

    function panToPosition(lat, lng, zoom) {
      map.flyTo([lat, lng], zoom || 16, { duration: 1.1, easeLinearity: 0.25 });
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

    function showBubbleCircle(lat, lng, radiusMeters) {
      clearBubbleCircle();
      activeBubbleCircle = L.circle([lat, lng], {
        radius: radiusMeters || 800,
        color: '#4F46E5',
        weight: 2.5,
        dashArray: '6, 8',
        fillColor: '#4F46E5',
        fillOpacity: 0.18
      }).addTo(map);
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
            updateMembers(msg.members, msg.currentUserId);
            break;
          case 'UPDATE_MY_POSITION':
            updateMyPosition(msg.latitude, msg.longitude, msg.heading);
            break;
          case 'PAN_TO':
            panToPosition(msg.lat, msg.lng, msg.zoom);
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
            showBubbleCircle(msg.lat, msg.lng, msg.radiusMeters);
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
            clearTileCache();
            break;
          case 'REQUEST_CACHE_STATS':
            calculateDBStats();
            break;
        }
      } catch (err) {}
    }

    window.addEventListener('message', handleIncomingMapMessage);
    document.addEventListener('message', handleIncomingMapMessage);

    if (${hasInitialPosition}) {
      updateMyPosition(${initialLat}, ${initialLng}, ${initialHeading});
    }

    window.addEventListener('resize', function() {
      if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
      }
    });

    setTimeout(function() {
      if (typeof map !== 'undefined' && map) {
        map.invalidateSize();
      }
      postToReactNative('MAP_READY', {});
    }, 100);
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
      mapStyle = MAP_STYLES.careRingMinimal,
      onMemberPress,
      onMapPress,
      onCacheStatsUpdated,
      onCacheProgress,
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
      animateToPosition: (lat: number, lng: number, zoom = 16) => {
        postMessageToMap({ action: 'PAN_TO', lat, lng, zoom });
      },
      fitBounds: (memberList: MemberData[]) => {
        const coords = memberList
          .filter((m) => m.latitude && m.longitude)
          .map((m) => [m.latitude, m.longitude]);
        postMessageToMap({ action: 'FIT_BOUNDS', coords });
      },
      setMapStyle: (style: MapStyleConfig) => {
        postMessageToMap({
          action: 'SET_STYLE',
          urlTemplate: style.urlTemplate,
          subdomains: style.subdomains,
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
      showBubble: (lat: number, lng: number, radiusMeters?: number) => {
        postMessageToMap({
          action: 'SHOW_BUBBLE',
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
      clearTileCache: () => {
        postMessageToMap({ action: 'CLEAR_TILE_CACHE' });
      },
      refreshCacheStats: () => {
        postMessageToMap({ action: 'REQUEST_CACHE_STATS' });
      },
    }));

    const getSerializableMembers = useCallback(() => {
      return members.map((m) => {
        const bubble = getMemberBubbleInfo(m);
        return {
          id: m.id,
          fullName: m.fullName,
          avatarUrl: m.avatarUrl,
          latitude: m.latitude,
          longitude: m.longitude,
          speed: m.speed,
          heading: m.heading,
          batteryLevel: m.batteryLevel,
          isCharging: m.isCharging,
          isStationary: m.isStationary,
          isOnline: m.isOnline,
          initials: getMemberInitials(m.fullName),
          bubbleIcon: bubble.icon,
          bubbleText: bubble.text,
        };
      });
    }, [members]);

    const syncStateToMap = useCallback(() => {
      postMessageToMap({
        action: 'SET_STYLE',
        urlTemplate: mapStyle.urlTemplate,
        subdomains: mapStyle.subdomains,
        styleId: mapStyle.id,
      });
      if (myPosition && myPosition.latitude && myPosition.longitude) {
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
      });
    }, [myPosition, getSerializableMembers, currentUserId, mapStyle.id, mapStyle.urlTemplate, mapStyle.subdomains]);

    // Update members whenever member data changes
    useEffect(() => {
      postMessageToMap({
        action: 'UPDATE_MEMBERS',
        members: getSerializableMembers(),
        currentUserId,
      });
    }, [getSerializableMembers, currentUserId]);

    // Update my position whenever device location updates
    useEffect(() => {
      if (myPosition && myPosition.latitude && myPosition.longitude) {
        postMessageToMap({
          action: 'UPDATE_MY_POSITION',
          latitude: myPosition.latitude,
          longitude: myPosition.longitude,
          heading: myPosition.heading,
        });
      }
    }, [myPosition]);

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
          onMapPress?.();
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
    }, [members, onMemberPress, onMapPress, syncStateToMap]);

    const initialLat = myPosition?.latitude || (members[0]?.latitude) || 20.5937;
    const initialLng = myPosition?.longitude || (members[0]?.longitude) || 78.9629;
    const initialZoom = myPosition?.latitude || members[0]?.latitude ? 16 : 14;
    const initialHeading = myPosition?.heading || 0;
    const hasInitialPosition = Boolean(myPosition && myPosition.latitude && myPosition.longitude);

    const htmlContent = generateLeafletHtml(
      mapStyle.urlTemplate,
      mapStyle.subdomains,
      initialLat,
      initialLng,
      initialZoom,
      initialHeading,
      hasInitialPosition,
      mapStyle.id
    );

    const isDarkStyle = mapStyle.id.toLowerCase().includes('dark') || mapStyle.urlTemplate.toLowerCase().includes('dark');

    if (Platform.OS === 'web') {
      return (
        <View style={[styles.container, { backgroundColor: isDarkStyle ? '#090D16' : '#F1F5F9' }]}>
          <iframe
            key={mapStyle.id}
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
          key={mapStyle.id}
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
