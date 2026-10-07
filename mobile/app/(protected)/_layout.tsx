import React, { createContext, useContext, useState, useEffect } from 'react';
import { Slot, useRouter } from 'expo-router';
import { authService, UserSession } from '../../src/services/AuthService';
import { serverConfigService } from '../../src/services/ServerConfigService';
import { backgroundLocationService } from '../../src/services/BackgroundLocationService';
import { getBackendWsUrl } from '../../src/services/backendUrl';

interface MapSessionContextValue {
  session: UserSession;
  backendWsUrl: string;
  isTabBarHidden: boolean;
  setIsTabBarHidden: (hidden: boolean) => void;
  onSignOut: () => void;
  onServerChanged: (newUrl: string) => void;
}

const MapSessionContext = createContext<MapSessionContextValue | null>(null);

export const useMapSession = () => {
  const ctx = useContext(MapSessionContext);
  if (!ctx) throw new Error('useMapSession must be used within MapSessionProvider');
  return ctx;
};

export default function ProtectedLayout() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(authService.getSession());
  const [backendWsUrl, setBackendWsUrl] = useState<string>(
    serverConfigService.getActiveWsUrl() || getBackendWsUrl()
  );
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);

  useEffect(() => {
    const currentSession = authService.getSession();
    if (!currentSession) {
      router.replace('/(auth)');
      return;
    }
    setSession(currentSession);

    const unsubscribe = serverConfigService.subscribe((newUrl) => {
      setBackendWsUrl(newUrl);
    });

    const unsubAuth = authService.subscribe((sess) => {
      if (!sess) {
        setSession(null);
        router.replace('/(auth)');
      } else {
        setSession(sess);
      }
    });

    return () => {
      unsubscribe();
      unsubAuth();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await backgroundLocationService.stopTracking().catch(() => {});
      await authService.signOut();
    } catch (err) {
      console.warn('[ProtectedLayout] Sign out error:', err);
    }
    router.replace('/(auth)');
  };

  const handleServerChanged = (newUrl: string) => {
    setBackendWsUrl(newUrl);
  };

  if (!session) {
    return null;
  }

  return (
    <MapSessionContext.Provider
      value={{
        session,
        backendWsUrl,
        isTabBarHidden,
        setIsTabBarHidden,
        onSignOut: handleSignOut,
        onServerChanged: handleServerChanged,
      }}
    >
      <Slot />
    </MapSessionContext.Provider>
  );
}
