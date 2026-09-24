import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MemberData, getMemberInitials } from '../models/Member';
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';

export interface MapViewRef {
  animateToPosition: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (members: MemberData[]) => void;
  setMapStyle: (style: MapStyleConfig) => void;
  triggerReaction: (lat: number, lng: number, emoji: string) => void;
  showRouteReplay: (coords: [number, number][], color?: string) => void;
  clearRouteReplay: () => void;
  showBubble: (lat: number, lng: number, radiusMeters?: number) => void;
  clearBubble: () => void;
}

interface MapViewProps {
  currentUserId: string;
  members: MemberData[];
  myPosition?: { latitude: number; longitude: number; heading: number } | null;
  mapStyle?: MapStyleConfig;
  onMemberPress?: (member: MemberData) => void;
  onMapPress?: () => void;
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
  initialZoom = 14
): string {
  const subdomainsStr = JSON.stringify(subdomains);

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
      background: #F1F5F9;
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

    /* Life360 Marker Styling */
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

    /* Life360 Speech Bubble Callout */
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
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #744BE4;
      opacity: 0.6;
      animation: pulseWave 2s infinite ease-out;
    }
    @keyframes pulseWave {
      0% { transform: scale(0.8); opacity: 0.6; }
      70% { opacity: 0.2; }
      100% { transform: scale(2.6); opacity: 0; }
    }
    .accuracy-halo {
      position: absolute;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(116, 75, 228, 0.22);
    }
    .white-ring {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #FFFFFF;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }
    .purple-core {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #744BE4;
    }
    .heading-beam {
      position: absolute;
      top: -12px;
      width: 0;
      height: 0;
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-bottom: 24px solid rgba(116, 75, 228, 0.4);
      transform-origin: center 42px;
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

    var map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: ${initialZoom},
      zoomControl: false,
      attributionControl: false
    });

    var currentTileLayer = L.tileLayer('${tileUrl}', {
      subdomains: ${subdomainsStr},
      maxZoom: 19
    }).addTo(map);

    var memberMarkers = {};
    var myLocationMarker = null;
    var activeRoutePolyline = null;
    var activeRouteMarkers = [];
    var activeBubbleCircle = null;

    function postToReactNative(type, data) {
      var msg = JSON.stringify({ type: type, data: data });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent.postMessage) {
        window.parent.postMessage(msg, '*');
      }
    }

    map.on('click', function() {
      postToReactNative('MAP_CLICKED', {});
    });

    function setTileLayer(url, subdomains) {
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTileLayer = L.tileLayer(url, {
        subdomains: subdomains || ['a', 'b', 'c', 'd'],
        maxZoom: 19
      }).addTo(map);
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
      var ringColor = m.isOnline ? (m.isMoving ? '#10B981' : '#744BE4') : '#94A3B8';

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
        avatarInner = '<img src="' + m.avatarUrl + '" class="avatar-img" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'flex\\';" />' +
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
        if (!m.latitude || !m.longitude) return;
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
      if (!lat || !lng) return;

      var beamHtml = '';
      if (heading > 0) {
        beamHtml = '<div class="heading-beam" style="transform: rotate(' + heading + 'deg);"></div>';
      }

      var html = '<div class="current-location-marker">' +
                   beamHtml +
                   '<div class="radar-pulse"></div>' +
                   '<div class="accuracy-halo"></div>' +
                   '<div class="white-ring"><div class="purple-core"></div></div>' +
                 '</div>';

      var icon = L.divIcon({
        html: html,
        className: 'current-loc-leaflet-marker',
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      });

      if (myLocationMarker) {
        myLocationMarker.setLatLng([lat, lng]);
        myLocationMarker.setIcon(icon);
      } else {
        myLocationMarker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
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
        color: color || '#744BE4',
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

      // End marker (purple dot)
      var endIcon = L.divIcon({
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#744BE4;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
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
        color: '#744BE4',
        weight: 2.5,
        dashArray: '6, 8',
        fillColor: '#744BE4',
        fillOpacity: 0.18
      }).addTo(map);
    }

    function clearBubbleCircle() {
      if (activeBubbleCircle) {
        map.removeLayer(activeBubbleCircle);
        activeBubbleCircle = null;
      }
    }

    window.addEventListener('message', function(e) {
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
            setTileLayer(msg.urlTemplate, msg.subdomains);
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
          case 'SHOW_BUBBLE':
            showBubbleCircle(msg.lat, msg.lng, msg.radiusMeters);
            break;
          case 'CLEAR_BUBBLE':
            clearBubbleCircle();
            break;
        }
      } catch (err) {}
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
      mapStyle = MAP_STYLES.careRingMinimal,
      onMemberPress,
      onMapPress,
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
    }));

    // Update members whenever member data changes
    useEffect(() => {
      const serializableMembers = members.map((m) => {
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

      postMessageToMap({
        action: 'UPDATE_MEMBERS',
        members: serializableMembers,
        currentUserId,
      });
    }, [members, currentUserId]);

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
      });
    }, [mapStyle]);

    const handleIncomingMessage = (msgData: string) => {
      try {
        const parsed = JSON.parse(msgData);
        if (parsed.type === 'MEMBER_CLICKED') {
          const found = members.find((m) => m.id === parsed.data.memberId);
          if (found && onMemberPress) {
            onMemberPress(found);
          }
        } else if (parsed.type === 'MAP_CLICKED') {
          onMapPress?.();
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
    }, [members, onMemberPress, onMapPress]);

    const initialLat = myPosition?.latitude || (members[0]?.latitude) || 20.5937;
    const initialLng = myPosition?.longitude || (members[0]?.longitude) || 78.9629;

    const htmlContent = generateLeafletHtml(
      mapStyle.urlTemplate,
      mapStyle.subdomains,
      initialLat,
      initialLng
    );

    if (Platform.OS === 'web') {
      return (
        <View style={styles.container}>
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            style={{ width: '100%', height: '100%', border: 'none' } as any}
            title="CareRing Map"
          />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
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
    ...StyleSheet.absoluteFill,
    backgroundColor: '#F1F5F9',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
});
