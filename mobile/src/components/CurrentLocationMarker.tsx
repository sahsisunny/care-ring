import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';

interface CurrentLocationMarkerProps {
  heading?: number;
  onTap?: () => void;
}

export const CurrentLocationMarker: React.FC<CurrentLocationMarkerProps> = ({
  heading = 0,
  onTap,
}) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  const waveScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 2.4],
  });

  const waveOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.6, 0.2, 0],
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onTap} style={styles.container}>
      {/* 1. Radar wave pulse */}
      <Animated.View
        style={[
          styles.radarWave,
          {
            transform: [{ scale: waveScale }],
            opacity: waveOpacity,
          },
        ]}
      />

      {/* 2. Soft accuracy halo */}
      <View style={styles.accuracyHalo} />

      {/* 3. Heading Directional Beam (if heading > 0) */}
      {heading > 0 && (
        <View
          style={[
            styles.beamContainer,
            { transform: [{ rotate: `${heading}deg` }] },
          ]}
        >
          <View style={styles.beamCone} />
        </View>
      )}

      {/* 4. Crisp White Ring with Drop Shadow */}
      <View style={styles.whiteRing}>
        {/* 5. Royal Blue Core Dot */}
        <View style={styles.blueCore} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarWave: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  accuracyHalo: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  beamContainer: {
    position: 'absolute',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  beamCone: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderBottomWidth: 28,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(59, 130, 246, 0.35)',
    transform: [{ rotate: '180deg' }],
  },
  whiteRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  blueCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
  },
});
