'use client';

import React, { useState } from 'react';

interface MemberData {
  id: string;
  name: string;
  role: string;
  avatarText: string;
  statusText: string;
  speed: string;
  battery: string;
  batteryColor: string;
  batteryLevel: number;
  locationName: string;
  isDriving?: boolean;
  isSafePlace?: boolean;
  top: string;
  left: string;
}

const MEMBERS: MemberData[] = [
  {
    id: 'sunny',
    name: 'Sunny Sahsi',
    role: 'Circle Admin • Driving',
    avatarText: '🏎️',
    statusText: 'Driving on Central Expressway',
    speed: '42 MPH',
    battery: '88%',
    batteryColor: '#10B981',
    batteryLevel: 88,
    locationName: 'Northbound Expy',
    isDriving: true,
    top: '48%',
    left: '52%',
  },
  {
    id: 'mom',
    name: 'Mom',
    role: 'Safe Home • Arrived 22m ago',
    avatarText: '👩',
    statusText: 'Inside Home Geofence',
    speed: '0 MPH',
    battery: '94%',
    batteryColor: '#10B981',
    batteryLevel: 94,
    locationName: 'Home (Geofence)',
    isSafePlace: true,
    top: '36%',
    left: '22%',
  },
  {
    id: 'emma',
    name: 'Emma',
    role: 'Walking • In Motion',
    avatarText: '👧',
    statusText: 'Walking near City Library',
    speed: '3 MPH',
    battery: '74%',
    batteryColor: '#10B981',
    batteryLevel: 74,
    locationName: 'Civic Park & 5th Ave',
    top: '68%',
    left: '70%',
  },
  {
    id: 'dad',
    name: 'Dad',
    role: 'Work Office • Stationary',
    avatarText: '👨',
    statusText: 'Tech Campus Building B',
    speed: '0 MPH',
    battery: '52%',
    batteryColor: '#F59E0B',
    batteryLevel: 52,
    locationName: 'Downtown Tech Park',
    top: '25%',
    left: '76%',
  },
];

