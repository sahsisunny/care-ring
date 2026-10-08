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
  activeNavTab: 'location' | 'driving' | 'safety' | 'settings';
  setActiveNavTab: (tab: 'location' | 'driving' | 'safety' | 'settings') => void;
  tabPressCounter: Record<'location' | 'driving' | 'safety' | 'settings', number>;
  triggerTabPress: (tab: 'location' | 'driving' | 'safety' | 'settings') => void;
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
  const [activeNavTab, setActiveNavTab] = useState<
    'location' | 'driving' | 'safety' | 'settings'
  >('location');
  const [tabPressCounter, setTabPressCounter] = useState<
    Record<'location' | 'driving' | 'safety' | 'settings', number>
  >({
    location: 0,
    driving: 0,
    safety: 0,
    settings: 0,
  });

  const triggerTabPress = React.useCallback(
    (tab: 'location' | 'driving' | 'safety' | 'settings') => {
      setActiveNavTab(tab);
      setTabPressCounter((prev) => ({
        ...prev,
        [tab]: prev[tab] + 1,
      }));
    },
    []
  );

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
        activeNavTab,
        setActiveNavTab,
        tabPressCounter,
        triggerTabPress,
      }}
    >
      <Slot />
    </MapSessionContext.Provider>
  );
}
