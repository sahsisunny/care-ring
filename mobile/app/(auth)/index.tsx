import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthScreen } from '../../src/screens/AuthScreen';
import { getBackendWsUrl } from '../../src/services/backendUrl';
import { serverConfigService } from '../../src/services/ServerConfigService';

export default function LoginRoute() {
  const router = useRouter();
  const [backendWsUrl, setBackendWsUrl] = useState<string>(
    serverConfigService.getActiveWsUrl() || getBackendWsUrl()
  );

  return (
    <AuthScreen
      backendWsUrl={backendWsUrl}
      onAuthenticated={() => {
        router.replace('/(protected)/(tabs)');
      }}
      onServerChanged={(newUrl) => {
        setBackendWsUrl(newUrl);
      }}
    />
  );
}
