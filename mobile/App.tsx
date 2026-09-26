import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { MapScreen } from './src/screens/MapScreen';
import { authService, UserSession } from './src/services/AuthService';
import { getBackendWsUrl } from './src/services/backendUrl';
import { Colors } from './src/theme/colors';

import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

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
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);

  const checkAuth = async () => {
    await authService.init();
    setSession(authService.getSession());
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleAuthenticated = () => {
    setSession(authService.getSession());
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setSession(null);
  };

  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainContent
          session={session}
          onSignOut={handleSignOut}
          onAuthenticated={handleAuthenticated}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
});
