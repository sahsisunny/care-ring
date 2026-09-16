import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Circle;
import '../models/circle.dart';
import '../models/member.dart';
import '../models/telemetry_ping.dart';
import '../services/marker_interpolator.dart';
import '../services/adaptive_location_engine.dart';
import '../services/websocket_client.dart';
import '../widgets/custom_map_marker.dart';
import '../widgets/top_floating_header.dart';
import '../widgets/bottom_draggable_sheet.dart';

class MapScreen extends StatefulWidget {
  final String currentUserId;
  final String backendWsUrl;

  const MapScreen({
    Key? key,
    required this.currentUserId,
    this.backendWsUrl = 'ws://10.0.2.2:4000',
  }) : super(key: key);

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  late MarkerInterpolator _interpolator;
  late AdaptiveLocationEngine _locationEngine;
  WebSocketClient? _wsClient;

  // Circle State
  final List<Circle> _circles = [
    Circle(id: 'circle-family-01', name: 'Family Circle', inviteCode: 'FAM-9988', memberCount: 3),
    Circle(id: 'circle-bikers-02', name: 'Biker Squad', inviteCode: 'BIKE-4411', memberCount: 5),
  ];
  late Circle _selectedCircle;

  // Members State
  final Map<String, Member> _membersMap = {};
  Member? _selectedMember;

  // Default initial viewport (San Francisco)
  final LatLng _initialCenter = const LatLng(37.7749, -122.4194);
  final double _initialZoom = 14.0;

  @override
  void initState() {
    super.initState();
    _selectedCircle = _circles.first;

    // 1. Initialize Marker Interpolator (eliminates GPS jitter via tweening)
    _interpolator = MarkerInterpolator(
      vsync: this,
      onUpdate: (memberId, pos, heading) {
        setState(() {}); // Repaint marker positions on animation ticks (60/120fps)
      },
    );

    // 2. Initialize Seed Members for instant visual demo
    _initializeSeedMembers();

    // 3. Initialize Adaptive Sensor & Battery Efficiency Engine
    _locationEngine = AdaptiveLocationEngine(
      userId: widget.currentUserId,
      circleId: _selectedCircle.id,
    );

    _locationEngine.telemetryStream.listen((TelemetryPing ping) {
      _wsClient?.sendTelemetry(ping);

      _interpolator.updateTarget(
        memberId: widget.currentUserId,
        newPosition: LatLng(ping.latitude, ping.longitude),
        newHeading: ping.heading,
      );
    });

    _locationEngine.start().catchError((e) {
      print('[MapScreen] Location engine start error: $e');
    });

    // 4. Initialize WebSocket Client
    _initWebSocket();
  }

  void _initializeSeedMembers() {
    final seed = [
      Member(
        id: 'user-01',
        fullName: 'Sarah',
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 42.0,
        batteryLevel: 88,
        isCharging: true,
        resolvedAddress: 'Lincoln High School',
        lastOnlineAt: DateTime.now().subtract(const Duration(minutes: 2)),
      ),
      Member(
        id: 'user-02',
        fullName: 'Noah',
        latitude: 37.7680,
        longitude: -122.4280,
        speed: 0.0,
        batteryLevel: 74,
        resolvedAddress: 'Home',
        lastOnlineAt: DateTime.now().subtract(const Duration(minutes: 4)),
      ),
      Member(
        id: 'user-03',
        fullName: 'Maya',
        latitude: 37.7580,
        longitude: -122.4120,
        speed: 12.0,
        batteryLevel: 61,
        resolvedAddress: 'Central Park',
        lastOnlineAt: DateTime.now().subtract(const Duration(minutes: 9)),
      ),
    ];

    for (final m in seed) {
      _membersMap[m.id] = m;
      _interpolator.updateTarget(
        memberId: m.id,
        newPosition: LatLng(m.latitude, m.longitude),
        newHeading: m.heading,
      );
    }
  }

