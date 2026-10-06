/**
 * React hook to observe live Safety Detection Engine debug states
 * Implements Section 25 of Safety Detection Layer.md
 */

import { useEffect, useState } from 'react';
import { safetyDetectionEngine } from './SafetyDetectionEngine';
import { SafetyDebugState } from './types';

export function useSafetyDebug(): SafetyDebugState {
  const [debugState, setDebugState] = useState<SafetyDebugState>(
    safetyDetectionEngine.getDebugState()
  );

  useEffect(() => {
    const unsubscribe = safetyDetectionEngine.subscribeDebugState((state) => {
      setDebugState(state);
    });
    return () => unsubscribe();
  }, []);

  return debugState;
}
