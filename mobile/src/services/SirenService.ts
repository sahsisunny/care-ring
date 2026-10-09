import { Platform, Vibration } from 'react-native';
import { hapticService } from './HapticService';

type SirenListener = (isPlaying: boolean) => void;

/**
 * Safely resolves the native audio module without crashing Expo Go or Web
 * if the underlying native binaries are missing from the current runtime.
 */
function getNativeAudioModule(): any {
  if (Platform.OS === 'web') return null;
  try {
    // Expo SDK 57 official audio library
    return require('expo-audio');
  } catch (_) {
    return null;
  }
}

class SirenService {
  private nativePlayer: any = null;
  private isPlaying: boolean = false;
  private isInitializing: boolean = false;
  private listeners: Set<SirenListener> = new Set();
  private webAudioContext: any = null;
  private webOscillator: any = null;
  private webGainNode: any = null;
  private webTimer: any = null;

  public isSirenActive(): boolean {
    return this.isPlaying;
  }

  public subscribe(listener: SirenListener): () => void {
    this.listeners.add(listener);
    listener(this.isPlaying);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.isPlaying);
      } catch (err) {
        console.warn('[SirenService] Listener error:', err);
      }
    });
  }

  /**
   * Configures the system audio session to play through the loudspeaker
   * bypassing silent/ringer switches where possible.
   */
  private async configureAudioMode(): Promise<void> {
    const audioModule = getNativeAudioModule();
    if (!audioModule?.setAudioModeAsync) return;
    try {
      await audioModule.setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'duckOthers',
      });
    } catch (err) {
      console.warn('[SirenService] setAudioModeAsync notice:', err);
    }
  }

  /**
   * Starts blaring the emergency panic siren audio & vibrating continuously.
   */
  public async playSiren(): Promise<void> {
    if (this.isPlaying || this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.isPlaying = true;
      this.notifyListeners();

      // 1. Continuous emergency vibration pulses on native devices
      try {
        if (Platform.OS !== 'web') {
          Vibration.vibrate([0, 600, 200, 600, 200, 600], true);
        } else {
          hapticService.heavy();
        }
      } catch {}

      // 2. Play native audio via expo-audio (available in APK & dev client)
      let audioStarted = false;
      const audioModule = getNativeAudioModule();
      if (audioModule?.createAudioPlayer) {
        try {
          await this.configureAudioMode();

          // Release any previous player instance
          if (this.nativePlayer) {
            try {
              this.nativePlayer.pause();
              this.nativePlayer.remove?.();
            } catch {}
            this.nativePlayer = null;
          }

          const soundAsset = require('../../assets/sounds/siren.wav');
          const player = audioModule.createAudioPlayer(soundAsset);
          if (player) {
            player.loop = true;
            player.volume = 1.0;
            player.play();
            this.nativePlayer = player;
            audioStarted = true;
          }
        } catch (err) {
          console.warn('[SirenService] expo-audio player notice:', err);
        }
      }

      // 3. If native audio module is not present (e.g. Expo Go sandbox or web), use Web Audio synthesizer
      if (!audioStarted && (Platform.OS === 'web' || typeof window !== 'undefined')) {
        this.playWebSirenFallback();
      }
    } catch (err) {
      console.warn('[SirenService] Failed to play siren:', err);
      if (Platform.OS === 'web') {
        this.playWebSirenFallback();
      }
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Stops the siren immediately, releases audio resources, and stops vibrations.
   */
  public async stopSiren(): Promise<void> {
    this.isPlaying = false;
    this.notifyListeners();

    // 1. Cancel vibration pattern
    try {
      Vibration.cancel();
    } catch {}

    // 2. Stop Web Audio fallback if active
    this.stopWebSirenFallback();

    // 3. Stop & release native player
    if (this.nativePlayer) {
      const player = this.nativePlayer;
      this.nativePlayer = null;
      try {
        player.pause();
        player.remove?.();
      } catch {}
    }
  }

  /**
   * Toggles the emergency siren on / off
   */
  public async toggleSiren(): Promise<boolean> {
    if (this.isPlaying) {
      await this.stopSiren();
      return false;
    } else {
      await this.playSiren();
      return true;
    }
  }

  /**
   * Web Audio API synthesizer for browsers or Web environments
   */
  private playWebSirenFallback(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.stopWebSirenFallback();

      const ctx = new AudioCtx();
      this.webAudioContext = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.35, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      let sweepUp = true;
      let freq = 650;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      this.webTimer = setInterval(() => {
        if (!this.isPlaying || !this.webAudioContext) return;
        freq += sweepUp ? 40 : -40;
        if (freq >= 1200) sweepUp = false;
        if (freq <= 650) sweepUp = true;
        try {
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
        } catch {}
      }, 50);

      osc.start();
      this.webOscillator = osc;
      this.webGainNode = gain;
    } catch (e) {
      console.warn('[SirenService] Web Audio fallback unavailable:', e);
    }
  }

  private stopWebSirenFallback(): void {
    if (this.webTimer) {
      clearInterval(this.webTimer);
      this.webTimer = null;
    }
    if (this.webOscillator) {
      try {
        this.webOscillator.stop();
        this.webOscillator.disconnect();
      } catch {}
      this.webOscillator = null;
    }
    if (this.webGainNode) {
      try {
        this.webGainNode.disconnect();
      } catch {}
      this.webGainNode = null;
    }
    if (this.webAudioContext) {
      try {
        this.webAudioContext.close();
      } catch {}
      this.webAudioContext = null;
    }
  }
}

export const sirenService = new SirenService();
