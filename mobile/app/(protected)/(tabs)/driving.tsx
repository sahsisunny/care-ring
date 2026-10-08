import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useMapSession } from '../_layout';

export default function DrivingTab() {
  const { triggerTabPress } = useMapSession();

  useEffect(() => {
    triggerTabPress('driving');
  }, [triggerTabPress]);

  return <Redirect href="/(protected)/(tabs)" />;
}
