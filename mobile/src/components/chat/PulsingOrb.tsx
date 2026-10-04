import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing, TouchableOpacity } from 'react-native';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface PulsingOrbProps {
  state: OrbState;
  volume?: number; // 0 to 1 for reactive audio amplitude
  size?: number;
  onPress?: () => void;
}

export const PulsingOrb: React.FC<PulsingOrbProps> = ({
  state,
  volume = 0,
  size = 180,
  onPress,
}) => {
  // Animation drivers
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const outerRippleAnim = useRef(new Animated.Value(1)).current;
  const secondaryRippleAnim = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.7)).current;

  // Rotation animation for 'thinking' state
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (state === 'thinking') {
      rotateAnim.setValue(0);
      loop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
    } else {
      rotateAnim.setValue(0);
    }
    return () => loop?.stop();
  }, [state]);

  // Breathing animation for 'idle'
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (state === 'idle') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.06,
              duration: 1800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.9,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 0.96,
              duration: 1800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.55,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [state]);

  // Dynamic real acoustic frequency-reactive scale for 'listening' and 'speaking'
  useEffect(() => {
    if (state === 'listening' || state === 'speaking') {
      const targetScale = 1.0 + Math.min(volume * 0.55, 0.6);
      Animated.spring(pulseAnim, {
        toValue: targetScale,
        friction: 5,
        tension: 45,
        useNativeDriver: true,
      }).start();

      Animated.spring(outerRippleAnim, {
        toValue: 1.08 + volume * 0.7,
        friction: 6,
        tension: 35,
        useNativeDriver: true,
      }).start();

      Animated.spring(secondaryRippleAnim, {
        toValue: 1.04 + volume * 0.45,
        friction: 6,
        tension: 35,
        useNativeDriver: true,
      }).start();
    }
  }, [state, volume]);

  // Color scheme based on active state
  const getColors = () => {
    switch (state) {
      case 'listening':
        return {
          core: '#10B981', // Emerald green
          innerGlow: 'rgba(16, 185, 129, 0.4)',
          outerGlow: 'rgba(52, 211, 153, 0.15)',
          ripple: 'rgba(16, 185, 129, 0.25)',
        };
      case 'thinking':
        return {
          core: '#8B5CF6', // Purple/Violet
          innerGlow: 'rgba(139, 92, 246, 0.45)',
          outerGlow: 'rgba(192, 132, 252, 0.2)',
          ripple: 'rgba(139, 92, 246, 0.3)',
        };
      case 'speaking':
        return {
          core: '#06B6D4', // Vibrant Cyan / Blue (ChatGPT style)
          innerGlow: 'rgba(6, 182, 212, 0.45)',
          outerGlow: 'rgba(56, 189, 248, 0.25)',
          ripple: 'rgba(6, 182, 212, 0.35)',
        };
      case 'idle':
      default:
        return {
          core: '#3B82F6', // Ambient Blue
          innerGlow: 'rgba(59, 130, 246, 0.35)',
          outerGlow: 'rgba(96, 165, 250, 0.15)',
          ripple: 'rgba(59, 130, 246, 0.2)',
        };
    }
  };

  const colors = getColors();

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.container, { width: size * 1.6, height: size * 1.6 }]}
    >
      {/* Outer Halo Ripple */}
      <Animated.View
        style={[
          styles.outerHalo,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: (size * 1.5) / 2,
            backgroundColor: colors.outerGlow,
            transform: [{ scale: outerRippleAnim }],
          },
        ]}
      />

      {/* Secondary Wave Ripple */}
      <Animated.View
        style={[
          styles.secondaryHalo,
          {
            width: size * 1.25,
            height: size * 1.25,
            borderRadius: (size * 1.25) / 2,
            backgroundColor: colors.ripple,
            transform: [{ scale: secondaryRippleAnim }],
          },
        ]}
      />

      {/* Rotating Ambient Gradient / Glow Ring */}
      <Animated.View
        style={[
          styles.rotatingRing,
          {
            width: size * 1.08,
            height: size * 1.08,
            borderRadius: (size * 1.08) / 2,
            borderColor: colors.innerGlow,
            transform: [{ rotate: spin }],
          },
        ]}
      />

      {/* Main Core Fluid Orb */}
      <Animated.View
        style={[
          styles.coreOrb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.core,
            shadowColor: colors.core,
            transform: [{ scale: pulseAnim }],
            opacity: glowOpacity,
          },
        ]}
      >
        {/* Inner Liquid Center Specular Highlight */}
        <View
          style={[
            styles.specularSpot,
            {
              width: size * 0.45,
              height: size * 0.45,
              borderRadius: (size * 0.45) / 2,
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerHalo: {
    position: 'absolute',
  },
  secondaryHalo: {
    position: 'absolute',
  },
  rotatingRing: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  coreOrb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 28,
    elevation: 20,
  },
  specularSpot: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ translateY: -15 }, { translateX: -10 }],
    filter: 'blur(8px)',
  } as any,
});
