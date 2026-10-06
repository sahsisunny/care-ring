import { getMovementActivity, MovementActivityInfo, MovementActivityType } from './MovementActivity';
import { isToday, isYesterday, isThisYear, formatLocalTime } from '../utils/dateUtils';

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
  joinedAt?: Date | null;
  createdAt?: Date | null;
  bubbleUntil?: Date | null;
  bubbleRadius?: number;
  inBubble?: boolean;
  activityType?: MovementActivityType;
  activityConfidence?: number;
  activityStartedAt?: Date | null;
  recentSafetyEvent?: string;
  safetySeverity?: string;
  safetyScore?: number;
}

export function isMemberMoving(member: { speed?: number; isStationary?: boolean; activityType?: string }): boolean {
  if (member.activityType) {
    const act = member.activityType.toLowerCase();
    if (act === 'stationary') return false;
    if (['walking', 'running', 'cycling', 'driving', 'riding', 'high_speed'].includes(act)) return true;
  }
  return (member.speed || 0) >= 1.8 && !member.isStationary;
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
  const isStationary = json.is_stationary !== undefined ? Boolean(json.is_stationary) : (speed < 1.8);
  const bubbleUntil = parseDate(json.bubble_until || json.bubbleUntil);
  const bubbleRadius = typeof json.bubble_radius === 'number'
    ? json.bubble_radius
    : (typeof json.bubbleRadius === 'number' ? json.bubbleRadius : 0);
  const inBubble = json.in_bubble !== undefined
    ? Boolean(json.in_bubble)
    : (json.inBubble !== undefined ? Boolean(json.inBubble) : Boolean(bubbleUntil && bubbleUntil.getTime() > Date.now()));

  const rawAct = json.activity_type || json.activityType || json.activity || json.last_activity;
  const activityType = rawAct ? String(rawAct).toLowerCase() as MovementActivityType : undefined;
  const activityConfidence = typeof json.activity_confidence === 'number'
    ? json.activity_confidence
    : (typeof json.activityConfidence === 'number' ? json.activityConfidence : undefined);
  const activityStartedAt = parseDate(json.activity_started_at || json.activityStartedAt);

  const isMoving = isMemberMoving({ speed, isStationary, activityType });

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
    isMoving,
    isOnline: json.is_online !== undefined
      ? Boolean(json.is_online)
      : (json.isOnline !== undefined ? Boolean(json.isOnline) : diffMinutes < 4),
    joinedAt: parseDate(json.joined_at || json.joinedAt),
    createdAt: parseDate(json.created_at || json.createdAt || json.user_created_at || json.userCreatedAt),
    bubbleUntil,
    bubbleRadius,
    inBubble,
    activityType,
    activityConfidence,
    activityStartedAt,
    recentSafetyEvent: json.recent_safety_event || json.recentSafetyEvent || undefined,
    safetySeverity: json.safety_severity || json.safetySeverity || undefined,
    safetyScore: typeof json.safety_score === 'number' ? json.safety_score : (typeof json.safetyScore === 'number' ? json.safetyScore : undefined),
  };
}

export function formatJoinedDate(date?: Date | string | null): string {
  if (!date) return 'Recently';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getMemberInitials(name: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

export function formatLastSeenTime(date?: Date | null): string {
  if (!date) return 'recently';
  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return 'just now';
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24 && isToday(date)) {
    return `${diffHours}h ago`;
  }
  const timeStr = formatLocalTime(date);
  if (isYesterday(date)) {
    return `Yesterday, ${timeStr}`;
  }
  const dateOptions: Intl.DateTimeFormatOptions = isThisYear(date)
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return `${date.toLocaleDateString([], dateOptions)}, ${timeStr}`;
}

export interface MemberPresenceInfo {
  isOnline: boolean;
  statusLabel: string;
  activitySubtitle: string;
  badgeColor: string;
  indicatorColor: string;
  activity?: MovementActivityInfo;
}

export function getMemberPresenceInfo(member: MemberData): MemberPresenceInfo {
  if (member.isOnline) {
    const isMoving = isMemberMoving(member);
    if (isMoving || (member.activityType && member.activityType !== 'stationary')) {
      const act = getMovementActivity(member.speed, member.isStationary, member.activityType);
      return {
        isOnline: true,
        statusLabel: act.label,
        activitySubtitle: member.speed > 0 ? `${act.label} • ${Math.round(member.speed)} km/h` : act.label,
        badgeColor: act.color,
        indicatorColor: act.color,
        activity: act,
      };
    }
    return {
      isOnline: true,
      statusLabel: 'Online',
      activitySubtitle: 'Active now',
      badgeColor: '#10B981',
      indicatorColor: '#10B981',
    };
  }

  const lastSeenStr = formatLastSeenTime(member.lastOnlineAt || member.lastLocationTime);
  return {
    isOnline: false,
    statusLabel: 'Offline',
    activitySubtitle: `Active ${lastSeenStr}`,
    badgeColor: '#94A3B8',
    indicatorColor: '#94A3B8',
  };
}

export function formatSinceTime(member: MemberData): string {
  const isMoving = isMemberMoving(member);
  if (isMoving || (member.activityType && member.activityType !== 'stationary')) {
    const act = getMovementActivity(member.speed, member.isStationary, member.activityType);
    return member.speed > 0 ? `${act.label} • ${Math.round(member.speed)} km/h` : act.label;
  }

  const sinceTime = member.stationarySince || member.lastLocationTime || member.lastOnlineAt || new Date();
  const now = Date.now();
  const diffMs = now - sinceTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Time format e.g. 10:15 AM in local device timezone
  const timeStr = formatLocalTime(sinceTime);

  if (diffMinutes < 1) {
    return 'Just arrived';
  } else if (diffMinutes < 60) {
    return `Since ${timeStr} (${diffMinutes}m)`;
  } else if (diffHours < 24 && isToday(sinceTime)) {
    const remMins = diffMinutes % 60;
    const durStr = remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`;
    return `Since ${timeStr} (${durStr})`;
  } else if (isYesterday(sinceTime)) {
    const remMins = diffMinutes % 60;
    const durStr = diffHours < 24
      ? (remMins > 0 ? `${diffHours}h ${remMins}m` : `${diffHours}h`)
      : `${Math.max(1, diffDays)}d`;
    return `Since Yesterday, ${timeStr} (${durStr})`;
  } else {
    const dateOptions: Intl.DateTimeFormatOptions = isThisYear(sinceTime)
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
    const dateStr = sinceTime.toLocaleDateString([], dateOptions);
    const durStr = `${Math.max(1, diffDays)}d`;
    return `Since ${dateStr}, ${timeStr} (${durStr})`;
  }
}


