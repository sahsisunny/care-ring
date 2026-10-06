export type MovementActivityType =
  | 'stationary'
  | 'walking'
  | 'running'
  | 'cycling'
  | 'driving'
  | 'high_speed';

export interface MovementActivityInfo {
  type: MovementActivityType;
  label: string; // e.g. "Stationary", "Walking", "Running", "Cycling", "Driving", "Highway Speed"
  verb: string; // e.g. "still", "walking", "running", "cycling", "driving", "driving at high speed"
  emoji: string; // 🧍, 🚶, 🏃, 🚴, 🚗, 🏎️
  badgeText: string; // e.g. "Walking • 4 km/h" or "Driving • 60 km/h"
  speedKmh: number;
  color: string;
  bgColor: string;
  textColor: string;
  cssKey: string; // Leaflet CSS class key: 'walking', 'running', 'cycling', 'driving', 'highspeed', 'stationary'
  animationType: 'walk-bounce' | 'run-dash' | 'cycle-pedal' | 'drive-rumble' | 'speed-zoom' | 'none';
}

/**
 * Classifies physical movement activity based on speed in km/h.
 * Real-world human movement speed tiers:
 * - < 1.8 km/h: Stationary / Idle
 * - 1.8 to < 7.5 km/h: Walking (average pedestrian speed 3-5 km/h)
 * - 7.5 to < 16.0 km/h: Running / Jogging (jogging pace ~8-12 km/h, fast run ~15 km/h)
 * - 16.0 to < 32.0 km/h: Cycling / Biking (average city bicycle pace 16-25 km/h)
 * - 32.0 to < 85.0 km/h: Driving (city/arterial vehicle speed)
 * - >= 85.0 km/h: Highway / High Speed Driving (expressway/highway)
 */
export function getMovementActivity(
  speed?: number | null,
  isStationary?: boolean
): MovementActivityInfo {
  const rawSpeed = typeof speed === 'number' && !isNaN(speed) && speed > 0 ? speed : 0;
  const roundedSpeed = Math.round(rawSpeed);

  // If explicitly flagged stationary or speed is below human walking threshold
  if (isStationary || rawSpeed < 1.8) {
    return {
      type: 'stationary',
      label: 'Stationary',
      verb: 'still',
      emoji: '🧍',
      badgeText: 'Stationary',
      speedKmh: roundedSpeed,
      color: '#64748B',
      bgColor: '#F1F5F9',
      textColor: '#334155',
      cssKey: 'stationary',
      animationType: 'none',
    };
  }

  if (rawSpeed < 7.5) {
    return {
      type: 'walking',
      label: 'Walking',
      verb: 'walking',
      emoji: '🚶',
      badgeText: `Walking • ${roundedSpeed} km/h`,
      speedKmh: roundedSpeed,
      color: '#10B981',
      bgColor: '#ECFDF5',
      textColor: '#065F46',
      cssKey: 'walking',
      animationType: 'walk-bounce',
    };
  }

  if (rawSpeed < 16.0) {
    return {
      type: 'running',
      label: 'Running',
      verb: 'running',
      emoji: '🏃',
      badgeText: `Running • ${roundedSpeed} km/h`,
      speedKmh: roundedSpeed,
      color: '#F59E0B',
      bgColor: '#FFFBEB',
      textColor: '#92400E',
      cssKey: 'running',
      animationType: 'run-dash',
    };
  }

  if (rawSpeed < 32.0) {
    return {
      type: 'cycling',
      label: 'Cycling',
      verb: 'cycling',
      emoji: '🚴',
      badgeText: `Cycling • ${roundedSpeed} km/h`,
      speedKmh: roundedSpeed,
      color: '#3B82F6',
      bgColor: '#EFF6FF',
      textColor: '#1E40AF',
      cssKey: 'cycling',
      animationType: 'cycle-pedal',
    };
  }

  if (rawSpeed < 85.0) {
    return {
      type: 'driving',
      label: 'Driving',
      verb: 'driving',
      emoji: '🚗',
      badgeText: `Driving • ${roundedSpeed} km/h`,
      speedKmh: roundedSpeed,
      color: '#6366F1',
      bgColor: '#EEF2FF',
      textColor: '#3730A3',
      cssKey: 'driving',
      animationType: 'drive-rumble',
    };
  }

  return {
    type: 'high_speed',
    label: 'Highway Speed',
    verb: 'driving at high speed',
    emoji: '🏎️',
    badgeText: `Highway • ${roundedSpeed} km/h`,
    speedKmh: roundedSpeed,
    color: '#EF4444',
    bgColor: '#FEF2F2',
    textColor: '#991B1B',
    cssKey: 'highspeed',
    animationType: 'speed-zoom',
  };
}
