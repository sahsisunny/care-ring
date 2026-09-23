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

export interface QuickPreset {
  id: string;
  text: string;
  icon: string;
}

export const QUICK_PRESETS: QuickPreset[] = [
  { id: '1', text: 'Good morning! ☀️', icon: 'sunny-outline' },
  { id: '2', text: 'Call me 📞', icon: 'call-outline' },
  { id: '3', text: 'On my way! 🚗', icon: 'car-outline' },
  { id: '4', text: 'Where are you? 📍', icon: 'location-outline' },
  { id: '5', text: 'Reached safely! ✅', icon: 'checkmark-circle-outline' },
  { id: '6', text: 'Love you! ❤️', icon: 'heart-outline' },
  { id: '7', text: 'Low battery 🔋', icon: 'battery-charging-outline' },
  { id: '8', text: 'Picking up groceries 🛒', icon: 'basket-outline' },
];
