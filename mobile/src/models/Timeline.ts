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
  // Enhanced Life360 & Google Maps timeline properties
  stopNumber?: number;
  coordinates?: Array<[number, number]>; // Polyline coordinates for this segment
  distanceKm?: number;
  topSpeed?: number;
  avgSpeed?: number;
  fromAddress?: string;
  toAddress?: string;
}

export interface MemberTimelineData {
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  date: string;
  totalDistanceKm?: number;
  totalMovingMinutes?: number;
  totalStayMinutes?: number;
  stopCount?: number;
  tripCount?: number;
  rawCoordinates?: Array<[number, number]>;
  timeline: TimelineItem[];
}
