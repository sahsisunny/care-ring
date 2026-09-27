export interface ChatMessage {
  id: string;
  circleId: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  messageType: 'text' | 'preset' | 'location';
  createdAt: string;
}

export interface DirectChatMessage {
  id: string;
  circleId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  recipientId: string;
  content: string;
  messageType: 'text' | 'preset' | 'location';
  createdAt: string;
}

export interface TypingEvent {
  circleId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface DirectTypingEvent {
  circleId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  isTyping: boolean;
}

export type PresetCategory =
  | 'all'
  | 'battery'
  | 'driving'
  | 'movement'
  | 'work'
  | 'family'
  | 'emergency';

export interface QuickPreset {
  id: string;
  text: string;
  icon: string;
  category: PresetCategory;
  situationTag?: string; // e.g. "Low Battery", "Driving", "Charging", "Late Night", "Morning"
}

export interface UserSituationalContext {
  batteryLevel?: number;
  isCharging?: boolean;
  speed?: number;
  movementState?: 'stationary' | 'walking' | 'driving';
  currentHour?: number;
}

export const PRESET_CATEGORY_TABS: { id: PresetCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'battery', label: 'Battery', icon: 'battery-charging-outline' },
  { id: 'driving', label: 'Driving', icon: 'car-outline' },
  { id: 'movement', label: 'Places', icon: 'location-outline' },
  { id: 'work', label: 'Work/Busy', icon: 'briefcase-outline' },
  { id: 'family', label: 'Family', icon: 'heart-outline' },
  { id: 'emergency', label: 'Urgent', icon: 'warning-outline' },
];

export const QUICK_PRESETS: QuickPreset[] = [
  // --- Battery & Power Presets ---
  { id: 'bat_1', text: 'Low battery, might switch off soon! 🪫', icon: 'battery-dead-outline', category: 'battery', situationTag: 'Low Battery' },
  { id: 'bat_2', text: 'Phone is charging now ⚡', icon: 'battery-charging-outline', category: 'battery', situationTag: 'Charging' },
  { id: 'bat_3', text: 'Battery at 10%, please text only 🔌', icon: 'battery-dead-outline', category: 'battery', situationTag: 'Low Battery' },
  { id: 'bat_4', text: 'Low battery, will call once home 🔋', icon: 'battery-half-outline', category: 'battery', situationTag: 'Low Battery' },
  { id: 'bat_5', text: 'Forgot my charger, saving power 📵', icon: 'flash-off-outline', category: 'battery', situationTag: 'Low Battery' },

  // --- Driving & Transit Presets ---
  { id: 'drv_1', text: 'Driving right now, will reply soon! 🚗', icon: 'car-outline', category: 'driving', situationTag: 'Driving' },
  { id: 'drv_2', text: 'Stuck in heavy traffic 🚦', icon: 'timer-outline', category: 'driving', situationTag: 'Driving' },
  { id: 'drv_3', text: 'On highway, ETA ~15 minutes 🛣️', icon: 'navigate-outline', category: 'driving', situationTag: 'Driving' },
  { id: 'drv_4', text: 'Connected to car Bluetooth, call me! 🎧', icon: 'headset-outline', category: 'driving', situationTag: 'Driving' },
  { id: 'drv_5', text: 'Stopped at red light, almost there 🚥', icon: 'car-sport-outline', category: 'driving', situationTag: 'Driving' },
  { id: 'drv_6', text: 'Filling gas at petrol pump ⛽', icon: 'speedometer-outline', category: 'driving', situationTag: 'Driving' },

  // --- Movement, Arrival & Departures ---
  { id: 'mov_1', text: 'Reached safely! ✅', icon: 'checkmark-circle-outline', category: 'movement', situationTag: 'Arrived' },
  { id: 'mov_2', text: 'On my way! 🚗', icon: 'car-outline', category: 'movement', situationTag: 'Departing' },
  { id: 'mov_3', text: 'Leaving in 5 minutes 🏃', icon: 'walk-outline', category: 'movement', situationTag: 'Departing' },
  { id: 'mov_4', text: 'Arrived home safely 🏡', icon: 'home-outline', category: 'movement', situationTag: 'Home' },
  { id: 'mov_5', text: 'Where are you right now? 📍', icon: 'location-outline', category: 'movement' },
  { id: 'mov_6', text: 'Just parked outside 🅿️', icon: 'pin-outline', category: 'movement' },
  { id: 'mov_7', text: 'Reached home for the night! 🌙', icon: 'moon-outline', category: 'movement', situationTag: 'Night' },

  // --- Work, School & Busy ---
  { id: 'wrk_1', text: 'In a meeting right now, please text 🤫', icon: 'volume-mute-outline', category: 'work', situationTag: 'Busy' },
  { id: 'wrk_2', text: 'At office / work now 💼', icon: 'briefcase-outline', category: 'work' },
  { id: 'wrk_3', text: 'In class / lecture, silent mode 📚', icon: 'book-outline', category: 'work' },
  { id: 'wrk_4', text: 'Wrapping up work, heading out soon ⏰', icon: 'time-outline', category: 'work' },
  { id: 'wrk_5', text: 'At the doctor / clinic 🏥', icon: 'medkit-outline', category: 'work' },

  // --- Family, Home & Care ---
  { id: 'fam_1', text: 'Please call me when you are free 📞', icon: 'call-outline', category: 'family' },
  { id: 'fam_2', text: 'Love you! ❤️', icon: 'heart-outline', category: 'family' },
  { id: 'fam_3', text: 'Picking up groceries, need anything? 🛒', icon: 'basket-outline', category: 'family' },
  { id: 'fam_4', text: 'Ordering food, what would you like? 🍕', icon: 'restaurant-outline', category: 'family' },
  { id: 'fam_5', text: 'Good morning family! ☀️', icon: 'sunny-outline', category: 'family', situationTag: 'Morning' },
  { id: 'fam_6', text: 'Package arrived at our door 📦', icon: 'cube-outline', category: 'family' },
  { id: 'fam_7', text: 'Have dinner without me, running late 🍽️', icon: 'fast-food-outline', category: 'family' },

  // --- Urgent & Safety Check-in ---
  { id: 'urg_1', text: 'Please check in, haven’t heard from you! ⚠️', icon: 'alert-circle-outline', category: 'emergency', situationTag: 'Urgent' },
  { id: 'urg_2', text: 'Need urgent help, please call immediately 🚨', icon: 'warning-outline', category: 'emergency', situationTag: 'Urgent' },
  { id: 'urg_3', text: 'Car trouble / flat tire on side of road 🔧', icon: 'build-outline', category: 'emergency', situationTag: 'Car Trouble' },
  { id: 'urg_4', text: 'Everything is fine here, false alarm 👍', icon: 'shield-checkmark-outline', category: 'emergency' },
];

