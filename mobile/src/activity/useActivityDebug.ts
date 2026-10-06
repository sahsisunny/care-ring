/**
 * Hook for Developer / Debug Mode (Section 29)
 * Exposes live telemetry and activity detection internals for debugging and verification.
 */

import { useEffect, useState } from 'react';
import { activityDetectionEngine } from './ActivityDetectionEngine';
import { ActivityDebugInfo } from './types';

export function useActivityDebug(): ActivityDebugInfo {
  const [debugInfo, setDebugInfo] = useState<ActivityDebugInfo>(() =>
    activityDetectionEngine.getDebugInfo()
  );

  useEffect(() => {
    const unsubscribe = activityDetectionEngine.subscribeDebugInfo((info) => {
      setDebugInfo(info);
    });
    return unsubscribe;
  }, []);

  return debugInfo;
}
