import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import '../src/services/BackgroundLocationService';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { authService, UserSession } from '../src/services/AuthService';
import { serverConfigService } from '../src/services/ServerConfigService';
import { getBackendWsUrl } from '../src/services/backendUrl';

import { AnimatedSplashScreen } from '../src/components/common/AnimatedSplashScreen';

// Prevent native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutContent() {
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const startTime = Date.now();
        await serverConfigService.init();
        await authService.init();
        if (isMounted) {
          setSession(authService.getSession());
        }
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 1200 - elapsed);
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, remaining));
        }
      } catch (err) {
        console.warn('Initialization error:', err);
      } finally {
        if (isMounted) {
          setIsReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect unauthenticated user to login
      router.replace('/(auth)');
    } else if (session && inAuthGroup) {
      // Redirect authenticated user to protected tabs
      router.replace('/(protected)/(tabs)');
    }
  }, [isReady, session, segments]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} />
      <Slot />
      {showSplash && (
        <AnimatedSplashScreen
          isAppReady={isReady}
          onFinish={() => setShowSplash(false)}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
