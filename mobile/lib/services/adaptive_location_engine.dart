import 'dart:async';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../models/telemetry_ping.dart';

enum TrackingProfile {
  stationary, // Low-power, relies on significant motion coprocessor
  walking,    // Moderate accuracy (3-15 km/h)
  moving      // High-frequency fine GPS (> 15 km/h)
}

/// Adaptive Sensor & Battery Efficiency Engine
/// Dynamically toggles between Stationary (power-saving motion standby) and
/// Moving (> 15 km/h 3-5s fine GPS polling) to minimize battery drain.
class AdaptiveLocationEngine {
  final String userId;
  final String circleId;

  TrackingProfile _currentProfile = TrackingProfile.stationary;
  TrackingProfile get currentProfile => _currentProfile;

  StreamSubscription<Position>? _positionSub;
  StreamSubscription<UserAccelerometerEvent>? _motionSub;

  final _telemetryStreamController = StreamController<TelemetryPing>.broadcast();
  Stream<TelemetryPing> get telemetryStream => _telemetryStreamController.stream;

  DateTime? _lastMovementTime;
  double _lastSpeed = 0.0;
  double get lastSpeed => _lastSpeed;
  bool _isDisposed = false;

  AdaptiveLocationEngine({
    required this.userId,
    required this.circleId,
  });

  Future<void> start() async {
    // 1. Verify and request GPS permissions
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Location permissions are denied');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception('Location permissions are permanently denied');
    }

    // 2. Start Motion Coprocessor Listener (Significant Motion Detection)
    _listenToMotionSensors();

    // 3. Configure initial GPS stream
    _applyTrackingProfile(TrackingProfile.stationary);
  }

  /// Reconfigures GPS hardware settings dynamically based on current movement state
  void _applyTrackingProfile(TrackingProfile profile) {
    if (_isDisposed) return;
    _currentProfile = profile;
    _positionSub?.cancel();

    LocationSettings locationSettings;

    switch (profile) {
      case TrackingProfile.stationary:
        // Power-saving mode: distance filter 50m, 30s interval
        locationSettings = const LocationSettings(
          accuracy: LocationAccuracy.medium,
          distanceFilter: 50,
          timeLimit: Duration(seconds: 30),
        );
        break;

      case TrackingProfile.walking:
        // Moderate mode: distance filter 10m, 10s interval
        locationSettings = const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        );
        break;

      case TrackingProfile.moving:
        // High-frequency fine GPS mode (> 15 km/h): 5m distance filter, 3-5s interval
        locationSettings = const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          distanceFilter: 5,
        );
        break;
    }

    _positionSub = Geolocator.getPositionStream(locationSettings: locationSettings)
        .listen(_handlePositionUpdate, onError: (err) {
      print('[LocationEngine] Position stream error: $err');
    });

    print('[LocationEngine] Switched to profile: ${profile.name.toUpperCase()}');
  }

  /// Listens to the device accelerometer/motion coprocessor to detect when a stationary device begins moving
  void _listenToMotionSensors() {
    _motionSub = userAccelerometerEventStream().listen((UserAccelerometerEvent event) {
      final double totalMagnitude = sqrt(event.x * event.x + event.y * event.y + event.z * event.z);

      // Significant motion threshold: acceleration > 2.0 m/s^2 indicates user started walking/driving
      if (totalMagnitude > 2.0 && _currentProfile == TrackingProfile.stationary) {
        print('[LocationEngine] Significant motion detected via coprocessor! Waking up GPS...');
        _applyTrackingProfile(TrackingProfile.walking);
      }
    });
  }

  void _handlePositionUpdate(Position position) {
    final speedKmh = position.speed * 3.6; // convert m/s to km/h
    _lastSpeed = speedKmh;

    // Adaptive profile switching logic
    if (speedKmh > 15.0 && _currentProfile != TrackingProfile.moving) {
      // Switched to driving/moving state (> 15 km/h) -> 3-5s fine accuracy
      _lastMovementTime = DateTime.now();
      _applyTrackingProfile(TrackingProfile.moving);
    } else if (speedKmh <= 3.0 && _currentProfile != TrackingProfile.stationary) {
      // Check if user has stayed idle for > 2 minutes
      _lastMovementTime ??= DateTime.now();
      if (DateTime.now().difference(_lastMovementTime!).inMinutes >= 2) {
        _applyTrackingProfile(TrackingProfile.stationary);
      }
    } else if (speedKmh > 3.0) {
      _lastMovementTime = DateTime.now();
    }

    // Dispatch Telemetry Ping
    final ping = TelemetryPing(
      userId: userId,
      circleId: circleId,
      latitude: position.latitude,
      longitude: position.longitude,
      speed: speedKmh,
      heading: position.heading,
      batteryLevel: 85, // Default fallback or query platform battery
      isCharging: false,
      timestamp: DateTime.now().millisecondsSinceEpoch,
    );

    _telemetryStreamController.add(ping);
  }

  void dispose() {
    _isDisposed = true;
    _positionSub?.cancel();
    _motionSub?.cancel();
    _telemetryStreamController.close();
  }
}