/**
 * Evaluates live telemetry state and returns situational presets prioritised for the user's current context
 */
export function getSmartSituationalPresets(
  context?: UserSituationalContext,
  categoryFilter: PresetCategory = 'all'
): {
  presets: QuickPreset[];
  activeSituationTag: string | null;
  recommendedCategory: PresetCategory;
} {
  const battery = context?.batteryLevel;
  const isCharging = context?.isCharging;
  const speed = context?.speed ?? 0;
  const movementState = context?.movementState;
  const hour = context?.currentHour ?? new Date().getHours();

  let activeSituationTag: string | null = null;
  let recommendedCategory: PresetCategory = 'all';

  // 1. Detect prominent situational context
  if (battery !== undefined && battery <= 20 && !isCharging) {
    activeSituationTag = `🪫 Low Battery (${battery}%)`;
    recommendedCategory = 'battery';
  } else if (isCharging) {
    activeSituationTag = `⚡ Charging (${battery ?? 0}%)`;
    recommendedCategory = 'battery';
  } else if (speed > 15 || movementState === 'driving') {
    activeSituationTag = `🚗 Driving (${Math.round(speed)} km/h)`;
    recommendedCategory = 'driving';
  } else if (movementState === 'stationary' && (hour >= 21 || hour < 5)) {
    activeSituationTag = '🌙 Late Night';
    recommendedCategory = 'movement';
  } else if (hour >= 5 && hour < 11) {
    activeSituationTag = '☀️ Morning';
    recommendedCategory = 'family';
  } else if (movementState === 'stationary') {
    activeSituationTag = '📍 Stationary';
    recommendedCategory = 'movement';
  }

  // 2. Filter by user-selected category tab (or recommend situational tab)
  let pool = QUICK_PRESETS;
  if (categoryFilter !== 'all') {
    pool = pool.filter((p) => p.category === categoryFilter);
  }

  // 3. Sort so that presets directly matching the current situation appear first
  const sorted = [...pool].sort((a, b) => {
    const aMatch =
      (recommendedCategory === a.category ? 2 : 0) +
      (activeSituationTag && a.situationTag && activeSituationTag.toLowerCase().includes(a.situationTag.toLowerCase()) ? 3 : 0);
    const bMatch =
      (recommendedCategory === b.category ? 2 : 0) +
      (activeSituationTag && b.situationTag && activeSituationTag.toLowerCase().includes(b.situationTag.toLowerCase()) ? 3 : 0);
    return bMatch - aMatch;
  });

  return {
    presets: sorted,
    activeSituationTag,
    recommendedCategory,
  };
}
