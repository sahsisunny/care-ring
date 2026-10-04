import { Platform } from 'react-native';
import { getBackendHttpUrl, LOCAL_DEV_HTTP_URL, LOCAL_TUNNEL_HTTP_URL, PRODUCTION_HTTP_URL } from './backendUrl';
import { aiSettingsService, AiProvider, AiLanguage } from './AiSettingsService';

export type AiActionType =
  | 'VIEW_DRIVING_REPORT'
  | 'VIEW_TIMELINE'
  | 'SET_NICKNAME'
  | 'REMOVE_MEMBER'
  | 'JOIN_CIRCLE'
  | 'CREATE_CIRCLE'
  | 'INVITE_MEMBER'
  | 'TRIGGER_SOS'
  | 'CREATE_BUBBLE'
  | 'ADD_PLACE';

export interface AiActionIntent {
  type: AiActionType;
  memberId?: string;
  memberName?: string;
  nickname?: string;
  inviteCode?: string;
  circleName?: string;
  placeName?: string;
  drivingStats?: {
    topSpeedKm: number;
    totalDistanceKm: number;
    safetyScore: number;
    rapidAccelCount: number;
    hardBrakingCount: number;
    tripsCount: number;
  };
  timelineData?: {
    userId?: string;
    totalDistanceKm?: number;
    stopCount?: number;
    tripCount?: number;
    stops?: Array<{
      title: string;
      address: string;
      startTime: string;
      endTime: string;
      durationMinutes: number;
    }>;
    trips?: Array<{
      fromAddress: string;
      toAddress: string;
      distanceKm: number;
      durationMinutes: number;
      topSpeed: number;
    }>;
  };
  dbResult?: any;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  hasAudio?: boolean;
  audioDataUri?: string;
  provider?: string;
  action?: AiActionIntent;
}

export interface AiMemberContext {
  id?: string;
  name: string;
  nickname?: string;
  isSelf?: boolean;
  location?: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  isMoving?: boolean;
  isStationary?: boolean;
  stationaryDuration?: string;
  battery?: number;
  isCharging?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  inBubble?: boolean;
  savedPlace?: string;
  distanceFromCaller?: string;
  etaFromCaller?: string;
}

export interface AiChatContext {
  isAdmin?: boolean;
  circleId?: string;
  speed?: number;
  isDriving?: boolean;
  batteryLevel?: number;
  circleName?: string;
  membersCount?: number;
  currentUserName?: string;
  address?: string;
  activeEmergency?: {
    senderName: string;
    latitude?: number;
    longitude?: number;
    time?: string;
  } | null;
  members?: AiMemberContext[];
  savedPlaces?: Array<{ name: string; address?: string; radius?: number }>;
}

export interface AiChatResponse {
  reply: string;
  provider: string;
  model: string;
  action?: AiActionIntent;
}

export interface TtsResponse {
  status: string;
  useNativeSpeech?: boolean;
  text?: string;
  audioBase64?: string;
  audioDataUri?: string;
  format?: string;
  voiceId?: string;
}

class AiChatService {
  private cachedWorkingBaseUrl: string | null = null;

  private getCandidateBaseUrls(): string[] {
    const list: string[] = [];

    // 0. Ultra-fast path: prioritize last known responsive backend base URL
    if (this.cachedWorkingBaseUrl && !list.includes(this.cachedWorkingBaseUrl)) {
      list.push(this.cachedWorkingBaseUrl);
    }

    // 1. Highest priority: explicit ngrok/localtunnel URL from env var
    //    Set EXPO_PUBLIC_AI_BACKEND_URL in mobile/.env to reach local backend over Expo Tunnel
    if (LOCAL_TUNNEL_HTTP_URL && !list.includes(LOCAL_TUNNEL_HTTP_URL)) {
      list.push(LOCAL_TUNNEL_HTTP_URL);
    }

    // 2. Current configured backend (LAN IP on same WiFi, or production in tunnel mode)
    const primary = getBackendHttpUrl();
    if (!list.includes(primary)) list.push(primary);

    // 3. Platform-specific loopback (works in simulators/emulators, not on physical devices)
    if (Platform.OS === 'ios') {
      if (!list.includes('http://127.0.0.1:4000')) list.push('http://127.0.0.1:4000');
    }
    if (Platform.OS === 'android') {
      if (!list.includes('http://10.0.2.2:4000')) list.push('http://10.0.2.2:4000');
    }

    // 4. LAN IP fallback (works only when phone is on the same WiFi as the Mac)
    if (!list.includes(LOCAL_DEV_HTTP_URL)) list.push(LOCAL_DEV_HTTP_URL);

    // 5. Last resort: cloud production
    if (!list.includes(PRODUCTION_HTTP_URL)) list.push(PRODUCTION_HTTP_URL);

    return list;
  }

