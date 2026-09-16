class Circle {
  final String id;
  final String name;
  final String inviteCode;
  final int memberCount;

  Circle({
    required this.id,
    required this.name,
    required this.inviteCode,
    this.memberCount = 1,
  });

  factory Circle.fromJson(Map<String, dynamic> json) {
    return Circle(
      id: json['id'] as String,
      name: json['name'] as String,
      inviteCode: json['invite_code'] as String,
      memberCount: json['member_count'] as int? ?? 1,
    );
  }
}

class GeofencePlace {
  final String id;
  final String name;
  final String category;
  final double latitude;
  final double longitude;
  final double radiusMeters;
  final bool notifyOnEnter;
  final bool notifyOnExit;

  GeofencePlace({
    required this.id,
    required this.name,
    this.category = 'other',
    required this.latitude,
    required this.longitude,
    this.radiusMeters = 200.0,
    this.notifyOnEnter = true,
    this.notifyOnExit = true,
  });

  factory GeofencePlace.fromJson(Map<String, dynamic> json) {
    return GeofencePlace(
      id: json['id'] as String,
      name: json['name'] as String,
      category: json['category'] as String? ?? 'other',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      radiusMeters: (json['radius_meters'] as num?)?.toDouble() ?? 200.0,
      notifyOnEnter: json['notify_on_enter'] as bool? ?? true,
      notifyOnExit: json['notify_on_exit'] as bool? ?? true,
    );
  }
}

class TelemetryPing {
  final String userId;
  final String circleId;
  final double latitude;
  final double longitude;
  final double speed;
  final double heading;
  final int batteryLevel;
  final bool isCharging;
  final int timestamp;

  TelemetryPing({
    required this.userId,
    required this.circleId,
    required this.latitude,
    required this.longitude,
    required this.speed,
    required this.heading,
    required this.batteryLevel,
    required this.isCharging,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': 'TELEMETRY_PING',
      'userId': userId,
      'circleId': circleId,
      'latitude': latitude,
      'longitude': longitude,
      'speed': speed,
      'heading': heading,
      'batteryLevel': batteryLevel,
      'isCharging': isCharging,
      'timestamp': timestamp,
    };
  }
}
