class Member {
  final String id;
  final String fullName;
  final String? avatarUrl;
  double latitude;
  double longitude;
  double speed; // km/h
  double heading; // degrees
  int batteryLevel; // 0-100
  bool isCharging;
  String? resolvedAddress;
  DateTime lastOnlineAt;
  bool isOnline;

  Member({
    required this.id,
    required this.fullName,
    this.avatarUrl,
    required this.latitude,
    required this.longitude,
    this.speed = 0.0,
    this.heading = 0.0,
    this.batteryLevel = 100,
    this.isCharging = false,
    this.resolvedAddress,
    required this.lastOnlineAt,
    this.isOnline = true,
  });

  bool get isMoving => speed > 3.0;

  factory Member.fromJson(Map<String, dynamic> json) {
    return Member(
      id: json['id'] as String,
      fullName: (json['full_name'] ?? json['name'] ?? 'Family Member') as String,
      avatarUrl: json['avatar_url'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble() ?? 37.7749,
      longitude: (json['longitude'] as num?)?.toDouble() ?? -122.4194,
      speed: (json['speed'] as num?)?.toDouble() ?? 0.0,
      heading: (json['heading'] as num?)?.toDouble() ?? 0.0,
      batteryLevel: (json['battery_level'] as num?)?.toInt() ?? 100,
      isCharging: (json['is_charging'] as bool?) ?? false,
      resolvedAddress: json['resolved_address'] as String?,
      lastOnlineAt: json['last_online_at'] != null
          ? DateTime.tryParse(json['last_online_at']) ?? DateTime.now()
          : DateTime.now(),
      isOnline: json['last_online_at'] != null
          ? DateTime.now().difference(DateTime.parse(json['last_online_at'])).inMinutes < 15
          : true,
    );
  }

  Member copyWith({
    double? latitude,
    double? longitude,
    double? speed,
    double? heading,
    int? batteryLevel,
    bool? isCharging,
    String? resolvedAddress,
    DateTime? lastOnlineAt,
    bool? isOnline,
  }) {
    return Member(
      id: id,
      fullName: fullName,
      avatarUrl: avatarUrl,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      speed: speed ?? this.speed,
      heading: heading ?? this.heading,
      batteryLevel: batteryLevel ?? this.batteryLevel,
      isCharging: isCharging ?? this.isCharging,
      resolvedAddress: resolvedAddress ?? this.resolvedAddress,
      lastOnlineAt: lastOnlineAt ?? this.lastOnlineAt,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}