  async fetchConfig(): Promise<any> {
    const urls = this.getCandidateBaseUrls();
    for (const baseUrl of urls) {
      try {
        const res = await fetch(`${baseUrl}/api/ai/config`, { method: 'GET' });
        if (res.ok) {
          this.cachedWorkingBaseUrl = baseUrl;
          return await res.json();
        }
      } catch (_) {}
    }
    return null;
  }

  async sendChatMessage(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
    options?: {
      provider?: AiProvider;
      language?: AiLanguage;
      voiceMode?: boolean;
      context?: AiChatContext;
      audioDataUri?: string;
    }
  ): Promise<AiChatResponse> {
    const settings = aiSettingsService.getSettings();
    const provider = options?.provider || settings.preferredProvider;
    const language = options?.language || settings.speechLanguage;
    const voiceMode = options?.voiceMode || false;

    // Retrieve custom key if user saved one
    const customKey = aiSettingsService.getActiveCustomKey(provider);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (customKey) {
      headers['x-custom-ai-key'] = customKey;
    }

    const payload = {
      messages,
      provider,
      language,
      voiceMode,
      audioDataUri: options?.audioDataUri,
      context: options?.context,
    };

    const candidateUrls = this.getCandidateBaseUrls();
    let lastError: any = null;

    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        if (res.status === 404) {
          // If 404 on current endpoint, try next candidate URL
          continue;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Server responded with status ${res.status}`);
        }

        // Cache working base URL so all future turns connect instantly
        this.cachedWorkingBaseUrl = baseUrl;

        return {
          reply: data.reply,
          provider: data.provider,
          model: data.model,
          action: data.action || undefined,
        };
      } catch (err) {
        lastError = err;
        if (baseUrl === this.cachedWorkingBaseUrl) {
          this.cachedWorkingBaseUrl = null;
        }
      }
    }

    throw lastError || new Error('Could not reach AI server. Please verify network connection.');
  }

  async synthesizeSpeech(text: string): Promise<TtsResponse> {
    const settings = aiSettingsService.getSettings();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const candidateUrls = this.getCandidateBaseUrls();
    let lastError: any = null;

    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/ai/tts`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text,
            language: settings.speechLanguage,
          }),
        });

        if (res.status === 404) {
          continue;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `TTS failed with status ${res.status}`);
        }

        this.cachedWorkingBaseUrl = baseUrl;
        return data;
      } catch (err) {
        lastError = err;
      }
    }

    // Graceful fallback to native device speech if TTS endpoints fail
    return {
      status: 'fallback',
      useNativeSpeech: true,
      text,
    };
  }

  async testApiKey(
    provider: 'gemini' | 'claude' | 'openai',
    apiKey: string
  ): Promise<{ valid: boolean; message?: string; error?: string }> {
    const candidateUrls = this.getCandidateBaseUrls();
    for (const baseUrl of candidateUrls) {
      try {
        const res = await fetch(`${baseUrl}/api/ai/test-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey }),
        });
        if (res.status === 404) continue;
        return await res.json();
      } catch (_) {}
    }
    return { valid: false, error: 'Could not connect to AI test endpoint' };
  }
}

export const aiChatService = new AiChatService();
