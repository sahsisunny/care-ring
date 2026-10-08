import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useMapSession } from '../_layout';

export default function SafetyTab() {
  const { triggerTabPress } = useMapSession();

  useEffect(() => {
    triggerTabPress('safety');
  }, [triggerTabPress]);

  return <Redirect href="/(protected)/(tabs)" />;
}
