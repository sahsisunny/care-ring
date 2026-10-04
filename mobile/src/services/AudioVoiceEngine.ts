import { Platform, PermissionsAndroid } from 'react-native';

export interface VoicePlaybackCallbacks {
  onStart?: () => void;
  onFinish?: () => void;
  onError?: (err: any) => void;
  onFrequency?: (freq: number) => void; // 0 to 1 real physical frequency
}

export interface SpeechRecognitionCallbacks {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (err: any) => void;
  onEnd?: () => void;
  onVolumeChange?: (volume: number) => void; // 0 to 1 real physical frequency
  onAudioRecorded?: (audioDataUri: string) => void; // real base64 audio recorded from hardware mic
}

export interface NativeAudioBridge {
  play: (uri: string) => void;
  speakNative: (text: string, lang: string) => void;
  stop: () => void;
  startListening: (lang: string) => void;
  stopListening: () => void;
}

class AudioVoiceEngine {
  private webAudioElement: any = null;
  private webMediaStream: any = null;
  private webAudioContext: any = null;
  private webAnalyser: any = null;
  private webAnimFrame: number | null = null;
  private recognitionInstance: any = null;

  private nativeBridge: NativeAudioBridge | null = null;
  private isPlayingAudio = false;
  private isListeningActive = false;
  private activePlaybackCallbacks: VoicePlaybackCallbacks | null = null;
  private activeListeningCallbacks: SpeechRecognitionCallbacks | null = null;

  // Set native bridge from HeadlessAudioBridge component
  setNativeBridge(bridge: NativeAudioBridge | null) {
    this.nativeBridge = bridge;
  }

  // ===================== PLAYBACK METHODS ===================== //

