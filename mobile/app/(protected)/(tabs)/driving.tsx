import React from 'react';
import { MapScreen } from '../../../src/screens/MapScreen';
import { useMapSession } from '../_layout';

export default function DrivingTab() {
  const { session, backendWsUrl, onSignOut, onServerChanged, setIsTabBarHidden, tabPressCounter } = useMapSession();

  return (
    <MapScreen
      currentUserId={session.userId}
      currentUserName={session.fullName}
      backendWsUrl={backendWsUrl}
      onSignOut={onSignOut}
      onServerChanged={onServerChanged}
      initialTab="driving"
      hideBottomBar={true}
      onTabBarHiddenChange={setIsTabBarHidden}
      externalTabPullUpTrigger={tabPressCounter.driving}
    />
  );
}
