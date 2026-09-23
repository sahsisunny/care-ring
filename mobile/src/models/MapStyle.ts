export type MapStyleId = 'careRingMinimal' | 'cleanLight' | 'darkMinimal' | 'detailedOsm';

export interface MapStyleConfig {
  id: MapStyleId;
  name: string;
  description: string;
  urlTemplate: string;
  subdomains: string[];
  isMinimal: boolean;
}

export const MAP_STYLES: Record<MapStyleId, MapStyleConfig> = {
  careRingMinimal: {
    id: 'careRingMinimal',
    name: 'CareRing Minimal',
    description: 'Clean roads & landforms, zero commercial POIs (fastest)',
    urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    isMinimal: true,
  },
  cleanLight: {
    id: 'cleanLight',
    name: 'Clean Light',
    description: 'High contrast monochrome map for maximum avatar clarity',
    urlTemplate: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    isMinimal: true,
  },
  darkMinimal: {
    id: 'darkMinimal',
    name: 'Night Dark',
    description: 'Battery-saving dark theme for nighttime tracking',
    urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c', 'd'],
    isMinimal: true,
  },
  detailedOsm: {
    id: 'detailedOsm',
    name: 'Detailed Civic',
    description: 'Full OpenStreetMap with civic buildings and street amenities',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    isMinimal: false,
  },
};

export const ALL_MAP_STYLES = Object.values(MAP_STYLES);