  async playSpeechAudio(audioUri: string, callbacks?: VoicePlaybackCallbacks): Promise<void> {
    await this.stopPlayback();

    this.isPlayingAudio = true;
    this.activePlaybackCallbacks = callbacks || null;

    // Web Platform: use native HTML5 Audio element with Web Audio Analyser for real frequency
    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).Audio) {
      try {
        const audio = new (window as any).Audio(audioUri);
        this.webAudioElement = audio;

        // Hook up Web Audio Analyser for real playback frequency
        try {
          const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            const source = ctx.createMediaElementSource(audio);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.7;
            source.connect(analyser);
            analyser.connect(ctx.destination);

            const freqBuffer = new Uint8Array(analyser.frequencyBinCount);
            const reportFreq = () => {
              if (this.isPlayingAudio && this.webAudioElement) {
                analyser.getByteFrequencyData(freqBuffer);
                let sum = 0;
                for (let i = 0; i < freqBuffer.length; i++) sum += freqBuffer[i];
                const avg = sum / freqBuffer.length;
                const normalized = Math.min(1.0, (avg / 128) * 1.4);
                this.activePlaybackCallbacks?.onFrequency?.(normalized);
                requestAnimationFrame(reportFreq);
              }
            };
            audio.onplay = () => {
              this.activePlaybackCallbacks?.onStart?.();
              requestAnimationFrame(reportFreq);
            };
          }
        } catch (_) {
          audio.onplay = () => {
            this.activePlaybackCallbacks?.onStart?.();
          };
        }

        audio.onended = () => {
          this.isPlayingAudio = false;
          this.webAudioElement = null;
          this.activePlaybackCallbacks?.onFinish?.();
        };

        audio.onerror = (e: any) => {
          this.isPlayingAudio = false;
          this.webAudioElement = null;
          this.activePlaybackCallbacks?.onError?.(e);
        };

        await audio.play();
        return;
      } catch (webErr) {
        console.warn('[AudioVoiceEngine] Web HTML5 audio play failed:', webErr);
        this.isPlayingAudio = false;
        this.activePlaybackCallbacks?.onError?.(webErr);
        return;
      }
    }

    // Native Platform (Android / iOS): use HeadlessAudioBridge
    if (this.nativeBridge) {
      try {
        this.nativeBridge.play(audioUri);
      } catch (err) {
        console.warn('[AudioVoiceEngine] Native bridge play failed:', err);
        this.isPlayingAudio = false;
        this.activePlaybackCallbacks?.onError?.(err);
      }
    } else {
      console.log('[AudioVoiceEngine] Simulating audio playback...');
      this.activePlaybackCallbacks?.onStart?.();
      setTimeout(() => {
        this.isPlayingAudio = false;
        this.activePlaybackCallbacks?.onFinish?.();
      }, 2500);
    }
  }

  // Native speech synthesis (used as fallback when Google Translate TTS is unavailable)
  async speakNativeText(text: string, language: string = 'auto', callbacks?: VoicePlaybackCallbacks): Promise<void> {
    await this.stopPlayback();

    this.isPlayingAudio = true;
    this.activePlaybackCallbacks = callbacks || null;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).speechSynthesis) {
      try {
        (window as any).speechSynthesis.cancel();
        const utterance = new (window as any).SpeechSynthesisUtterance(text);

        let langTag = 'en-US';
        if (language === 'hi' || language === 'hinglish') {
          langTag = 'hi-IN';
        } else if (language === 'auto') {
          langTag = 'en-IN';
        }
        utterance.lang = langTag;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to pick a natural voice matching language
        const voices = (window as any).speechSynthesis.getVoices();
        const matchedVoice = voices.find((v: any) => v.lang.startsWith(langTag.substring(0, 2)));
        if (matchedVoice) utterance.voice = matchedVoice;

        utterance.onstart = () => {
          this.activePlaybackCallbacks?.onStart?.();
        };

        utterance.onend = () => {
          this.isPlayingAudio = false;
          this.activePlaybackCallbacks?.onFinish?.();
        };

        utterance.onerror = (e: any) => {
          this.isPlayingAudio = false;
          this.activePlaybackCallbacks?.onError?.(e);
        };

        (window as any).speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn('[AudioVoiceEngine] Web speechSynthesis failed:', e);
      }
    }

    if (this.nativeBridge) {
      this.nativeBridge.speakNative(text, language);
    } else {
      this.activePlaybackCallbacks?.onStart?.();
      setTimeout(() => {
        this.isPlayingAudio = false;
        this.activePlaybackCallbacks?.onFinish?.();
      }, 2500);
    }
  }

  async stopPlayback(): Promise<void> {
    this.isPlayingAudio = false;

    // Web audio stop
    if (this.webAudioElement) {
      try {
        this.webAudioElement.pause();
        this.webAudioElement.currentTime = 0;
      } catch (_) {}
      this.webAudioElement = null;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined' && (window as any).speechSynthesis) {
      try {
        (window as any).speechSynthesis.cancel();
      } catch (_) {}
    }

    // Native audio stop
    if (this.nativeBridge) {
      try {
        this.nativeBridge.stop();
      } catch (_) {}
    }
  }

  isSpeaking(): boolean {
    return this.isPlayingAudio;
  }

  // Callbacks invoked by HeadlessAudioBridge
  onNativePlaybackStart() {
    this.isPlayingAudio = true;
    this.activePlaybackCallbacks?.onStart?.();
  }

  onNativePlaybackFinish() {
    this.isPlayingAudio = false;
    this.activePlaybackCallbacks?.onFinish?.();
    this.activePlaybackCallbacks = null;
  }

  onNativePlaybackError(msg: string) {
    this.isPlayingAudio = false;
    this.activePlaybackCallbacks?.onError?.(new Error(msg));
    this.activePlaybackCallbacks = null;
  }

  onNativePlaybackStop() {
    this.isPlayingAudio = false;
    this.activePlaybackCallbacks = null;
  }

  onNativeFrequency(freq: number) {
    if (this.isListeningActive) {
      this.activeListeningCallbacks?.onVolumeChange?.(freq);
    } else if (this.isPlayingAudio) {
      this.activePlaybackCallbacks?.onFrequency?.(freq);
    }
  }

  onNativeTranscript(text: string, isFinal: boolean) {
    this.activeListeningCallbacks?.onResult?.(text, isFinal);
  }

  onNativeAudioRecorded(audioDataUri: string) {
    this.activeListeningCallbacks?.onAudioRecorded?.(audioDataUri);
  }

  // ===================== REAL MICROPHONE SPEECH RECOGNITION ===================== //

  async requestMicPermission(): Promise<boolean> {
    try {
      // 1. Android: Trigger system modal "Allow CareRing to record audio?"
      if (Platform.OS === 'android') {
        const alreadyGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (alreadyGranted) {
          return true;
        }

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission Needed',
            message: 'CareRing needs access to your microphone for ChatGPT Voice Mode AI conversations.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }

      // 2. iOS: Trigger native iOS modal "CareRing Would Like to Access the Microphone"
      if (Platform.OS === 'ios') {
        try {
          const { requestRecordingPermissionsAsync, getRecordingPermissionsAsync } = require('expo-audio');
          if (typeof getRecordingPermissionsAsync === 'function') {
            const status = await getRecordingPermissionsAsync();
            if (status?.granted) return true;
          }
          if (typeof requestRecordingPermissionsAsync === 'function') {
            const res = await requestRecordingPermissionsAsync();
            return !!res?.granted;
          }
        } catch (e) {
          console.warn('[AudioVoiceEngine] expo-audio iOS mic prompt error:', e);
        }
      }

      // 3. Web: Trigger browser microphone permission prompt
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          return true;
        } catch (err) {
          console.warn('[AudioVoiceEngine] Web mic permission rejected:', err);
          return false;
        }
      }

      return true;
    } catch (err) {
      console.warn('[AudioVoiceEngine] requestMicPermission top error:', err);
      return false;
    }
  }

  async startListening(language: string = 'auto', callbacks?: SpeechRecognitionCallbacks): Promise<boolean> {
    this.stopListening();
    this.isListeningActive = true;
    this.activeListeningCallbacks = callbacks || null;

    let langCode = 'en-US';
    if (language === 'hi' || language === 'hinglish') {
      langCode = 'hi-IN';
    } else if (language === 'auto') {
      langCode = 'en-IN';
    }

    // Web Platform: request REAL microphone access via getUserMedia and attach AnalyserNode
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        // 1. Trigger actual browser microphone permission prompt!
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.webMediaStream = stream;

          // 2. Setup REAL physical frequency analyser
          const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            this.webAudioContext = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);
            this.webAnalyser = analyser;

            const freqBuffer = new Uint8Array(analyser.frequencyBinCount);

            const measureRealFrequency = () => {
              if (this.isListeningActive && this.webAnalyser) {
                this.webAnalyser.getByteFrequencyData(freqBuffer);

                // Calculate actual frequency energy sum across audible voice spectrum (80Hz - 3500Hz)
                let energySum = 0;
                for (let i = 2; i < Math.min(freqBuffer.length, 64); i++) {
                  energySum += freqBuffer[i];
                }
                const avgEnergy = energySum / 62;
                // Normalize 0.0 to 1.0 based on real mic acoustic input
                const normalized = Math.max(0, Math.min(1.0, (avgEnergy / 110)));

                this.activeListeningCallbacks?.onVolumeChange?.(normalized);
                this.webAnimFrame = requestAnimationFrame(measureRealFrequency);
              }
            };

            this.webAnimFrame = requestAnimationFrame(measureRealFrequency);
          }
        }
      } catch (err: any) {
        console.warn('[AudioVoiceEngine] getUserMedia error:', err);
        callbacks?.onError?.(err?.message || 'Microphone permission denied');
        this.isListeningActive = false;
        return false;
      }

      // 3. Start Web Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = langCode;

          recognition.onresult = (event: any) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                final += transcript;
              } else {
                interim += transcript;
              }
            }

            if (final.trim()) {
              callbacks?.onResult?.(final.trim(), true);
            } else if (interim.trim()) {
              callbacks?.onResult?.(interim.trim(), false);
            }
          };

          recognition.onerror = (event: any) => {
            console.log('[AudioVoiceEngine] SpeechRecognition error:', event.error);
            if (event.error !== 'no-speech') {
              callbacks?.onError?.(event.error);
            }
          };

          recognition.onend = () => {
            this.recognitionInstance = null;
            callbacks?.onEnd?.();
          };

          recognition.start();
          this.recognitionInstance = recognition;
          return true;
        } catch (e) {
          console.warn('[AudioVoiceEngine] Speech recognition start error:', e);
        }
      }
      return true;
    }

    // Native Platform (Android / iOS): delegate to HeadlessAudioBridge
    if (this.nativeBridge) {
      this.nativeBridge.startListening(langCode);
      return true;
    }

    return true;
  }

  async stopListening(): Promise<void> {
    this.isListeningActive = false;

    if (this.webAnimFrame) {
      cancelAnimationFrame(this.webAnimFrame);
      this.webAnimFrame = null;
    }

    if (this.webMediaStream) {
      try {
        this.webMediaStream.getTracks().forEach((t: any) => t.stop());
      } catch (_) {}
      this.webMediaStream = null;
    }

    if (this.webAudioContext) {
      try {
        this.webAudioContext.close();
      } catch (_) {}
      this.webAudioContext = null;
      this.webAnalyser = null;
    }

    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch (_) {}
      this.recognitionInstance = null;
    }

    if (this.nativeBridge) {
      this.nativeBridge.stopListening();
    }
  }

  isListening(): boolean {
    return this.isListeningActive;
  }
}

export const audioVoiceEngine = new AudioVoiceEngine();
