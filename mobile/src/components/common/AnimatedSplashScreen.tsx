import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Animated,
  Dimensions,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  isAppReady: boolean;
  onFinish: () => void;
}

const STAGES = [
  'Checking secure session...',
  'Synchronizing circle telemetry...',
  'Family protection active',
];

export function AnimatedSplashScreen({ isAppReady, onFinish }: AnimatedSplashScreenProps) {
  const [stageIndex, setStageIndex] = useState(0);

  // Animations
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenScale = useRef(new Animated.Value(1)).current;

  // Radar Pulse Rings
  const pulseRing1 = useRef(new Animated.Value(0)).current;
  const pulseRing2 = useRef(new Animated.Value(0)).current;

  // Progress Bar
  const progressAnim = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    // 1. Initial entrance animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 700,
        delay: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Loop radar pulsing animation behind the logo
    const createPulseLoop = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2200,
            easing: Easing.out(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const pulse1Loop = createPulseLoop(pulseRing1, 0);
    const pulse2Loop = createPulseLoop(pulseRing2, 1100);

    pulse1Loop.start();
    pulse2Loop.start();

    // 3. Simulated progress staging
    const stageTimer1 = setTimeout(() => {
      setStageIndex(1);
      Animated.timing(progressAnim, {
        toValue: 0.65,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }, 450);

    const stageTimer2 = setTimeout(() => {
      setStageIndex(2);
      Animated.timing(progressAnim, {
        toValue: 1.0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }, 900);

    return () => {
      pulse1Loop.stop();
      pulse2Loop.stop();
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
    };
  }, []);

  // When app signals it is ready, smoothly transition out
  useEffect(() => {
    if (!isAppReady) return;

    // Small delay so user sees smooth completion
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(screenScale, {
          toValue: 1.05,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onFinish();
      });
    }, 550);

    return () => clearTimeout(exitTimer);
  }, [isAppReady]);

  const ring1Scale = pulseRing1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.8],
  });
  const ring1Opacity = pulseRing1.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.45, 0.25, 0],
  });

  const ring2Scale = pulseRing2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.8],
  });
  const ring2Opacity = pulseRing2.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.45, 0.25, 0],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: screenOpacity,
          transform: [{ scale: screenScale }],
        },
      ]}
      pointerEvents={isAppReady ? 'none' : 'auto'}
    >
      <StatusBar style="light" />

      {/* Ambient background glow effects */}
      <View style={styles.ambientTopGlow} />
      <View style={styles.ambientBottomGlow} />

      <View style={styles.centerContent}>
        {/* Radar concentric pulse rings */}
        <Animated.View
          style={[
            styles.pulseRing,
            styles.pulseRingCyan,
            {
              transform: [{ scale: ring1Scale }],
              opacity: ring1Opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.pulseRing,
            styles.pulseRingCoral,
            {
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
            },
          ]}
        />

        {/* Logo Card with soft glowing shadow */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={styles.logoHalo} />
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Brand Typography */}
        <Animated.View style={[styles.textBlock, { opacity: contentOpacity }]}>
          <View style={styles.titleRow}>
            <Text style={styles.brandTitle}>CareRing</Text>
            <View style={styles.liveIndicatorDot} />
          </View>
          <Text style={styles.brandSubtitle}>REAL-TIME FAMILY SAFETY</Text>
        </Animated.View>

        {/* Dynamic Status & Progress Bar */}
        <Animated.View style={[styles.progressBlock, { opacity: contentOpacity }]}>
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.stageText}>{STAGES[stageIndex]}</Text>
        </Animated.View>
      </View>

      {/* Footer Security Badge */}
      <Animated.View style={[styles.footer, { opacity: contentOpacity }]}>
        <View style={styles.securityPill}>
          <Ionicons name="shield-checkmark" size={13} color="#00D2FE" style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>End-to-End Encrypted Telemetry • v1.0.0</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0A0F1D',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 56,
  },
  ambientTopGlow: {
    position: 'absolute',
    top: -120,
    left: width * 0.15,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(79, 70, 229, 0.16)',
    filter: Platform.OS === 'web' ? 'blur(60px)' : undefined,
  },
  ambientBottomGlow: {
    position: 'absolute',
    bottom: -100,
    right: width * 0.1,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0, 210, 254, 0.12)',
    filter: Platform.OS === 'web' ? 'blur(60px)' : undefined,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
  },
  pulseRingCyan: {
    borderColor: '#00D2FE',
  },
  pulseRingCoral: {
    borderColor: '#FF4B72',
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  logoHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D2FE',
    shadowColor: '#00D2FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.2,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  progressBlock: {
    width: Math.min(width * 0.65, 240),
    alignItems: 'center',
    marginTop: 40,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  stageText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    letterSpacing: 0.2,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  footerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
