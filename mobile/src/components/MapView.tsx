import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MemberData, getMemberInitials } from '../models/Member';
import { MapStyleConfig, MAP_STYLES } from '../models/MapStyle';

export interface MapViewRef {
  animateToPosition: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (members: MemberData[]) => void;
  setMapStyle: (style: MapStyleConfig) => void;
}

interface MapViewProps {
  currentUserId: string;
  members: MemberData[];
  myPosition?: { latitude: number; longitude: number; heading: number } | null;
  mapStyle?: MapStyleConfig;
  onMemberPress?: (member: MemberData) => void;
  onMapPress?: () => void;
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

    /* Custom Avatar Marker Style */
    .avatar-marker-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      user-select: none;
      transform: translate3d(0, 0, 0);
      transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
    }
    .avatar-marker-container:active {
      transform: scale(0.92);
    }
    .avatar-halo {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 3.5px solid #10B981;
      background: #2563EB;
      box-shadow: 0 4px 14px rgba(0,0,0,0.22), 0 0 12px rgba(16, 185, 129, 0.5);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .avatar-halo.offline {
      border-color: #94A3B8;
      box-shadow: 0 3px 10px rgba(0,0,0,0.18);
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
    .status-pill {
      margin-top: 4px;
      background: #FFFFFF;
      padding: 3px 8px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      font-size: 11px;
      font-weight: 700;
      color: #0F172A;
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
      background: #2563EB;
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
      background: rgba(37, 99, 235, 0.22);
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
    .blue-core {
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #2563EB;
    }
    .heading-beam {
      position: absolute;
      top: -12px;
      width: 0;
      height: 0;
      border-left: 12px solid transparent;
      border-right: 12px solid transparent;
      border-bottom: 24px solid rgba(59, 130, 246, 0.4);
      transform-origin: center 42px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
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

    function createMemberHtml(member) {
      var isMoving = member.speed > 3.0 && !member.isStationary;
      var ringColor = member.isOnline ? (isMoving ? '#10B981' : '#059669') : '#94A3B8';
      var haloClass = member.isOnline ? 'avatar-halo' : 'avatar-halo offline';
      var speedText = isMoving ? (Math.round(member.speed) + ' km/h') : 'Stationary';
      var batteryText = (member.isCharging ? '⚡' : '') + member.batteryLevel + '%';

      var avatarHtml = '';
      if (member.avatarUrl && member.avatarUrl.trim().length > 0) {
        avatarHtml = '<img src="' + member.avatarUrl + '" class="avatar-img" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'block\\';" />' +
                     '<div class="avatar-initials" style="display:none;">' + member.initials + '</div>';
      } else {
        avatarHtml = '<div class="avatar-initials">' + member.initials + '</div>';
      }

      return '<div class="avatar-marker-container">' +
               '<div class="' + haloClass + '" style="border-color:' + ringColor + '; box-shadow: 0 4px 14px rgba(0,0,0,0.22), 0 0 10px ' + ringColor + '66;">' +
                 avatarHtml +
               '</div>' +
               '<div class="status-pill">' + speedText + ' • ' + batteryText + '</div>' +
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
          iconSize: [80, 80],
          iconAnchor: [40, 40]
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
                   '<div class="white-ring"><div class="blue-core"></div></div>' +
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
      mapStyle = MAP_STYLES.life360Minimal,
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
    }));

    // Update members whenever member data changes
    useEffect(() => {
      const serializableMembers = members.map((m) => ({
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
      }));

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
            title="Life360 Map"
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
