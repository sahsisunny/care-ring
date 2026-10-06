/**
 * Safety Event State Machine
 * Implements Section 15 of Safety Detection Layer.md
 *
 * States:
 * NORMAL -> POTENTIAL_EVENT -> VALIDATING -> CONFIRMED_EVENT -> COOLDOWN -> NORMAL
 */

import { SafetyEventType, SafetyStateMachineState } from './types';

export class SafetyEventStateMachine {
  private currentState: SafetyStateMachineState = 'NORMAL';
  private activeCandidateType: SafetyEventType | null = null;
  private stateEnteredAt: number = Date.now();
  private cooldownExpiryTime: number = 0;

  public reset(): void {
    this.currentState = 'NORMAL';
    this.activeCandidateType = null;
    this.stateEnteredAt = Date.now();
    this.cooldownExpiryTime = 0;
  }

  public getState(): SafetyStateMachineState {
    // Check if cooldown has expired
    if (this.currentState === 'COOLDOWN' && Date.now() >= this.cooldownExpiryTime) {
      this.currentState = 'NORMAL';
      this.activeCandidateType = null;
      this.stateEnteredAt = Date.now();
    }
    return this.currentState;
  }

  public getActiveCandidateType(): SafetyEventType | null {
    return this.activeCandidateType;
  }

  public transitionToPotential(type: SafetyEventType, timestamp: number = Date.now()): void {
    if (this.currentState === 'COOLDOWN') return;
    this.currentState = 'POTENTIAL_EVENT';
    this.activeCandidateType = type;
    this.stateEnteredAt = timestamp;
  }

  public transitionToValidating(type: SafetyEventType, timestamp: number = Date.now()): void {
    if (this.currentState === 'COOLDOWN') return;
    this.currentState = 'VALIDATING';
    this.activeCandidateType = type;
    this.stateEnteredAt = timestamp;
  }

  public transitionToConfirmed(type: SafetyEventType, timestamp: number = Date.now()): void {
    this.currentState = 'CONFIRMED_EVENT';
    this.activeCandidateType = type;
    this.stateEnteredAt = timestamp;
  }

  public transitionToCooldown(cooldownDurationMs: number, timestamp: number = Date.now()): void {
    this.currentState = 'COOLDOWN';
    this.stateEnteredAt = timestamp;
    this.cooldownExpiryTime = timestamp + cooldownDurationMs;
  }

  public transitionToNormal(timestamp: number = Date.now()): void {
    this.currentState = 'NORMAL';
    this.activeCandidateType = null;
    this.stateEnteredAt = timestamp;
    this.cooldownExpiryTime = 0;
  }

  public isInCooldown(): boolean {
    return this.getState() === 'COOLDOWN';
  }
}
