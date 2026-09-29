import AsyncStorage from '@react-native-async-storage/async-storage';

export class NicknameService {
  private static getStorageKey(userId: string, circleId: string): string {
    return `@carering_nicknames_${userId}_${circleId}`;
  }

  /**
   * Load personal nicknames dictionary for a specific user and circle.
   * Returns a map of memberId -> personal nickname.
   */
  public static async getNicknames(
    userId: string,
    circleId: string
  ): Promise<Record<string, string>> {
    if (!userId || !circleId) return {};
    try {
      const raw = await AsyncStorage.getItem(this.getStorageKey(userId, circleId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch (err) {
      console.warn('[NicknameService] Error reading nicknames:', err);
      return {};
    }
  }

  /**
   * Set or update a personal nickname for a circle member.
   * Private to the caller, never sent to the backend.
   */
  public static async setNickname(
    userId: string,
    circleId: string,
    memberId: string,
    nickname: string
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
      await AsyncStorage.setItem(
        this.getStorageKey(userId, circleId),
        JSON.stringify(current)
      );
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
    memberId: string
  ): Promise<Record<string, string>> {
    return this.setNickname(userId, circleId, memberId, '');
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
