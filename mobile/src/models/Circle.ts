export interface Circle {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  role: string;
  circleType?: 'family' | 'friends' | 'trip' | 'work' | 'custom' | string;
  badgeEmoji?: string;
  imageUrl?: string | null;
  distanceUnit?: 'km' | 'miles';
  initials?: string;
  color?: string;
  invitePolicy?: 'all' | 'admins_only' | string;
  bubblesAllowed?: boolean;
  createdAt?: string;
}

export function parseCircle(json: Record<string, any>): Circle {
  return {
    id: String(json.id),
    name: String(json.name || 'Family Circle'),
    inviteCode: String(json.invite_code || json.inviteCode || 'FAM-0000'),
    memberCount: Number(json.member_count ?? json.memberCount ?? 1),
    role: String(json.role || 'member'),
    circleType: json.circle_type || json.circleType || 'family',
    badgeEmoji: json.badge_emoji || json.badgeEmoji || '👨‍👩‍👧‍👦',
    imageUrl: json.image_url || json.imageUrl || null,
    distanceUnit: json.distance_unit || json.distanceUnit || 'km',
    initials: json.initials || undefined,
    color: json.color || undefined,
    invitePolicy: json.invite_policy || json.invitePolicy || 'all',
    bubblesAllowed: json.bubbles_allowed !== undefined ? Boolean(json.bubbles_allowed) : (json.bubblesAllowed !== undefined ? Boolean(json.bubblesAllowed) : true),
    createdAt: json.created_at || json.createdAt,
  };
}