export function RealMapMockup() {
  const [selectedMember, setSelectedMember] = useState<MemberData>(MEMBERS[0]);
  const [activeTab, setActiveTab] = useState<'location' | 'driving' | 'safety' | 'settings'>('location');
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'streets'>('dark');

  return (
    <div className="phone-mockup-wrapper">
      <div className="phone-outer-chassis">
        <div className="phone-screen">
          {/* Dynamic Island */}
          <div className="phone-island">
            <div className="island-camera" />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10B981' }} />
          </div>

          {/* Status Bar */}
          <div className="phone-status-bar">
            <span>9:41</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px' }}>5G</span>
              <svg width="14" height="10" viewBox="0 0 16 12" fill="#94A3B8">
                <rect x="0" y="8" width="2" height="4" rx="1" />
                <rect x="4" y="6" width="2" height="6" rx="1" />
                <rect x="8" y="4" width="2" height="8" rx="1" />
                <rect x="12" y="1" width="2" height="11" rx="1" />
              </svg>
              <div
                style={{
                  border: '1px solid #94A3B8',
                  borderRadius: '3px',
                  padding: '1px',
                  width: '18px',
                  height: '9px',
                  display: 'flex',
                }}
              >
                <div style={{ width: '85%', height: '100%', background: '#10B981', borderRadius: '1px' }} />
              </div>
            </div>
          </div>

          {/* Map Viewport Area */}
          <div className="phone-map-viewport">
            {/* Top Floating Circle Switcher Bar */}
            <div className="phone-circle-header">
              <div className="phone-circle-pill">
                <span className="phone-circle-dot" />
                <span>Family Circle (4)</span>
                <span style={{ fontSize: '9px', opacity: 0.7 }}>▼</span>
              </div>
              <div className="phone-sos-badge">
                <span>🚨</span>
                <span>SOS</span>
              </div>
            </div>

            {/* Floating Map Actions (Right Controls, borderRadius: 12px) */}
            <div className="phone-map-actions">
              <button
                type="button"
                className="phone-action-btn"
                onClick={() =>
                  setMapStyle((prev) => (prev === 'dark' ? 'satellite' : prev === 'satellite' ? 'streets' : 'dark'))
                }
                title="Cycle map style"
              >
                🗺️
              </button>
              <button
                type="button"
                className="phone-action-btn"
                onClick={() => setSelectedMember(MEMBERS[0])}
                title="Recenter GPS"
              >
                🎯
              </button>
              <button
                type="button"
                className="phone-action-btn"
                title="Circle Safe Chat"
              >
                💬
              </button>
            </div>

            {/* Safe Place Home Geofence Ring */}
            <div className="phone-geofence-ring">
              <div className="phone-geofence-label">🏡 Safe Home Geofence (150m)</div>
            </div>

            {/* Radar Pulses from active user */}
            <div className="phone-radar-pulse" />
            <div className="phone-radar-pulse-2" />

            {/* Render Member Pins */}
            {MEMBERS.map((member) => {
              const isSelected = selectedMember.id === member.id;
              return (
                <div
                  key={member.id}
                  className="phone-pin"
                  style={{
                    top: member.top,
                    left: member.left,
                    transform: isSelected ? 'translate(-50%, -50%) scale(1.15)' : 'translate(-50%, -50%)',
                    zIndex: isSelected ? 40 : 25,
                  }}
                  onClick={() => setSelectedMember(member)}
                >
                  <div
                    className={`phone-pin-avatar ${member.isDriving ? 'driving' : member.isSafePlace ? 'safe' : ''}`}
                    style={{
                      boxShadow: isSelected
                        ? '0 0 20px rgba(99, 102, 241, 0.9)'
                        : '0 4px 16px rgba(0,0,0,0.6)',
                    }}
                  >
                    <span>{member.avatarText}</span>
                    <span className="phone-pin-battery" style={{ color: member.batteryColor }}>
                      {member.battery}
                    </span>
                  </div>
                  <div className="phone-pin-label">{member.name.split(' ')[0]}</div>
                  {member.isDriving && (
                    <div className="phone-speed-badge">{member.speed}</div>
                  )}
                </div>
              );
            })}

            {/* Bottom Card for Selected Member */}
            <div className="phone-floating-card">
              <div className="phone-card-header">
                <div className="phone-card-user">
                  <span style={{ fontSize: '18px' }}>{selectedMember.avatarText}</span>
                  <div>
                    <div className="phone-card-title">{selectedMember.name}</div>
                    <div className="phone-card-sub">{selectedMember.statusText}</div>
                  </div>
                </div>
                <div
                  style={{
                    background: selectedMember.isDriving
                      ? 'rgba(0, 210, 254, 0.15)'
                      : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${selectedMember.isDriving ? '#00D2FE' : '#10B981'}`,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: selectedMember.isDriving ? '#00D2FE' : '#10B981',
                  }}
                >
                  {selectedMember.isDriving ? '🏎️ Driving' : '📍 Present'}
                </div>
              </div>

              <div className="phone-card-stats">
                <div className="phone-stat-item">
                  <span className="phone-stat-label">Velocity</span>
                  <span className="phone-stat-val">{selectedMember.speed}</span>
                </div>
                <div className="phone-stat-item">
                  <span className="phone-stat-label">Battery Level</span>
                  <span className="phone-stat-val" style={{ color: selectedMember.batteryColor }}>
                    {selectedMember.battery} (Optimal)
                  </span>
                </div>
                <div className="phone-stat-item">
                  <span className="phone-stat-label">Location</span>
                  <span className="phone-stat-val" style={{ fontSize: '9.5px' }}>
                    {selectedMember.locationName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Real Mobile Navigation Dock: 4 Tabs matching CareRing Native */}
          <div className="phone-dock">
            <div
              className={`phone-dock-item ${activeTab === 'location' ? 'active' : ''}`}
              onClick={() => setActiveTab('location')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <polygon points="12 8 8 12 12 16 16 12 12 8" />
              </svg>
              <span>Location</span>
            </div>

            <div
              className={`phone-dock-item ${activeTab === 'driving' ? 'active' : ''}`}
              onClick={() => setActiveTab('driving')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
              <span>Driving</span>
            </div>

            <div
              className={`phone-dock-item ${activeTab === 'safety' ? 'active' : ''}`}
              onClick={() => setActiveTab('safety')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Safety</span>
            </div>

            <div
              className={`phone-dock-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
