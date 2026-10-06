import AsyncStorage from '@react-native-async-storage/async-storage';

type NicknameListener = (circleId: string, nicknames: Record<string, string>) => void;

export class NicknameService {
  private static listeners: Set<NicknameListener> = new Set();
  private static memoryCache: Record<string, Record<string, string>> = {};

  public static addListener(listener: NicknameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(circleId: string, nicknames: Record<string, string>): void {
    this.listeners.forEach((fn) => {
      try {
        fn(circleId, nicknames);
      } catch (_) {}
    });
  }

  private static getStorageKey(userId: string, circleId: string): string {
    return `@carering_nicknames_${userId}_${circleId}`;
  }

  /**
   * Load personal nicknames dictionary for a specific user and circle.
   * Returns a map of memberId -> personal nickname instantly from local cache.
   */
  public static async getNicknames(
    userId: string,
    circleId: string
  ): Promise<Record<string, string>> {
    if (!userId || !circleId) return {};
    const memKey = `${userId}_${circleId}`;
    if (this.memoryCache[memKey]) {
      return this.memoryCache[memKey];
    }
    try {
      const raw = await AsyncStorage.getItem(this.getStorageKey(userId, circleId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const res = typeof parsed === 'object' && parsed !== null ? parsed : {};
      this.memoryCache[memKey] = res;
      return res;
    } catch (err) {
      console.warn('[NicknameService] Error reading nicknames:', err);
      return {};
    }
  }

  /**
   * Fetch nicknames from backend database in background and reconcile with local cache.
   */
  public static async fetchNicknamesFromServer(
    userId: string,
    circleId: string,
    backendUrl: string
  ): Promise<Record<string, string>> {
    if (!userId || !circleId || !backendUrl) return {};
    try {
      const { authService } = require('./AuthService');
      const remote = await authService.fetchNicknames(backendUrl, circleId, userId);
      const memKey = `${userId}_${circleId}`;
      this.memoryCache[memKey] = remote;
      await AsyncStorage.setItem(
        this.getStorageKey(userId, circleId),
        JSON.stringify(remote)
      ).catch(() => {});
      this.notifyListeners(circleId, remote);
      return remote;
    } catch (err) {
      console.warn('[NicknameService] fetchNicknamesFromServer error:', err);
      return this.getNicknames(userId, circleId);
    }
  }

  /**
   * Apply real-time nickname update received via WebSocket or sync
   */
  public static async applyRemoteNickname(
    userId: string,
    circleId: string,
    memberId: string,
    nickname?: string
  ): Promise<Record<string, string>> {
    const current = await this.getNicknames(userId, circleId);
    if (nickname && nickname.trim()) {
      current[memberId] = nickname.trim();
    } else {
      delete current[memberId];
    }
    const memKey = `${userId}_${circleId}`;
    this.memoryCache[memKey] = current;
    await AsyncStorage.setItem(
      this.getStorageKey(userId, circleId),
      JSON.stringify(current)
    ).catch(() => {});
    this.notifyListeners(circleId, current);
    return current;
  }

  /**
   * Set or update a personal nickname for a circle member.
   * Cached locally for 0ms, persisted to database, and broadcast via WS.
   */
  public static async setNickname(
    userId: string,
    circleId: string,
    memberId: string,
    nickname: string,
    backendUrl?: string,
    wsClient?: any
  ): Promise<Record<string, string>> {
    if (!userId || !circleId || !memberId) return {};
    try {
      const current = await this.getNicknames(userId, circleId);
      const trimmed = nickname.trim();
      if (trimmed) {
        current[memberId] = trimmed;
      } else {
        delete current[memberId];
      }
      const memKey = `${userId}_${circleId}`;
      this.memoryCache[memKey] = current;

      // 1. Immediately cache locally (0ms)
      await AsyncStorage.setItem(
        this.getStorageKey(userId, circleId),
        JSON.stringify(current)
      );
      this.notifyListeners(circleId, current);

      // 2. Real-time delivery via WebSocket
      if (wsClient && typeof wsClient.updateNickname === 'function') {
        wsClient.updateNickname(memberId, trimmed);
      }

      // 3. Asynchronously persist to PostgreSQL
      if (backendUrl) {
        const { authService } = require('./AuthService');
        if (trimmed) {
          authService.saveNickname(backendUrl, circleId, memberId, trimmed, userId).catch(() => {});
        } else {
          authService.deleteNickname(backendUrl, circleId, memberId, userId).catch(() => {});
        }
      }

      return current;
    } catch (err) {
      console.warn('[NicknameService] Error saving nickname:', err);
      return {};
    }
  }

  /**
   * Remove a personal nickname for a circle member.
   */
  public static async removeNickname(
    userId: string,
    circleId: string,
    memberId: string,
    backendUrl?: string,
    wsClient?: any
  ): Promise<Record<string, string>> {
    return this.setNickname(userId, circleId, memberId, '', backendUrl, wsClient);
  }

  /**
   * Returns the effective display name for a member.
   * If a personal nickname is defined for this member, it returns the nickname.
   * Otherwise returns the member's public full name.
   */
  public static getEffectiveName(
    member: { id: string; fullName?: string; name?: string },
    nicknames: Record<string, string>
  ): string {
    if (!member) return '';
    const nickname = nicknames?.[member.id]?.trim();
    if (nickname) {
      return nickname;
    }
    return (member.fullName || (member as any).name || 'Member').trim();
  }

  /**
   * Returns display info with primary and secondary labels:
   * e.g. Primary: "Dad", Secondary: "Sunny Sahsi"
   * or if no nickname: Primary: "Sunny Sahsi", Secondary: null
   */
  public static getNameDisplay(
    member: { id: string; fullName?: string; name?: string },
    nicknames: Record<string, string>,
    isSelf: boolean = false
  ): { primary: string; secondary: string | null } {
    const rawPublicName = (member.fullName || (member as any).name || 'Member')
      .replace(/\s*\(You\)/gi, '')
      .trim();

    if (isSelf) {
      return { primary: `${rawPublicName} (You)`, secondary: null };
    }

    const nickname = nicknames?.[member.id]?.trim();
    if (nickname) {
      return {
        primary: nickname,
        secondary: rawPublicName,
      };
    }

    return {
      primary: rawPublicName,
      secondary: null,
    };
  }
}
