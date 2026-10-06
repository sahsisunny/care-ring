import {
  LatLng,
  LocationInput,
  LocationSmoothingEngine,
  SmoothedTargetResult,
} from './LocationSmoothingEngine';

export {
  LatLng,
  LocationInput,
  LocationSmoothingEngine,
  SmoothedTargetResult,
  haversineDistanceMeters,
  getShortestAngleDelta,
  normalizeAngle,
  normalizeActivity,
} from './LocationSmoothingEngine';

export type OnInterpolationCallback = (
  memberId: string,
  position: LatLng,
  heading: number
) => void;

export class MarkerInterpolator {
  private engine: LocationSmoothingEngine;
  private onUpdate: OnInterpolationCallback;

  constructor(onUpdate: OnInterpolationCallback) {
    this.onUpdate = onUpdate;
    this.engine = new LocationSmoothingEngine((memberId, pos, heading) => {
      this.onUpdate(memberId, pos, heading);
    });
  }

  public updateTarget(params: {
    memberId: string;
    newPosition: LatLng;
    newHeading: number;
    speed?: number;
    accuracy?: number;
    timestamp?: number;
    activity?: string;
    durationMs?: number;
  }): SmoothedTargetResult {
    return this.engine.processUpdate({
      memberId: params.memberId,
      latitude: params.newPosition.latitude,
      longitude: params.newPosition.longitude,
      heading: params.newHeading,
      speed: params.speed,
      accuracy: params.accuracy,
      timestamp: params.timestamp,
      activity: params.activity,
    });
  }

  public getCurrentPosition(memberId: string): LatLng | undefined {
    return this.engine.getCurrentPosition(memberId);
  }

  public getCurrentHeading(memberId: string): number | undefined {
    return this.engine.getCurrentHeading(memberId);
  }

  public getEngine(): LocationSmoothingEngine {
    return this.engine;
  }

  public dispose(): void {
    this.engine.dispose();
  }
}
