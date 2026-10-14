import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  PanResponder,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  InAppNotification,
  notificationService,
} from '../services/NotificationService';
import { hapticService } from '../services/HapticService';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';

interface InAppPushBannerProps {
  onNotificationPress?: (notification: InAppNotification) => void;
}

export const InAppPushBanner: React.FC<InAppPushBannerProps> = ({
  onNotificationPress,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [currentNotification, setCurrentNotification] = useState<InAppNotification | null>(null);
  const translateY = useRef(new Animated.Value(-180)).current;
  const dismissTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      // Clear existing dismiss timer if any
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      setCurrentNotification(notification);

      // Alert feedback (haptics) only if soundEnabled is true in settings
      if (notificationService.isSoundEnabled()) {
        if (notification.type === 'sos') {
          hapticService.heavy();
        } else {
          hapticService.medium();
        }
      }

      // Smooth slide-down spring animation
      Animated.spring(translateY, {
        toValue: 0,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after 5.5s (SOS stays for 9s for safety)
      const duration = notification.type === 'sos' ? 9000 : 5500;
      dismissTimerRef.current = setTimeout(() => {
        dismissBanner();
      }, duration);
    });

    return () => {
      unsubscribe();
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const dismissBanner = () => {
    Animated.timing(translateY, {
      toValue: -180,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setCurrentNotification(null);
    });
  };

  const handleBannerPress = () => {
    if (currentNotification) {
      const notif = currentNotification;
      dismissBanner();
      onNotificationPress?.(notif);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -8,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -25) {
          dismissBanner();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!currentNotification) return null;

  // Modern category styling & Action pill configs
  const getBannerMeta = () => {
    switch (currentNotification.type) {
      case 'sos':
        return {
          categoryLabel: 'EMERGENCY SOS',
          badgeIcon: 'warning',
          badgeColor: '#EF4444',
          accentColor: '#DC2626',
          actionLabel: 'Locate',
          actionIcon: 'navigate',
          isSos: true,
        };
      case 'chat': {
        const isDirect = currentNotification.actionPayload?.isDirect;
        return {
          categoryLabel: isDirect ? 'DIRECT MESSAGE' : 'FAMILY CHAT',
          badgeIcon: 'chatbubble-ellipses',
          badgeColor: '#8B5CF6',
          accentColor: '#8B5CF6',
          actionLabel: 'Reply',
          actionIcon: 'arrow-forward',
          isSos: false,
        };
      }
      case 'geofence':
        return {
          categoryLabel: 'PLACE ALERT',
          badgeIcon: 'location',
          badgeColor: '#10B981',
          accentColor: '#10B981',
          actionLabel: 'Map',
          actionIcon: 'map',
          isSos: false,
        };
      case 'speeding':
        return {
          categoryLabel: 'SPEED WARNING',
          badgeIcon: 'speedometer',
          badgeColor: '#F59E0B',
          accentColor: '#F59E0B',
          actionLabel: 'View',
          actionIcon: 'navigate',
          isSos: false,
        };
      case 'movement':
        return {
          categoryLabel: 'ACTIVITY UPDATE',
          badgeIcon: 'car-sport',
          badgeColor: '#3B82F6',
          accentColor: '#3B82F6',
          actionLabel: 'View',
          actionIcon: 'navigate',
          isSos: false,
        };
      case 'battery':
        return {
          categoryLabel: 'BATTERY STATUS',
          badgeIcon: 'battery-half',
          badgeColor: '#F59E0B',
          accentColor: '#F59E0B',
          actionLabel: 'Locate',
          actionIcon: 'locate',
          isSos: false,
        };
      default:
        return {
          categoryLabel: 'NOTIFICATION',
          badgeIcon: 'notifications',
          badgeColor: colors.primary,
          accentColor: colors.primary,
          actionLabel: 'Open',
          actionIcon: 'arrow-forward',
          isSos: false,
        };
    }
  };

  const meta = getBannerMeta();
  const topPadding = Math.max(insets.top + 6, 16);

  // Background colors:
  // For SOS: striking crimson gradient
  // For others: WhatsApp/Life360 style sleek card matching dark/light mode
  const cardBg = meta.isSos
    ? '#DC2626'
    : isDark
    ? 'rgba(15, 23, 42, 0.96)'
    : '#FFFFFF';

  const cardBorder = meta.isSos
    ? '#B91C1C'
    : isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : 'rgba(0, 0, 0, 0.08)';

  const titleColor = meta.isSos ? '#FFFFFF' : isDark ? '#F8FAFC' : '#0F172A';
  const messageColor = meta.isSos ? '#FEE2E2' : isDark ? '#94A3B8' : '#475569';
  const tagColor = meta.isSos ? '#FCA5A5' : meta.accentColor;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topPadding,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        {...panResponder.panHandlers}
        style={[
          styles.bannerCard,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
          meta.isSos && styles.sosCard,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleBannerPress}
          style={styles.touchArea}
        >
          {/* Avatar with Status Mini-Badge on bottom-right */}
          <View style={styles.avatarWrap}>
            {currentNotification.avatarUrl ? (
              <Avatar
                name={currentNotification.userName || 'Member'}
                avatarUrl={currentNotification.avatarUrl}
                size={44}
              />
            ) : (
              <View
                style={[
                  styles.avatarFallback,
                  { backgroundColor: meta.isSos ? '#991B1B' : isDark ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <Ionicons
                  name={meta.badgeIcon as any}
                  size={22}
                  color={meta.isSos ? '#FFFFFF' : meta.badgeColor}
                />
              </View>
            )}

            {/* Mini Badge Icon on avatar */}
            <View
              style={[
                styles.miniBadge,
                { backgroundColor: meta.isSos ? '#FFFFFF' : meta.badgeColor },
              ]}
            >
              <Ionicons
                name={meta.badgeIcon as any}
                size={10}
                color={meta.isSos ? '#DC2626' : '#FFFFFF'}
              />
            </View>
          </View>

          {/* Central Message Body */}
          <View style={styles.contentWrap}>
            {/* Category header & relative time */}
            <View style={styles.headerRow}>
              <View style={styles.tagWrap}>
                <Text style={[styles.tagText, { color: tagColor }]}>
                  {meta.categoryLabel}
                </Text>
              </View>
              <Text
                style={[
                  styles.timeText,
                  { color: meta.isSos ? '#FCA5A5' : isDark ? '#64748B' : '#94A3B8' },
                ]}
              >
                Just now
              </Text>
            </View>

            {/* Title / Name */}
            <Text
              style={[styles.titleText, { color: titleColor }]}
              numberOfLines={1}
            >
              {currentNotification.title}
            </Text>

            {/* Message Body */}
            <Text
              style={[styles.messageText, { color: messageColor }]}
              numberOfLines={2}
            >
              {currentNotification.message}
            </Text>
          </View>

          {/* Action Pill on Right */}
          <View style={styles.rightActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.actionPill,
                {
                  backgroundColor: meta.isSos
                    ? '#FFFFFF'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
              onPress={handleBannerPress}
            >
              <Ionicons
                name={meta.actionIcon as any}
                size={12}
                color={meta.isSos ? '#DC2626' : meta.accentColor}
              />
              <Text
                style={[
                  styles.actionPillText,
                  { color: meta.isSos ? '#DC2626' : meta.accentColor },
                ]}
              >
                {meta.actionLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={dismissBanner}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Feather
                name="x"
                size={15}
                color={meta.isSos ? '#FCA5A5' : isDark ? '#64748B' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    alignItems: 'center',
  },
  bannerCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 22,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 14,
    overflow: 'hidden',
  },
  sosCard: {
    shadowColor: '#DC2626',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1.5,
  },
  touchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  contentWrap: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 1,
  },
  messageText: {
    fontSize: 12.5,
    fontWeight: '400',
    lineHeight: 17,
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 3,
  },
});
