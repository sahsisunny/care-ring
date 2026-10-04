import AsyncStorage from '@react-native-async-storage/async-storage';

export type AiProvider = 'gemini' | 'claude' | 'openai';
export type AiLanguage = 'auto' | 'hi' | 'en' | 'hinglish';

export interface AiSettingsConfig {
  preferredProvider: AiProvider;
  customGeminiKey: string;
  customClaudeKey: string;
  customOpenAiKey: string;
  speechLanguage: AiLanguage;
  autoSpeak: boolean;
  hapticFeedback: boolean;
}

const STORAGE_KEYS = {
  PROVIDER: '@carering_ai_provider',
  GEMINI_KEY: '@carering_ai_gemini_key',
  CLAUDE_KEY: '@carering_ai_claude_key',
  OPENAI_KEY: '@carering_ai_openai_key',
  LANGUAGE: '@carering_ai_language',
  AUTO_SPEAK: '@carering_ai_auto_speak',
  HAPTIC: '@carering_ai_haptic',
};

export const SUPPORTED_LANGUAGES: { code: AiLanguage; label: string; flag: string }[] = [
  { code: 'auto', label: 'Auto (Hindi / English / Hinglish)', flag: '🌐' },
  { code: 'hi', label: 'Hindi (हिंदी)', flag: '🇮🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hinglish', label: 'Hinglish (Colloquial)', flag: '💬' },
];

class AiSettingsService {
  private configCache: AiSettingsConfig = {
    preferredProvider: 'gemini',
    customGeminiKey: '',
    customClaudeKey: '',
    customOpenAiKey: '',
    speechLanguage: 'auto',
    autoSpeak: true,
    hapticFeedback: true,
  };

  private isLoaded = false;
  private listeners: Array<(config: AiSettingsConfig) => void> = [];

  async loadSettings(): Promise<AiSettingsConfig> {
    try {
      const [
        provider,
        geminiKey,
        claudeKey,
        openaiKey,
        language,
        autoSpeak,
        haptic,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PROVIDER),
        AsyncStorage.getItem(STORAGE_KEYS.GEMINI_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.CLAUDE_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.OPENAI_KEY),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.AUTO_SPEAK),
        AsyncStorage.getItem(STORAGE_KEYS.HAPTIC),
      ]);

      this.configCache = {
        preferredProvider: (provider as AiProvider) || 'gemini',
        customGeminiKey: geminiKey || '',
        customClaudeKey: claudeKey || '',
        customOpenAiKey: openaiKey || '',
        speechLanguage: (language as AiLanguage) || 'auto',
        autoSpeak: autoSpeak !== null ? autoSpeak === 'true' : true,
        hapticFeedback: haptic !== null ? haptic === 'true' : true,
      };

      this.isLoaded = true;
      return this.configCache;
    } catch (err) {
      console.warn('[AiSettingsService] Failed to load settings from storage:', err);
      return this.configCache;
    }
  }

  getSettings(): AiSettingsConfig {
    return { ...this.configCache };
  }

  async saveSettings(updates: Partial<AiSettingsConfig>): Promise<AiSettingsConfig> {
    this.configCache = { ...this.configCache, ...updates };

    const savePromises: Promise<void>[] = [];

    if (updates.preferredProvider !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.PROVIDER, updates.preferredProvider));
    }
    if (updates.customGeminiKey !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.GEMINI_KEY, updates.customGeminiKey));
    }
    if (updates.customClaudeKey !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.CLAUDE_KEY, updates.customClaudeKey));
    }
    if (updates.customOpenAiKey !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.OPENAI_KEY, updates.customOpenAiKey));
    }
    if (updates.speechLanguage !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, updates.speechLanguage));
    }
    if (updates.autoSpeak !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.AUTO_SPEAK, String(updates.autoSpeak)));
    }
    if (updates.hapticFeedback !== undefined) {
      savePromises.push(AsyncStorage.setItem(STORAGE_KEYS.HAPTIC, String(updates.hapticFeedback)));
    }

    await Promise.all(savePromises);
    this.notifyListeners();
    return this.configCache;
  }

  getActiveCustomKey(provider?: AiProvider): string {
    const p = provider || this.configCache.preferredProvider;
    if (p === 'gemini') return this.configCache.customGeminiKey;
    if (p === 'claude') return this.configCache.customClaudeKey;
    if (p === 'openai') return this.configCache.customOpenAiKey;
    return '';
  }

  addListener(listener: (config: AiSettingsConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.configCache });
      } catch (e) {
        console.error('[AiSettingsService] Listener callback error:', e);
      }
    }
  }
}

export const aiSettingsService = new AiSettingsService();
