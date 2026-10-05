import React from 'react';
import { MapScreen } from '../../../src/screens/MapScreen';
import { useMapSession } from '../_layout';

export default function LocationTab() {
  const { session, backendWsUrl, onSignOut, onServerChanged, setIsTabBarHidden } = useMapSession();

  return (
    <MapScreen
      currentUserId={session.userId}
      currentUserName={session.fullName}
      backendWsUrl={backendWsUrl}
      onSignOut={onSignOut}
      onServerChanged={onServerChanged}
      initialTab="location"
      hideBottomBar={true}
      onTabBarHiddenChange={setIsTabBarHidden}
    />
  );
}
