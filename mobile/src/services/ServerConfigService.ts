import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDefaultBackendWsUrl, setCustomWsUrlCache, PRODUCTION_WS_URL } from './backendUrl';

export const STORAGE_KEY_CUSTOM_SERVER = '@carering_custom_server_url';
export const DEFAULT_SERVER_WS = PRODUCTION_WS_URL;

export interface ServerPingResult {
  success: boolean;
  latencyMs: number;
  service?: string;
  error?: string;
  timestamp?: string;
}

export type ServerChangeListener = (newWsUrl: string) => void;

class ServerConfigService {
  private static instance: ServerConfigService;
  private currentCustomWsUrl: string | null = null;
  private initialized: boolean = false;
  private listeners: Set<ServerChangeListener> = new Set();

  private constructor() {}

  public static getInstance(): ServerConfigService {
    if (!ServerConfigService.instance) {
      ServerConfigService.instance = new ServerConfigService();
    }
    return ServerConfigService.instance;
  }

  /**
   * Initializes the service by reading stored custom server URL from AsyncStorage
   */
  public async init(): Promise<string> {
    if (this.initialized) {
      return this.getActiveWsUrl();
    }

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_SERVER);
      if (stored && stored.trim().length > 0) {
        const normalized = this.normalizeWsUrl(stored.trim());
        this.currentCustomWsUrl = normalized;
        setCustomWsUrlCache(normalized);
      } else {
        this.currentCustomWsUrl = null;
        setCustomWsUrlCache(null);
      }
    } catch (err) {
      console.warn('[ServerConfigService] Error loading stored server URL:', err);
      this.currentCustomWsUrl = null;
      setCustomWsUrlCache(null);
    }

    this.initialized = true;
    return this.getActiveWsUrl();
  }

  /**
   * Returns true if user is currently configured with a custom private server
   */
  public isCustomServer(): boolean {
    return this.currentCustomWsUrl !== null;
  }

  /**
   * Returns the stored custom URL if any, or null
   */
  public getCustomWsUrl(): string | null {
    return this.currentCustomWsUrl;
  }

  /**
   * Returns the currently active WebSocket URL (custom if set, or default)
   */
  public getActiveWsUrl(): string {
    if (this.currentCustomWsUrl) {
      return this.currentCustomWsUrl;
    }
    return getDefaultBackendWsUrl();
  }

  /**
   * Returns the currently active HTTP/HTTPS URL
   */
  public getActiveHttpUrl(): string {
    return this.toHttpUrl(this.getActiveWsUrl());
  }

  /**
   * Converts any URL (http, https, ws, wss or plain host) to a WebSocket URL
   */
  public normalizeWsUrl(rawInput: string): string {
    let input = (rawInput || '').trim();
    if (!input) return DEFAULT_SERVER_WS;

    // Strip trailing slashes
    input = input.replace(/\/+$/, '');

    // Convert http/https protocols to ws/wss
    if (input.startsWith('https://')) {
      return input.replace('https://', 'wss://');
    }
    if (input.startsWith('http://')) {
      return input.replace('http://', 'ws://');
    }
    if (input.startsWith('wss://') || input.startsWith('ws://')) {
      return input;
    }

    // If no protocol was provided
    const isLocal =
      input.startsWith('localhost') ||
      input.startsWith('127.0.0.1') ||
      input.startsWith('10.0.2.2') ||
      input.startsWith('192.168.') ||
      input.startsWith('10.') ||
      input.startsWith('172.');

    return isLocal ? `ws://${input}` : `wss://${input}`;
  }

  /**
   * Converts any URL (ws, wss, or plain host) to an HTTP/HTTPS URL
   */
  public toHttpUrl(wsOrHttpUrl: string): string {
    let input = (wsOrHttpUrl || '').trim();
    if (!input) return 'https://care-ring.onrender.com';

    // Strip trailing slashes
    input = input.replace(/\/+$/, '');

    if (input.startsWith('wss://')) {
      return input.replace('wss://', 'https://');
    }
    if (input.startsWith('ws://')) {
      return input.replace('ws://', 'http://');
    }
    if (input.startsWith('https://') || input.startsWith('http://')) {
      return input;
    }

    const isLocal =
      input.startsWith('localhost') ||
      input.startsWith('127.0.0.1') ||
      input.startsWith('10.0.2.2') ||
      input.startsWith('192.168.') ||
      input.startsWith('10.') ||
      input.startsWith('172.');

    return isLocal ? `http://${input}` : `https://${input}`;
  }

  /**
   * Extracts clean domain and port for compact UI display
   */
  public getCleanHost(url?: string): string {
    const target = url || this.getActiveWsUrl();
    return target
      .replace(/^wss?:\/\//i, '')
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
  }

  /**
   * Sets and persists a new server URL.
   * If url is null, empty, or points to default cloud, resets to default.
   */
  public async setServerUrl(rawUrl: string | null): Promise<string> {
    const trimmed = (rawUrl || '').trim();

    if (!trimmed || trimmed === DEFAULT_SERVER_WS || trimmed === 'https://care-ring.onrender.com') {
      // Reset to default
      this.currentCustomWsUrl = null;
      setCustomWsUrlCache(null);
      await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_SERVER);
      const defaultUrl = getDefaultBackendWsUrl();
      this.notifyListeners(defaultUrl);
      return defaultUrl;
    }

    const normalized = this.normalizeWsUrl(trimmed);
    this.currentCustomWsUrl = normalized;
    setCustomWsUrlCache(normalized);
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_SERVER, normalized);
    this.notifyListeners(normalized);
    return normalized;
  }

  /**
   * Reset to default cloud
   */
  public async resetToDefault(): Promise<string> {
    return this.setServerUrl(null);
  }

  /**
   * Ping /health endpoint on the target server to test reachability and latency
   */
  public async testConnection(candidateUrl: string): Promise<ServerPingResult> {
    const httpBase = this.toHttpUrl(candidateUrl);
    const healthEndpoint = `${httpBase}/health`;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(healthEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.max(1, Date.now() - startTime);

      if (!response.ok) {
        return {
          success: false,
          latencyMs,
          error: `Server responded with HTTP ${response.status} (${response.statusText || 'Error'})`,
        };
      }

      let parsed: any = null;
      try {
        parsed = await response.json();
      } catch {
        // If not JSON, but 200 OK, server is reachable
      }

      return {
        success: true,
        latencyMs,
        service: parsed?.service || 'CareRing Fastify Engine',
        timestamp: parsed?.timestamp,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Math.max(1, Date.now() - startTime);

      if (err.name === 'AbortError') {
        return {
          success: false,
          latencyMs,
          error: 'Connection timed out (7s). Ensure server is online and port is forwarded.',
        };
      }

      return {
        success: false,
        latencyMs,
        error: err?.message || 'Unable to connect to host. Check URL or SSL certificate.',
      };
    }
  }

  /**
   * Subscribe to server changes
   */
  public subscribe(listener: ServerChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(newUrl: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(newUrl);
      } catch (e) {
        console.warn('[ServerConfigService] Listener notification error:', e);
      }
    });
  }
}

export const serverConfigService = ServerConfigService.getInstance();
