export type MapStyleId = 'detailedOsm' | 'careRingMinimal' | 'cleanLight' | 'darkMinimal';

export interface MapStyleConfig {
  id: MapStyleId;
  name: string;
  description: string;
  urlTemplate: string;
  subdomains: string[];
  isMinimal: boolean;
}

export const MAP_STYLES: Record<string, MapStyleConfig> = {
  detailedOsm: {
    id: 'detailedOsm',
    name: 'Detailed Civic',
    description: 'Full OpenStreetMap with civic buildings, landmarks, and street amenities',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    isMinimal: false,
  },
};

// Fallbacks pointing legacy map style keys to Detailed Civic
MAP_STYLES.careRingMinimal = MAP_STYLES.detailedOsm;
MAP_STYLES.cleanLight = MAP_STYLES.detailedOsm;
MAP_STYLES.darkMinimal = MAP_STYLES.detailedOsm;

export const ALL_MAP_STYLES: MapStyleConfig[] = [MAP_STYLES.detailedOsm];