  void _initWebSocket() {
    _wsClient = WebSocketClient(
      serverUrl: widget.backendWsUrl,
      circleId: _selectedCircle.id,
      userId: widget.currentUserId,
    );

    _wsClient!.onTelemetryReceived = (data) {
      final userId = data['userId'] as String;
      final lat = (data['latitude'] as num).toDouble();
      final lng = (data['longitude'] as num).toDouble();
      final speed = (data['speed'] as num).toDouble();
      final heading = (data['heading'] as num).toDouble();
      final battery = (data['batteryLevel'] as num).toInt();
      final isCharging = (data['isCharging'] as bool?) ?? false;
      final address = data['resolvedAddress'] as String?;

      setState(() {
        if (_membersMap.containsKey(userId)) {
          final existing = _membersMap[userId]!;
          existing.latitude = lat;
          existing.longitude = lng;
          existing.speed = speed;
          existing.heading = heading;
          existing.batteryLevel = battery;
          existing.isCharging = isCharging;
          if (address != null) existing.resolvedAddress = address;
          existing.lastOnlineAt = DateTime.now();
        } else {
          _membersMap[userId] = Member(
            id: userId,
            fullName: 'Member ${userId.substring(0, 4)}',
            latitude: lat,
            longitude: lng,
            speed: speed,
            heading: heading,
            batteryLevel: battery,
            isCharging: isCharging,
            resolvedAddress: address,
            lastOnlineAt: DateTime.now(),
          );
        }
      });

      // Drive smooth tween animation to new coordinates
      _interpolator.updateTarget(
        memberId: userId,
        newPosition: LatLng(lat, lng),
        newHeading: heading,
      );
    };

    _wsClient!.onGeofenceAlert = (alert) {
      final userName = alert['userName'] ?? 'Family member';
      final placeName = alert['placeName'] ?? 'Place';
      final event = alert['event'] == 'ENTER' ? 'arrived at' : 'left';

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF0F172A),
          content: Row(
            children: [
              const Icon(Icons.notifications_active, color: Color(0xFF38BDF8), size: 20),
              const SizedBox(width: 8),
              Expanded(child: Text('$userName has $event $placeName')),
            ],
          ),
        ),
      );
    };

    _wsClient!.onSOSAlert = (sos) {
      final userName = sos['userName'] ?? 'Member';
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFFFEF2F2),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.red, size: 28),
              SizedBox(width: 8),
              Text('EMERGENCY SOS', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            ],
          ),
          content: Text('$userName triggered an Emergency SOS! Check their location immediately.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('DISMISS'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () {
                Navigator.of(ctx).pop();
                final lat = (sos['latitude'] as num).toDouble();
                final lng = (sos['longitude'] as num).toDouble();
                _animateCameraTo(LatLng(lat, lng), zoom: 16.5);
              },
              child: const Text('TRACK NOW', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    };

    _wsClient!.onAddressResolved = (userId, address) {
      if (_membersMap.containsKey(userId)) {
        setState(() {
          _membersMap[userId]!.resolvedAddress = address;
        });
      }
    };

    _wsClient!.connect();
  }

  void _selectMember(Member member) {
    setState(() {
      _selectedMember = member;
    });
    final pos = _interpolator.getCurrentPosition(member.id) ?? LatLng(member.latitude, member.longitude);
    _animateCameraTo(pos, zoom: 16.5);
  }

  void _animateCameraTo(LatLng target, {double zoom = 15.5}) {
    _mapController.move(target, zoom);
  }

  /// Calculates LatLngBounds encompassing all active circle members with padding
  void _centerAllMembers() {
    if (_membersMap.isEmpty) return;

    final points = _membersMap.values.map((m) {
      return _interpolator.getCurrentPosition(m.id) ?? LatLng(m.latitude, m.longitude);
    }).toList();

    if (points.length == 1) {
      _animateCameraTo(points.first, zoom: 15.0);
      return;
    }

    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.symmetric(horizontal: 60, vertical: 140),
      ),
    );
  }

  void _triggerEmergencySOS() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Trigger Emergency SOS?'),
        content: const Text(
          'This will immediately alert all circle members with an audible siren and your live GPS coordinates.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () {
              Navigator.pop(ctx);
              final currentLat = _membersMap[widget.currentUserId]?.latitude ?? 37.7749;
              final currentLng = _membersMap[widget.currentUserId]?.longitude ?? -122.4194;
              _wsClient?.sendSOS(currentLat, currentLng);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  backgroundColor: Colors.red,
                  content: Text('🚨 Emergency SOS alert sent to your circle!'),
                ),
              );
            },
            child: const Text('SEND SOS', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _interpolator.dispose();
    _locationEngine.dispose();
    _wsClient?.dispose();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 1. BASE LAYER: Full-screen OpenStreetMap (Clean CartoDB Positron Tiles - Zero API Keys Needed!)
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _initialCenter,
              initialZoom: _initialZoom,
              minZoom: 3.0,
              maxZoom: 18.0,
            ),
            children: [
              // Standard OpenStreetMap tiles (100% free, full-color, zero API keys or watermarks)
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.life360.familylocation.life360_mobile',
              ),

              // Dynamic Avatar Markers with 60/120fps tween interpolation
              MarkerLayer(
                markers: _membersMap.values.map((member) {
                  final pos = _interpolator.getCurrentPosition(member.id) ??
                      LatLng(member.latitude, member.longitude);
                  return Marker(
                    point: pos,
                    width: 140,
                    height: 85,
                    alignment: Alignment.center,
                    child: FamilyMemberMarkerWidget(
                      member: member,
                      onTap: () => _selectMember(member),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),

          // 2. TOP FLOATING HEADER: Circle switcher & SOS
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: TopFloatingHeader(
              availableCircles: _circles,
              selectedCircle: _selectedCircle,
              onCircleChanged: (newCircle) {
                setState(() {
                  _selectedCircle = newCircle;
                });
                _wsClient?.dispose();
                _initWebSocket();
              },
              onSOSTapped: _triggerEmergencySOS,
            ),
          ),

          // 3. BOTTOM DRAGGABLE SHEET: Member horizontal cards & Center All button
          Positioned.fill(
            child: BottomDraggableSheet(
              members: _membersMap.values.toList(),
              selectedMember: _selectedMember,
              onSelectMember: _selectMember,
              onCenterAll: _centerAllMembers,
              onCheckIn: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('📍 Check-in shared with circle!')),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
