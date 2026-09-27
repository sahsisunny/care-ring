import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthScreen } from './src/screens/AuthScreen';
import { MapScreen } from './src/screens/MapScreen';
import { authService, UserSession } from './src/services/AuthService';
import { getBackendWsUrl } from './src/services/backendUrl';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AnimatedSplashScreen } from './src/components/common/AnimatedSplashScreen';

// Keep native splash screen visible while app initializes
SplashScreen.preventAutoHideAsync().catch(() => {
  // Silent catch for web or fast refresh
});

const BACKEND_WS_URL = getBackendWsUrl();

function MainContent({
  session,
  onSignOut,
  onAuthenticated,
}: {
  session: UserSession | null;
  onSignOut: () => void;
  onAuthenticated: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} />
      {session ? (
        <MapScreen
          currentUserId={session.userId}
          currentUserName={session.fullName}
          backendWsUrl={BACKEND_WS_URL}
          onSignOut={onSignOut}
        />
      ) : (
        <AuthScreen
          backendWsUrl={BACKEND_WS_URL}
          onAuthenticated={onAuthenticated}
        />
      )}
    </View>
  );
}

export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);

  const initApp = async () => {
    try {
      const startTime = Date.now();
      await authService.init();
      setSession(authService.getSession());

      // Ensure minimum splash duration of 1.4s for smooth visual branding
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1400 - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    } catch (err) {
      console.warn('App initialization error:', err);
    } finally {
      // Dismiss native splash screen
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignored
      }
      setAppReady(true);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const handleAuthenticated = () => {
    setSession(authService.getSession());
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setSession(null);
  };

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <View style={styles.root}>
          <MainContent
            session={session}
            onSignOut={handleSignOut}
            onAuthenticated={handleAuthenticated}
          />
          {showSplash && (
            <AnimatedSplashScreen
              isAppReady={appReady}
              onFinish={() => setShowSplash(false)}
            />
          )}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
});

