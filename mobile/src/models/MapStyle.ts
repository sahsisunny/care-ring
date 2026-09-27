export type MapStyleId =
  | 'detailedOsm'
  | 'satellite'
  | 'topographic'
  | 'streetMap'
  | 'cyclosm'
  | 'humanitarian'
  | 'careRingMinimal'
  | 'cleanLight'
  | 'darkMinimal';

export interface MapStyleConfig {
  id: MapStyleId;
  name: string;
  badge?: string;
  description: string;
  urlTemplate: string;
  subdomains: string[];
  isMinimal: boolean;
  maxZoom?: number;
}

export const MAP_STYLES: Record<string, MapStyleConfig> = {
  detailedOsm: {
    id: 'detailedOsm',
    name: 'Detailed Civic',
    description: 'Official OpenStreetMap standard with civic buildings, landmarks, and street amenities.',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    isMinimal: false,
    maxZoom: 19,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite Imagery',
    description: 'High-resolution global satellite and aerial photography from Esri World Imagery.',
    urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: [],
    isMinimal: false,
    maxZoom: 19,
  },
  topographic: {
    id: 'topographic',
    name: 'Topographic Terrain',
    description: 'Topographic elevation contours, mountain reliefs, and hiking trails from OpenTopoMap.',
    urlTemplate: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    isMinimal: false,
    maxZoom: 17,
  },
  streetMap: {
    id: 'streetMap',
    name: 'Clean Street View',
    description: 'High-contrast clean road network, highways, and urban topography from Esri Streets.',
    urlTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    subdomains: [],
    isMinimal: false,
    maxZoom: 19,
  },
  cyclosm: {
    id: 'cyclosm',
    name: 'Outdoor & Trails',
    description: 'Dedicated bicycle lanes, pedestrian walking paths, and green park facilities from CyclOSM.',
    urlTemplate: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    isMinimal: false,
    maxZoom: 18,
  },
  humanitarian: {
    id: 'humanitarian',
    name: 'Humanitarian Map',
    description: 'High-visibility road map optimized for community infrastructure and safety from OSM France.',
    urlTemplate: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    isMinimal: false,
    maxZoom: 19,
  },
};

// Fallbacks pointing legacy map style keys to modern equivalents
MAP_STYLES.careRingMinimal = MAP_STYLES.detailedOsm;
MAP_STYLES.cleanLight = MAP_STYLES.streetMap;
MAP_STYLES.darkMinimal = MAP_STYLES.satellite;

export const ALL_MAP_STYLES: MapStyleConfig[] = [
  MAP_STYLES.detailedOsm,
  MAP_STYLES.satellite,
  MAP_STYLES.topographic,
  MAP_STYLES.streetMap,
  MAP_STYLES.cyclosm,
  MAP_STYLES.humanitarian,
];
