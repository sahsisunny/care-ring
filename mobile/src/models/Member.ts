export interface MemberData {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  role: string;
  latitude: number;
  longitude: number;
  speed: number; // km/h
  heading: number; // degrees 0-360
  batteryLevel: number; // 0-100
  isCharging: boolean;
  resolvedAddress?: string | null;
  lastOnlineAt: Date;
  lastLocationTime?: Date | null;
  stationarySince?: Date | null;
  isStationary: boolean;
  isMoving: boolean;
  isOnline: boolean;
}

export function isMemberMoving(member: { speed?: number; isStationary?: boolean }): boolean {
  return (member.speed || 0) > 3.0 && !member.isStationary;
}

export function parseMember(json: Record<string, any>): MemberData {
  const parseDate = (val: any): Date | null => {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const lastOnline = parseDate(json.last_online_at || json.lastOnlineAt) || new Date();
  const diffMinutes = (Date.now() - lastOnline.getTime()) / (1000 * 60);

  const speed = typeof json.speed === 'number' ? json.speed : 0;
  const isStationary = json.is_stationary !== undefined ? Boolean(json.is_stationary) : (speed < 3.0);

  return {
    id: String(json.id),
    fullName: String(json.full_name || json.fullName || json.name || 'Family Member'),
    avatarUrl: json.avatar_url || json.avatarUrl || null,
    phone: json.phone || null,
    role: String(json.role || 'member'),
    latitude: typeof json.latitude === 'number' ? json.latitude : (typeof json.last_latitude === 'number' ? json.last_latitude : null as any),
    longitude: typeof json.longitude === 'number' ? json.longitude : (typeof json.last_longitude === 'number' ? json.last_longitude : null as any),
    speed,
    heading: typeof json.heading === 'number' ? json.heading : 0,
    batteryLevel: typeof json.battery_level === 'number' ? json.battery_level : (typeof json.batteryLevel === 'number' ? json.batteryLevel : 100),
    isCharging: Boolean(json.is_charging ?? json.isCharging ?? false),
    resolvedAddress: json.resolved_address || json.resolvedAddress || null,
    lastOnlineAt: lastOnline,
    lastLocationTime: parseDate(json.last_location_time || json.lastLocationTime),
    stationarySince: parseDate(json.stationary_since || json.stationarySince),
    isStationary,
    isMoving: speed > 3.0 && !isStationary,
    isOnline: diffMinutes < 15,
  };
}

export function getMemberInitials(name: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

export function formatSinceTime(member: MemberData): string {
  if (member.speed > 3.0 && !member.isStationary) {
    return `Moving • ${Math.round(member.speed)} km/h`;
  }

  const sinceTime = member.stationarySince || member.lastLocationTime || member.lastOnlineAt || new Date();
  const now = Date.now();
  const diffMs = now - sinceTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Time format e.g. 10:15 AM
  const timeStr = sinceTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffMinutes < 1) {
    return 'Just arrived';
  } else if (diffMinutes < 60) {
    return `Since ${timeStr} (${diffMinutes}m)`;
  } else if (diffHours < 24) {
    const remMins = diffMinutes % 60;
    const durStr = remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`;
    return `Since ${timeStr} (${durStr})`;
  } else {
    return `Since ${diffDays}d ago`;
  }
}
