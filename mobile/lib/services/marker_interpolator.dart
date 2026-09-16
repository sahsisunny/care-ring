import 'package:flutter/animation.dart';
import 'package:latlong2/latlong.dart';

/// Function signature for interpolation frame updates
typedef OnInterpolationUpdate = void Function(
  String memberId,
  LatLng interpolatedPosition,
  double interpolatedHeading,
);

/// Smooth coordinate and rotation interpolator between incoming GPS pings.
/// Eliminates marker jitter and teleports by driving high-frequency tween animations.
class MarkerInterpolator {
  final TickerProvider vsync;
  final OnInterpolationUpdate onUpdate;

  // Active animation controllers per member
  final Map<String, AnimationController> _controllers = {};
  final Map<String, LatLng> _currentPositions = {};
  final Map<String, double> _currentHeadings = {};

  MarkerInterpolator({
    required this.vsync,
    required this.onUpdate,
  });

  /// Ingests a new raw GPS ping for a member and initiates a smooth tween animation
  void updateTarget({
    required String memberId,
    required LatLng newPosition,
    required double newHeading,
    Duration duration = const Duration(milliseconds: 1500),
  }) {
    final startPosition = _currentPositions[memberId] ?? newPosition;
    final startHeading = _currentHeadings[memberId] ?? newHeading;

    // If first ping or distance is negligible, set directly without animation
    if (!_currentPositions.containsKey(memberId)) {
      _currentPositions[memberId] = newPosition;
      _currentHeadings[memberId] = newHeading;
      onUpdate(memberId, newPosition, newHeading);
      return;
    }

    // Stop existing running animation for this member
    _controllers[memberId]?.stop();
    _controllers[memberId]?.dispose();

    final controller = AnimationController(
      vsync: vsync,
      duration: duration,
    );

    // Calculate shortest angular delta for heading
    double deltaHeading = (newHeading - startHeading) % 360.0;
    if (deltaHeading > 180.0) deltaHeading -= 360.0;
    if (deltaHeading < -180.0) deltaHeading += 360.0;
    final targetAdjustedHeading = startHeading + deltaHeading;

    final curvedAnimation = CurvedAnimation(
      parent: controller,
      curve: Curves.easeOutCubic,
    );

    controller.addListener(() {
      final t = curvedAnimation.value;

      // Latitude and Longitude linear interpolation
      final lat = _lerpDouble(startPosition.latitude, newPosition.latitude, t);
      final lng = _lerpDouble(startPosition.longitude, newPosition.longitude, t);
      final heading = (_lerpDouble(startHeading, targetAdjustedHeading, t)) % 360.0;

      final current = LatLng(lat, lng);
      _currentPositions[memberId] = current;
      _currentHeadings[memberId] = heading;

      onUpdate(memberId, current, heading);
    });

    controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _controllers.remove(memberId);
        controller.dispose();
      }
    });

    _controllers[memberId] = controller;
    controller.forward();
  }

  LatLng? getCurrentPosition(String memberId) => _currentPositions[memberId];
  double? getCurrentHeading(String memberId) => _currentHeadings[memberId];

  double _lerpDouble(double a, double b, double t) {
    return a + (b - a) * t;
  }

  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
  }
}
