import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useMapSession } from '../_layout';

export default function SettingsTab() {
  const { triggerTabPress } = useMapSession();

  useEffect(() => {
    triggerTabPress('settings');
  }, [triggerTabPress]);

  return <Redirect href="/(protected)/(tabs)" />;
}
