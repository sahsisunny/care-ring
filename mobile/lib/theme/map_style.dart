/// Clean custom map style JSON that eliminates POI clutter, business icons,
/// and intrusive labels, creating a pristine canvas for real-time member markers.
const String cleanLife360MapStyle = '''
[
  {
    "featureType": "administrative",
    "elementType": "geometry",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "administrative.neighborhood",
    "stylers": [
      { "visibility": "on" }
    ]
  },
  {
    "featureType": "poi",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [
      { "color": "#d8ebd8" },
      { "visibility": "on" }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      { "color": "#ffffff" }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.icon",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "geometry",
    "stylers": [
      { "color": "#f8f8f8" }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      { "color": "#f0ede6" }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels",
    "stylers": [
      { "visibility": "simplified" }
    ]
  },
  {
    "featureType": "transit",
    "stylers": [
      { "visibility": "off" }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      { "color": "#cce4f7" }
    ]
  }
]
''';
