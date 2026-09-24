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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import {
  InAppNotification,
  notificationService,
} from '../services/NotificationService';
import { Avatar } from './Avatar';
import { Colors } from '../theme/colors';

interface InAppPushBannerProps {
  onNotificationPress?: (notification: InAppNotification) => void;
}

export const InAppPushBanner: React.FC<InAppPushBannerProps> = ({
  onNotificationPress,
}) => {
  const insets = useSafeAreaInsets();
  const [currentNotification, setCurrentNotification] = useState<InAppNotification | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const dismissTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      // Clear existing timer if any
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }

      setCurrentNotification(notification);

      // Slide in banner
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }).start();

      // Auto dismiss after 5 seconds (SOS stays for 8 seconds)
      const duration = notification.type === 'sos' ? 8000 : 5000;
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
      toValue: -160,
      duration: 260,
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
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -10,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -30) {
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

  const getTheme = () => {
    switch (currentNotification.type) {
      case 'speeding':
        return {
          icon: <Ionicons name="speedometer" size={20} color="#DC2626" />,
          bgColor: '#FEF2F2',
          borderColor: '#FCA5A5',
          accentColor: '#DC2626',
        };
      case 'movement':
        return {
          icon: <Ionicons name="car-sport" size={20} color="#2563EB" />,
          bgColor: '#EFF6FF',
          borderColor: '#93C5FD',
          accentColor: '#2563EB',
        };
      case 'chat':
        return {
          icon: <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />,
          bgColor: '#F5F3FF',
          borderColor: '#C4B5FD',
          accentColor: Colors.primary,
        };
      case 'geofence':
        return {
          icon: <Ionicons name="location" size={20} color="#059669" />,
          bgColor: '#ECFDF5',
          borderColor: '#6EE7B7',
          accentColor: '#059669',
        };
      case 'sos':
        return {
          icon: <Ionicons name="warning" size={22} color="#FFFFFF" />,
          bgColor: '#DC2626',
          borderColor: '#991B1B',
          accentColor: '#FFFFFF',
          isSos: true,
        };
      default:
        return {
          icon: <Ionicons name="notifications" size={20} color={Colors.primary} />,
          bgColor: '#FFFFFF',
          borderColor: '#E2E8F0',
          accentColor: Colors.primary,
        };
    }
  };

  const theme = getTheme();
  const topPadding = Math.max(insets.top, 14);

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
            backgroundColor: theme.bgColor,
            borderColor: theme.borderColor,
          },
          theme.isSos && styles.sosCard,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleBannerPress}
          style={styles.touchArea}
        >
          {/* Avatar or Icon Badge */}
          <View style={styles.iconWrap}>
            {currentNotification.avatarUrl ? (
              <Avatar
                name={currentNotification.userName || 'Member'}
                avatarUrl={currentNotification.avatarUrl}
                size={40}
              />
            ) : (
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.isSos ? '#B91C1C' : '#FFFFFF' },
                ]}
              >
                {theme.icon}
              </View>
            )}
          </View>

          {/* Text Content */}
          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.titleText,
                  { color: theme.isSos ? '#FFFFFF' : '#0F172A' },
                ]}
                numberOfLines={1}
              >
                {currentNotification.title}
              </Text>
              <Text
                style={[
                  styles.timeText,
                  { color: theme.isSos ? '#FECACA' : '#94A3B8' },
                ]}
              >
                Just now
              </Text>
            </View>

            <Text
              style={[
                styles.messageText,
                { color: theme.isSos ? '#FEE2E2' : '#334155' },
              ]}
              numberOfLines={2}
            >
              {currentNotification.message}
            </Text>
          </View>

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={dismissBanner}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather
              name="x"
              size={18}
              color={theme.isSos ? '#FCA5A5' : '#94A3B8'}
            />
          </TouchableOpacity>
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
    zIndex: 9999,
    alignItems: 'center',
  },
  bannerCard: {
    width: '100%',
    maxWidth: 540,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  sosCard: {
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 16,
  },
  touchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    paddingRight: 6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  dismissBtn: {
    padding: 6,
  },
});
