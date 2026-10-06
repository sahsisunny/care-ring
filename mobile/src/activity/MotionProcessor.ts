/**
 * Motion Processor: Accelerometer & Gyroscope Analysis
 * Analyzes cadence, energy, impact variance, and vehicle vibrations.
 */

import { ActivityConfig } from './ActivityConfig';
import { MotionFeatures, MotionReading } from './types';

export class MotionProcessor {
  private buffer: MotionReading[] = [];

  public reset(): void {
    this.buffer = [];
  }

  public addReading(reading: MotionReading): void {
    this.buffer.push(reading);
    if (this.buffer.length > ActivityConfig.MOTION_WINDOW_SAMPLE_COUNT) {
      this.buffer.shift();
    }
  }

  public extractFeatures(): MotionFeatures {
    if (this.buffer.length < 5) {
      return {
        variance: 0,
        energy: 0,
        peakCount: 0,
        estimatedCadence: 0,
        verticalOscillation: 0,
        leanVariance: 0,
        gyroEnergy: 0,
        isStepLike: false,
        isVehicleVibration: false,
        hasMotionData: false,
        sampleCount: this.buffer.length,
      };
    }

    const n = this.buffer.length;
    let sumDynamic = 0;
    let sumSqDynamic = 0;
    const dynamicMags: number[] = [];

    // Lean and gyroscope accumulators
    let sumGyroSq = 0;
    let hasGyro = false;

    for (let i = 0; i < n; i++) {
      const reading = this.buffer[i];
      // Dynamic acceleration (deviation from 1.0g gravity)
      const dynamicMag = Math.abs(reading.magnitude - 1.0);
      dynamicMags.push(dynamicMag);
      sumDynamic += dynamicMag;
      sumSqDynamic += dynamicMag * dynamicMag;

      if (reading.gyroX !== undefined && reading.gyroY !== undefined && reading.gyroZ !== undefined) {
        hasGyro = true;
        const gyroMagSq =
          reading.gyroX * reading.gyroX +
          reading.gyroY * reading.gyroY +
          reading.gyroZ * reading.gyroZ;
        sumGyroSq += gyroMagSq;
      }
    }

    const meanDynamic = sumDynamic / n;
    const variance = Math.max(0, sumSqDynamic / n - meanDynamic * meanDynamic);
    const energy = sumSqDynamic / n;
    const gyroEnergy = hasGyro ? sumGyroSq / n : 0;

    // Peak detection for cadence (steps / pedal cycles)
    // Minimum peak height: 0.12g dynamic acceleration, min gap: 240ms (~250 steps/min ceiling)
    let peakCount = 0;
    let lastPeakTime = 0;
    const startTime = this.buffer[0].timestamp;
    const endTime = this.buffer[n - 1].timestamp;
    const durationSec = Math.max(0.5, (endTime - startTime) / 1000);

    for (let i = 1; i < n - 1; i++) {
      const prev = dynamicMags[i - 1];
      const curr = dynamicMags[i];
      const next = dynamicMags[i + 1];

      if (curr > 0.12 && curr > prev && curr > next) {
        const time = this.buffer[i].timestamp;
        if (time - lastPeakTime >= 240) {
          peakCount++;
          lastPeakTime = time;
        }
      }
    }

    const estimatedCadence = Math.round((peakCount / durationSec) * 60);

    // Human stepping indicators (walking: 80-130 spm, running: 135-210 spm)
    const isStepLike = estimatedCadence >= 70 && estimatedCadence <= 220 && energy >= 0.025;

    // Vehicle vibration: low overall variance compared to human footfalls, but steady micro-energy
    const isVehicleVibration = energy > 0.005 && energy < 0.12 && !isStepLike;

    // Vertical oscillation proxy: standard deviation of Z-axis
    const zVals = this.buffer.map((b) => b.z);
    const avgZ = zVals.reduce((a, b) => a + b, 0) / n;
    const zVariance = zVals.reduce((acc, z) => acc + Math.pow(z - avgZ, 2), 0) / n;
    const verticalOscillation = Math.sqrt(zVariance);

    // Lean variance (motorcycle vs car): lateral tilt variance on X/Y axes + gyro
    const xVals = this.buffer.map((b) => b.x);
    const avgX = xVals.reduce((a, b) => a + b, 0) / n;
    const xVariance = xVals.reduce((acc, x) => acc + Math.pow(x - avgX, 2), 0) / n;
    const leanVariance = xVariance + (hasGyro ? gyroEnergy * 0.5 : 0);

    return {
      variance: Math.round(variance * 1000) / 1000,
      energy: Math.round(energy * 1000) / 1000,
      peakCount,
      estimatedCadence,
      verticalOscillation: Math.round(verticalOscillation * 1000) / 1000,
      leanVariance: Math.round(leanVariance * 1000) / 1000,
      gyroEnergy: Math.round(gyroEnergy * 1000) / 1000,
      isStepLike,
      isVehicleVibration,
      hasMotionData: true,
      sampleCount: n,
    };
  }
}
