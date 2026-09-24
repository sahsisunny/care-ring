export const Colors = {
  // Life360 Signature Purple Brand Palette
  primary: '#744BE4',
  primaryDark: '#5E35B1',
  primaryLight: '#F3E8FF',
  primarySoft: '#EDE9FE',
  primaryBorder: '#DDD6FE',

  // Status & Dynamics
  moving: '#10B981',
  movingDark: '#059669',
  movingLight: '#ECFDF5',
  stationary: '#744BE4',
  offline: '#94A3B8',

  // Emergency / SOS
  sos: '#EF4444',
  sosDark: '#DC2626',
  sosLight: '#FEF2F2',
  sosBorder: '#FCA5A5',

  // Driving Report Colors (Matching Screenshot IMG_3922)
  speeding: '#FF6B6B',
  distracted: '#06B6D4',
  rapidAccel: '#EC4899',
  hardBraking: '#F59E0B',

  // Battery Levels
  batteryHigh: '#22C55E',
  batteryMed: '#F59E0B',
  batteryLow: '#EF4444',
  batteryCharging: '#06B6D4',

  // Neutrals & Cards
  background: '#F8FAFC',
  card: '#FFFFFF',
  cardBorder: '#E2E8F0',
  textMain: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  divider: '#E2E8F0',

  // Overlays & Glass
  glassWhite: 'rgba(255, 255, 255, 0.95)',
  glassDark: 'rgba(15, 23, 42, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.7)',
  overlay: 'rgba(15, 23, 42, 0.45)',

  // Badges & Accents
  amberBadgeBg: '#FEF3C7',
  amberBadgeText: '#B45309',
  blueBadgeBg: '#DBEAFE',
  blueBadgeText: '#1E40AF',
};

// Initial Avatar Deterministic Vibrant Colors
export const AVATAR_COLORS = [
  '#7C3AED', // Violet
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#D97706', // Amber
  '#E11D48', // Rose
  '#059669', // Emerald
  '#4F46E5', // Indigo
  '#DB2777', // Pink
];

export function getAvatarColor(name: string): string {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}
