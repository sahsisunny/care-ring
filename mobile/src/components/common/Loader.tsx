import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Colors } from '../../theme/colors';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large' | number;
  color?: string;
  thickness?: number;
  message?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Modern Animated Ring Spinner with optional status label
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color,
  thickness = 3,
  message,
  style,
}) => {
  const { colors } = useTheme();
  const activeColor = color || colors.primary;

  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'small'
      ? 24
      : size === 'large'
      ? 52
      : 36;

  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinAnim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 950,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    spinAnim.start();

    return () => spinAnim.stop();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.spinnerContainer, style]}>
      <Animated.View
        style={[
          styles.spinnerRing,
          {
            width: numericSize,
            height: numericSize,
            borderRadius: numericSize / 2,
            borderWidth: thickness,
            borderColor: activeColor + '25', // 15% opacity track
            borderTopColor: activeColor, // Solid active arc
            borderRightColor: activeColor + '99', // 60% fading arc
            transform: [{ rotate: spin }],
          },
        ]}
      />
      {message && (
        <Text style={[styles.spinnerMessage, { color: colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );
};

export interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  message?: string;
  transparent?: boolean;
}

/**
 * Fullscreen or modal loading overlay for blocking async operations
 */
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  title = 'Please wait...',
  message,
  transparent = true,
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={transparent} animationType="fade">
      <View style={[styles.overlayBackdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.overlayCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <LoadingSpinner size="large" color={colors.primary} />
          {title ? (
            <Text style={[styles.overlayTitle, { color: colors.textMain }]}>
              {title}
            </Text>
          ) : null}
          {message ? (
            <Text style={[styles.overlayMessage, { color: colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

export interface InlineButtonLoaderProps {
  size?: number;
  color?: string;
  label?: string;
  text?: string;
  textColor?: string;
}

/**
 * Compact inline loader for buttons and action bars
 */
export const InlineButtonLoader: React.FC<InlineButtonLoaderProps> = ({
  size = 18,
  color = '#FFFFFF',
  label,
  text,
  textColor,
}) => {
  const displayLabel = label || text;
  const resolvedTextColor = textColor || color;
  return (
    <View style={styles.inlineButtonRow}>
      <ActivityIndicator size="small" color={color} style={{ transform: [{ scale: size / 20 }] }} />
      {displayLabel && <Text style={[styles.inlineButtonLabel, { color: resolvedTextColor }]}>{displayLabel}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  spinnerRing: {
    borderStyle: 'solid',
  },
  spinnerMessage: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  overlayBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  overlayCard: {
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
    maxWidth: 320,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  overlayMessage: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  inlineButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inlineButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
