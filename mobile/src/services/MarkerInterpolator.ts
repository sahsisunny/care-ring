export interface LatLng {
  latitude: number;
  longitude: number;
}

export type OnInterpolationCallback = (
  memberId: string,
  position: LatLng,
  heading: number
) => void;

interface ActiveAnimation {
  memberId: string;
  startPos: LatLng;
  targetPos: LatLng;
  startHeading: number;
  targetHeading: number;
  startTime: number;
  duration: number;
  rafId?: number;
}

export class MarkerInterpolator {
  private currentPositions = new Map<string, LatLng>();
  private currentHeadings = new Map<string, number>();
  private activeAnimations = new Map<string, ActiveAnimation>();
  private onUpdate: OnInterpolationCallback;

  constructor(onUpdate: OnInterpolationCallback) {
    this.onUpdate = onUpdate;
  }

  public updateTarget(params: {
    memberId: string;
    newPosition: LatLng;
    newHeading: number;
    durationMs?: number;
  }): void {
    const { memberId, newPosition, newHeading, durationMs = 1200 } = params;

    const existingPos = this.currentPositions.get(memberId);
    const existingHeading = this.currentHeadings.get(memberId) ?? newHeading;

    // First fix: set immediately without animation
    if (!existingPos) {
      this.currentPositions.set(memberId, newPosition);
      this.currentHeadings.set(memberId, newHeading);
      this.onUpdate(memberId, newPosition, newHeading);
      return;
    }

    // Cancel existing animation for this member
    const existingAnim = this.activeAnimations.get(memberId);
    if (existingAnim && existingAnim.rafId) {
      cancelAnimationFrame(existingAnim.rafId);
      this.activeAnimations.delete(memberId);
    }

    // Calculate shortest angular delta
    let deltaHeading = (newHeading - existingHeading) % 360;
    if (deltaHeading > 180) deltaHeading -= 360;
    if (deltaHeading < -180) deltaHeading += 360;
    const targetAdjustedHeading = existingHeading + deltaHeading;

    const anim: ActiveAnimation = {
      memberId,
      startPos: existingPos,
      targetPos: newPosition,
      startHeading: existingHeading,
      targetHeading: targetAdjustedHeading,
      startTime: Date.now(),
      duration: durationMs,
    };

    const step = () => {
      const elapsed = Date.now() - anim.startTime;
      const progress = Math.min(elapsed / anim.duration, 1.0);

      // Ease out cubic: 1 - pow(1 - x, 3)
      const t = 1 - Math.pow(1 - progress, 3);

      const lat = anim.startPos.latitude + (anim.targetPos.latitude - anim.startPos.latitude) * t;
      const lng = anim.startPos.longitude + (anim.targetPos.longitude - anim.startPos.longitude) * t;
      const heading = (anim.startHeading + (anim.targetHeading - anim.startHeading) * t + 360) % 360;

      const current = { latitude: lat, longitude: lng };
      this.currentPositions.set(memberId, current);
      this.currentHeadings.set(memberId, heading);

      this.onUpdate(memberId, current, heading);

      if (progress < 1.0) {
        anim.rafId = requestAnimationFrame(step);
      } else {
        this.activeAnimations.delete(memberId);
      }
    };

    this.activeAnimations.set(memberId, anim);
    anim.rafId = requestAnimationFrame(step);
  }

  public getCurrentPosition(memberId: string): LatLng | undefined {
    return this.currentPositions.get(memberId);
  }

  public getCurrentHeading(memberId: string): number | undefined {
    return this.currentHeadings.get(memberId);
  }

  public dispose(): void {
    for (const anim of this.activeAnimations.values()) {
      if (anim.rafId) cancelAnimationFrame(anim.rafId);
    }
    this.activeAnimations.clear();
    this.currentPositions.clear();
    this.currentHeadings.clear();
  }
}
