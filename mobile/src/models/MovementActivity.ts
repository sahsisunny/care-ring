export type MovementActivityType =
  | 'stationary'
  | 'walking'
  | 'running'
  | 'cycling'
  | 'driving'
  | 'riding'
  | 'high_speed'
  | 'unknown';

export interface MovementActivityInfo {
  type: MovementActivityType;
  label: string; // e.g. "Stationary", "Walking", "Running", "Cycling", "Driving", "Riding", "Highway Speed"
  verb: string; // e.g. "still", "walking", "running", "cycling", "driving", "riding", "driving at high speed"
  emoji: string; // 🧍, 🚶, 🏃, 🚴, 🚗, 🏍️, 🏎️
  badgeText: string; // e.g. "Walking • 4 km/h" or "Driving • 60 km/h"
  speedKmh: number;
  color: string;
  bgColor: string;
  textColor: string;
  cssKey: string; // Leaflet CSS class key: 'walking', 'running', 'cycling', 'driving', 'riding', 'highspeed', 'stationary'
  animationType: 'walk-bounce' | 'run-dash' | 'cycle-pedal' | 'drive-rumble' | 'speed-zoom' | 'none';
}

/**
 * Returns activity display metadata based on confirmed activity type or speed.
 * When confirmedType is provided from the Smart Activity Detection Engine,
 * it guarantees high fidelity, hysteresis stability, and accurate state (including Riding & Driving in traffic).
 */
export function getMovementActivity(
  speed?: number | null,
  isStationary?: boolean,
  confirmedType?: string | null
): MovementActivityInfo {
  const rawSpeed = typeof speed === 'number' && !isNaN(speed) && speed > 0 ? speed : 0;
  const roundedSpeed = Math.round(rawSpeed);

  const normalizedConfirmed = confirmedType
    ? confirmedType.trim().toLowerCase()
    : null;

  // 1. Direct handling of Confirmed Activity Types
  if (normalizedConfirmed) {
    switch (normalizedConfirmed) {
      case 'riding':
        return {
          type: 'riding',
          label: 'Riding',
          verb: 'riding',
          emoji: '🏍️',
          badgeText: roundedSpeed > 0 ? `Riding • ${roundedSpeed} km/h` : 'Riding',
          speedKmh: roundedSpeed,
          color: '#F97316',
          bgColor: '#FFF7ED',
          textColor: '#C2410C',
          cssKey: 'riding',
          animationType: 'drive-rumble',
        };

      case 'driving':
        if (roundedSpeed >= 85) {
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
        return {
          type: 'driving',
          label: 'Driving',
          verb: 'driving',
          emoji: '🚗',
          badgeText: roundedSpeed > 0 ? `Driving • ${roundedSpeed} km/h` : 'Driving',
          speedKmh: roundedSpeed,
          color: '#6366F1',
          bgColor: '#EEF2FF',
          textColor: '#3730A3',
          cssKey: 'driving',
          animationType: 'drive-rumble',
        };

      case 'walking':
        return {
          type: 'walking',
          label: 'Walking',
          verb: 'walking',
          emoji: '🚶',
          badgeText: roundedSpeed > 0 ? `Walking • ${roundedSpeed} km/h` : 'Walking',
          speedKmh: roundedSpeed,
          color: '#10B981',
          bgColor: '#ECFDF5',
          textColor: '#065F46',
          cssKey: 'walking',
          animationType: 'walk-bounce',
        };

      case 'running':
        return {
          type: 'running',
          label: 'Running',
          verb: 'running',
          emoji: '🏃',
          badgeText: roundedSpeed > 0 ? `Running • ${roundedSpeed} km/h` : 'Running',
          speedKmh: roundedSpeed,
          color: '#F59E0B',
          bgColor: '#FFFBEB',
          textColor: '#92400E',
          cssKey: 'running',
          animationType: 'run-dash',
        };

      case 'cycling':
        return {
          type: 'cycling',
          label: 'Cycling',
          verb: 'cycling',
          emoji: '🚴',
          badgeText: roundedSpeed > 0 ? `Cycling • ${roundedSpeed} km/h` : 'Cycling',
          speedKmh: roundedSpeed,
          color: '#3B82F6',
          bgColor: '#EFF6FF',
          textColor: '#1E40AF',
          cssKey: 'cycling',
          animationType: 'cycle-pedal',
        };

      case 'high_speed':
        return {
          type: 'high_speed',
          label: 'Highway Speed',
          verb: 'driving at high speed',
          emoji: '🏎️',
          badgeText: roundedSpeed > 0 ? `Highway • ${roundedSpeed} km/h` : 'Highway Speed',
          speedKmh: roundedSpeed,
          color: '#EF4444',
          bgColor: '#FEF2F2',
          textColor: '#991B1B',
          cssKey: 'highspeed',
          animationType: 'speed-zoom',
        };

      case 'stationary':
        // Rule: Never show "Stationary" if speed > 5 km/h
        if (rawSpeed > 5.0) {
          if (rawSpeed >= 32.0) {
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
            type: 'unknown',
            label: 'Moving',
            verb: 'moving',
            emoji: '📍',
            badgeText: `Moving • ${roundedSpeed} km/h`,
            speedKmh: roundedSpeed,
            color: '#64748B',
            bgColor: '#F1F5F9',
            textColor: '#334155',
            cssKey: 'stationary',
            animationType: 'none',
          };
        }
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

      case 'unknown':
      case 'moving':
        if (rawSpeed < 1.8 || isStationary) {
          return {
            type: 'stationary',
            label: 'Stationary',
            verb: 'still',
            emoji: '🧍',
            badgeText: 'Stationary',
            speedKmh: 0,
            color: '#64748B',
            bgColor: '#F1F5F9',
            textColor: '#334155',
            cssKey: 'stationary',
            animationType: 'none',
          };
        }
        return {
          type: 'unknown',
          label: 'Moving',
          verb: 'moving',
          emoji: '📍',
          badgeText: roundedSpeed > 0 ? `Moving • ${roundedSpeed} km/h` : 'Moving',
          speedKmh: roundedSpeed,
          color: '#64748B',
          bgColor: '#F1F5F9',
          textColor: '#334155',
          cssKey: 'stationary',
          animationType: 'none',
        };
    }
  }

  // 2. Fallback if no confirmedType is provided (e.g. legacy callers or peers without detection engine)
  // Rule: Never show "Stationary" if speed > 5 km/h
  if ((isStationary || rawSpeed < 1.8) && rawSpeed <= 5.0) {
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
