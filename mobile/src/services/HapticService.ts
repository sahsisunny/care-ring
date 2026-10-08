import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';

class HapticService {
  /**
   * Light haptic feedback - ideal for tab switches, card flips, and subtle buttons
   */
  light() {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(10);
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
          Vibration.vibrate(10);
        });
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Selection tick - ideal for profile carousel paging and picker scrolls
   */
  selection() {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(8);
        }
      } else {
        Haptics.selectionAsync().catch(() => {
          Vibration.vibrate(8);
        });
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Medium haptic feedback - ideal for check-in, toggling modes, favorites
   */
  medium() {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(20);
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {
          Vibration.vibrate(20);
        });
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Heavy haptic feedback - ideal for SOS triggers and emergency actions
   */
  heavy() {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([40, 60, 40]);
        }
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
          Vibration.vibrate(40);
        });
      }
    } catch {
      // Safe fallback
    }
  }

  /**
   * Success notification vibration
   */
  success() {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([15, 30, 15]);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
          Vibration.vibrate([0, 15, 30, 15]);
        });
      }
    } catch {
      // Safe fallback
    }
  }
}

export const hapticService = new HapticService();
