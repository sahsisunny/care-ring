import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors } from '../../theme/colors';

interface TypingIndicatorProps {
  label: string; // e.g. "Sunny is typing..." or "Sunny and Neha are typing..."
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ label }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounceAnimation = (animValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: -4,
            duration: 280,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 280,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.delay(500 - delay),
        ])
      );
    };

    const anim1 = createBounceAnimation(dot1, 0);
    const anim2 = createBounceAnimation(dot2, 140);
    const anim3 = createBounceAnimation(dot3, 280);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.container}>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2 }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
        </View>
        <Text style={styles.text} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    alignItems: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    height: 12,
    paddingTop: 2,
  },
  dot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: Colors.primary,
  },
  text: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    fontStyle: 'italic',
  },
});
