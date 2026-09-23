export interface TimelineItem {
  id: string;
  type: 'stay' | 'trip';
  title: string;
  address: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  speed?: number;
  batteryLevel?: number | null;
}

export interface MemberTimelineData {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  date: string;
  timeline: TimelineItem[];
}
