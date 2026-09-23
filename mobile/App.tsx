import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { MapScreen } from './src/screens/MapScreen';
import { authService, UserSession } from './src/services/AuthService';
import { getBackendWsUrl } from './src/services/backendUrl';
import { Colors } from './src/theme/colors';

const BACKEND_WS_URL = getBackendWsUrl();

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
      <StatusBar style="dark" />
      <View style={styles.root}>
        {session ? (
          <MapScreen
            currentUserId={session.userId}
            currentUserName={session.fullName}
            backendWsUrl={BACKEND_WS_URL}
            onSignOut={handleSignOut}
          />
        ) : (
          <AuthScreen
            backendWsUrl={BACKEND_WS_URL}
            onAuthenticated={handleAuthenticated}
          />
        )}
      </View>
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
