import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Easing,
} from 'react-native';
import {
  MovementActivityInfo,
  getMovementActivity,
} from '../../models/MovementActivity';

export interface AnimatedActivityEmojiProps {
  activity?: MovementActivityInfo;
  speed?: number | null;
  isStationary?: boolean;
  customEmoji?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  showBadge?: boolean;
  badgeContainerStyle?: StyleProp<ViewStyle>;
  badgeTextStyle?: StyleProp<TextStyle>;
  showSpeedInBadge?: boolean;
}

export const AnimatedActivityEmoji: React.FC<AnimatedActivityEmojiProps> = ({
  activity: providedActivity,
  speed,
  isStationary,
  customEmoji,
  size = 18,
  style,
  textStyle,
  showBadge = false,
  badgeContainerStyle,
  badgeTextStyle,
  showSpeedInBadge = true,
}) => {
  const currentActivity =
    providedActivity || getMovementActivity(speed, isStationary);
  const emoji = customEmoji || currentActivity.emoji;
  const animType = currentActivity.animationType;

  // Animation values
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const rotateDeg = useRef(new Animated.Value(0)).current; // -1 to 1 mapped to degrees
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Reset transforms first
    translateY.setValue(0);
    translateX.setValue(0);
    rotateDeg.setValue(0);
    scale.setValue(1);

    if (animType === 'none') {
      return;
    }

    let activeAnim: Animated.CompositeAnimation | null = null;

    if (animType === 'walk-bounce') {
      // Gentle stepping motion: subtle vertical bob with alternating tilt
      activeAnim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -3.5,
              duration: 340,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: -0.6, // ~ -6 deg
              duration: 340,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 340,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: 0.6, // ~ +6 deg
              duration: 340,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    } else if (animType === 'run-dash') {
      // Energetic forward lean and springy stride
      activeAnim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -5,
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: 0.8, // leans forward
              duration: 180,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.08,
              duration: 180,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 180,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: 0.4,
              duration: 180,
              easing: Easing.in(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    } else if (animType === 'cycle-pedal') {
      // Rhythmic pedaling cadence wobble
      activeAnim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -2.5,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: -0.3,
              duration: 140,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 1,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: 0.3,
              duration: 140,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -1.5,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: -0.2,
              duration: 140,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 140,
              useNativeDriver: true,
            }),
            Animated.timing(rotateDeg, {
              toValue: 0,
              duration: 140,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    } else if (animType === 'drive-rumble') {
      // Engine rumble vibration & road glide
      activeAnim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 1,
              duration: 55,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -1,
              duration: 55,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -1,
              duration: 55,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0.8,
              duration: 55,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0.6,
              duration: 55,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -0.5,
              duration: 55,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 55,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: 55,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    } else if (animType === 'speed-zoom') {
      // Highway speed dash: horizontal jitter + slight scale flare
      activeAnim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 2.5,
              duration: 45,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.07,
              duration: 45,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -2,
              duration: 45,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.96,
              duration: 45,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 1.8,
              duration: 45,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.04,
              duration: 45,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 45,
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 45,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    }

    activeAnim?.start();

    return () => {
      activeAnim?.stop();
    };
  }, [animType]);

  const rotationInterpolation = rotateDeg.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const animatedStyle = {
    transform: [
      { translateY },
      { translateX },
      { rotate: rotationInterpolation },
      { scale },
    ],
  };

  const emojiElement = (
    <Animated.View style={[styles.emojiWrap, animatedStyle, style]}>
      <Text style={[styles.emojiText, { fontSize: size }, textStyle]}>
        {emoji}
      </Text>
    </Animated.View>
  );

  if (!showBadge) {
    return emojiElement;
  }

  const labelText = showSpeedInBadge && currentActivity.speedKmh > 0
    ? `${currentActivity.label} • ${currentActivity.speedKmh} km/h`
    : currentActivity.label;

  return (
    <View
      style={[
        styles.badgeContainer,
        {
          backgroundColor: currentActivity.bgColor,
          borderColor: currentActivity.color + '40',
        },
        badgeContainerStyle,
      ]}
    >
      {emojiElement}
      <Text
        style={[
          styles.badgeLabel,
          { color: currentActivity.textColor },
          badgeTextStyle,
        ]}
        numberOfLines={1}
      >
        {labelText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emojiWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    textAlign: 'center',
    includeFontPadding: false,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    alignSelf: 'flex-start',
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
