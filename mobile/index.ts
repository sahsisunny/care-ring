import React from 'react';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import './src/services/BackgroundLocationService';

export function App() {
  // @ts-ignore - Metro bundler provides require.context
  const ctx = (require as any).context('./app');
  return React.createElement(ExpoRoot, { context: ctx });
}

registerRootComponent(App);
