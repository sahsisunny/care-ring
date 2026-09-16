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
  final double? accuracy;
  final double? altitude;

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
    this.accuracy,
    this.altitude,
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
      if (accuracy != null) 'accuracy': accuracy,
      if (altitude != null) 'altitude': altitude,
    };
  }

  factory TelemetryPing.fromJson(Map<String, dynamic> json) {
    return TelemetryPing(
      userId: json['userId'] as String,
      circleId: json['circleId'] as String,
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      speed: (json['speed'] as num?)?.toDouble() ?? 0.0,
      heading: (json['heading'] as num?)?.toDouble() ?? 0.0,
      batteryLevel: (json['batteryLevel'] as num?)?.toInt() ?? 100,
      isCharging: (json['isCharging'] as bool?) ?? false,
      timestamp: (json['timestamp'] as num?)?.toInt() ?? DateTime.now().millisecondsSinceEpoch,
      accuracy: (json['accuracy'] as num?)?.toDouble(),
      altitude: (json['altitude'] as num?)?.toDouble(),
    );
  }
}
