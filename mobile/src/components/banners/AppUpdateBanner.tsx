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
import { appUpdateService, AppUpdateInfo } from '../../services/AppUpdateService';
import { hapticService } from '../../services/HapticService';
import { useTheme } from '../../theme/ThemeContext';

interface AppUpdateBannerProps {
  topOffset?: number;
  screenConditionMatched?: boolean;
}

export const AppUpdateBanner: React.FC<AppUpdateBannerProps> = ({
  topOffset,
  screenConditionMatched = true,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, isGlass } = useTheme();

  const [serviceBannerVisible, setServiceBannerVisible] = useState(
    appUpdateService.getIsBannerVisible()
  );
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(
    appUpdateService.getUpdateInfo()
  );

  const shouldBeVisible = serviceBannerVisible && screenConditionMatched && !!updateInfo;
  const [rendered, setRendered] = useState(shouldBeVisible);

  const translateY = useRef(new Animated.Value(shouldBeVisible ? 0 : -160)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for the "Update" badge
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, []);

  // Listen to service updates
  useEffect(() => {
    const unsub = appUpdateService.subscribe(() => {
      setServiceBannerVisible(appUpdateService.getIsBannerVisible());
      setUpdateInfo(appUpdateService.getUpdateInfo());
    });

    // Check on startup
    const timer = setTimeout(() => {
      appUpdateService.checkForUpdates();
    }, 2200);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  // Smooth Slide-In / Slide-Out when conditions change
  useEffect(() => {
    if (shouldBeVisible) {
      setRendered(true);
      Animated.spring(translateY, {
        toValue: 0,
        tension: 65,
        friction: 9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: -160,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRendered(false);
        }
      });
    }
  }, [shouldBeVisible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy < -6,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy < 0) {
          translateY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -30 || gesture.vy < -0.4) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleDismiss = () => {
    hapticService.light();
    Animated.timing(translateY, {
      toValue: -160,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setRendered(false);
      appUpdateService.dismissBanner();
    });
  };

  const handleOpenDetails = () => {
    hapticService.medium();
    appUpdateService.openUpdateModal();
  };

  if (!rendered || !updateInfo) {
    return null;
  }

  const effectiveTop = topOffset ?? Math.max(insets.top + 60, 68);

  const glassStyle = isGlass
    ? isDark
      ? styles.darkGlass
      : styles.lightGlass
    : null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: effectiveTop,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="box-none"
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleOpenDetails}
        style={[
          styles.bannerCard,
          {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(14, 165, 233, 0.28)',
          },
          glassStyle,
          isDark ? styles.cardShadowDark : styles.cardShadowLight,
        ]}
      >
        {/* Left: Icon with sparkling badge */}
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : '#E0F2FE' },
            ]}
          >
            <Ionicons name="sparkles" size={19} color="#0284C7" />
          </View>
          <Animated.View
            style={[
              styles.pulseDot,
              {
                backgroundColor: '#38BDF8',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        </View>

        {/* Center: Text summary */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textMain }]} numberOfLines={1}>
              Update Available
            </Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>v{updateInfo.version}</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {updateInfo.releaseNotes?.[0]?.description ||
              updateInfo.releaseTitle ||
              'New features and safety enhancements'}
          </Text>
        </View>

        {/* Right: Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleOpenDetails}
            style={[styles.updateBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.updateBtnText}>Update</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleDismiss}
            style={[
              styles.closeBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Dismiss update banner"
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 140,
    alignItems: 'center',
  },
  bannerCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    gap: 10,
  },
  cardShadowLight: {
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  cardShadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  lightGlass: {
    ...Platform.select({
      web: {
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      } as any,
    }),
  },
  darkGlass: {
    ...Platform.select({
      web: {
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      } as any,
    }),
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  versionBadge: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  versionBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0284C7',
  },
  subtitle: {
    fontSize: 11.5,
    fontWeight: '400',
    lineHeight: 15,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  updateBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
