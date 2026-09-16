import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' hide Circle;
import 'package:geolocator/geolocator.dart';
import '../models/circle.dart';
import '../models/member.dart';
import '../models/telemetry_ping.dart';
import '../services/marker_interpolator.dart';
import '../services/adaptive_location_engine.dart';
import '../services/websocket_client.dart';
import '../widgets/custom_map_marker.dart';
import '../widgets/current_location_marker.dart';
import '../widgets/top_floating_header.dart';
import '../widgets/bottom_draggable_sheet.dart';
import '../services/cached_tile_provider.dart';

class MapScreen extends StatefulWidget {
  final String currentUserId;
  final String currentUserName;
  final String backendWsUrl;

  const MapScreen({
    Key? key,
    required this.currentUserId,
    this.currentUserName = 'Family Member',
    this.backendWsUrl = 'ws://127.0.0.1:4000',
  }) : super(key: key);

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  late MarkerInterpolator _interpolator;
  late AdaptiveLocationEngine _locationEngine;
  late CachedTileProvider _tileProvider;
  WebSocketClient? _wsClient;

  late String _displayName;
  late String _serverUrl;
  bool _showDemoMembers = false;

  // Circle State
  final List<Circle> _circles = [
    Circle(id: 'circle-family-01', name: 'Family Circle', inviteCode: 'FAM-9988', memberCount: 3),
    Circle(id: 'circle-bikers-02', name: 'Biker Squad', inviteCode: 'BIKE-4411', memberCount: 5),
  ];
  late Circle _selectedCircle;

  // Members State
  final Map<String, Member> _membersMap = {};
  Member? _selectedMember;
  LatLng? _myCurrentLocation;
  double _myHeading = 0.0;

  // Default initial viewport (Centered on India/World before GPS fix)
  final LatLng _initialCenter = const LatLng(20.5937, 78.9629);
  final double _initialZoom = 14.0;

  @override
  void initState() {
    super.initState();
    _displayName = widget.currentUserName;
    _serverUrl = widget.backendWsUrl;
    _selectedCircle = _circles.first;

    // Initialize Persistent Disk & Memory Map Tile Cache
    CachedTileProvider.initialize();
    _tileProvider = CachedTileProvider();

    // 1. Initialize Marker Interpolator (eliminates GPS jitter via tweening)
    _interpolator = MarkerInterpolator(
      vsync: this,
      onUpdate: (memberId, pos, heading) {
        setState(() {}); // Repaint marker positions on animation ticks (60/120fps)
      },
    );

    // 2. Initialize Seed Members (only if demo mode is enabled)
    if (_showDemoMembers) {
      _initializeSeedMembers();
    }

    // 3. Initialize Adaptive Sensor & Battery Efficiency Engine
    _locationEngine = AdaptiveLocationEngine(
      userId: widget.currentUserId,
      circleId: _selectedCircle.id,
      userName: _displayName,
    );

    _locationEngine.telemetryStream.listen((TelemetryPing ping) {
      _wsClient?.sendTelemetry(ping);

      final myPos = LatLng(ping.latitude, ping.longitude);
      _myCurrentLocation = myPos;
      _myHeading = ping.heading;

      _interpolator.updateTarget(
        memberId: widget.currentUserId,
        newPosition: myPos,
        newHeading: ping.heading,
      );

      if (mounted) {
        setState(() {
          _membersMap[widget.currentUserId] = Member(
            id: widget.currentUserId,
            fullName: '$_displayName (You)',
            latitude: ping.latitude,
            longitude: ping.longitude,
            speed: ping.speed,
            heading: ping.heading,
            batteryLevel: ping.batteryLevel,
            isCharging: ping.isCharging,
            resolvedAddress: _membersMap[widget.currentUserId]?.resolvedAddress,
            lastOnlineAt: DateTime.now(),
          );
        });
      }
    });

    _locationEngine.start().catchError((e) {
      print('[MapScreen] Location engine start error: $e');
    });

    // 4. Immediately fetch device GPS position for current location dot
    _fetchInitialPosition();

    // 5. Initialize WebSocket Client
    _initWebSocket();
  }

  Future<void> _fetchInitialPosition() async {
    try {
      final Position pos = await Geolocator.getLastKnownPosition() ??
          await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 4),
          );
      if (mounted) {
        final loc = LatLng(pos.latitude, pos.longitude);
        setState(() {
          _myCurrentLocation = loc;
          _myHeading = pos.heading;
          if (!_membersMap.containsKey(widget.currentUserId)) {
            _membersMap[widget.currentUserId] = Member(
              id: widget.currentUserId,
              fullName: '$_displayName (You)',
              latitude: pos.latitude,
              longitude: pos.longitude,
              speed: pos.speed * 3.6,
              heading: pos.heading,
              lastOnlineAt: DateTime.now(),
            );
          }
        });
        _animatedMapMove(loc, 15.5);
      }
    } catch (_) {}
  }

  void _initializeSeedMembers() {
    final seed = [
      Member(
        id: 'demo-user-01',
        fullName: 'Sarah (Demo)',
        latitude: 37.7749,
        longitude: -122.4194,
        speed: 42.0,
        batteryLevel: 88,
        isCharging: true,
        resolvedAddress: 'Lincoln High School',
        lastOnlineAt: DateTime.now().subtract(const Duration(minutes: 2)),
      ),
      Member(
        id: 'demo-user-02',
        fullName: 'Noah (Demo)',
        latitude: 37.7680,
        longitude: -122.4280,
        speed: 0.0,
        batteryLevel: 74,
        resolvedAddress: 'Home',
        lastOnlineAt: DateTime.now().subtract(const Duration(minutes: 4)),
      ),
      Member(
        id: 'demo-user-03',
        fullName: 'Maya (Demo)',
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
      serverUrl: _serverUrl,
      circleId: _selectedCircle.id,
      userId: widget.currentUserId,
    );

    _wsClient!.onTelemetryReceived = (data) {
      final userId = data['userId'] as String;
      // Skip echo of self if any
      if (userId == widget.currentUserId) return;

      final lat = (data['latitude'] as num).toDouble();
      final lng = (data['longitude'] as num).toDouble();
      final speed = (data['speed'] as num).toDouble();
      final heading = (data['heading'] as num).toDouble();
      final battery = (data['batteryLevel'] as num).toInt();
      final isCharging = (data['isCharging'] as bool?) ?? false;
      final address = data['resolvedAddress'] as String?;
      final incomingName = data['userName'] as String?;

      final memberName = (incomingName != null && incomingName.isNotEmpty)
          ? incomingName
          : (userId.contains('physical') ? 'Realme Device' : 'Circle Member');

      setState(() {
        if (_membersMap.containsKey(userId)) {
          final existing = _membersMap[userId]!;
          existing.fullName = memberName;
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
            fullName: memberName,
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
    _animatedMapMove(pos, 16.5);
  }

  /// Smooth Google Maps style curved camera interpolation
  void _animatedMapMove(LatLng destLocation, double destZoom) {
    final camera = _mapController.camera;
    final latTween = Tween<double>(
      begin: camera.center.latitude,
      end: destLocation.latitude,
    );
    final lngTween = Tween<double>(
      begin: camera.center.longitude,
      end: destLocation.longitude,
    );
    final zoomTween = Tween<double>(
      begin: camera.zoom,
      end: destZoom,
    );

    final controller = AnimationController(
      duration: const Duration(milliseconds: 650),
      vsync: this,
    );

    final Animation<double> animation = CurvedAnimation(
      parent: controller,
      curve: Curves.fastOutSlowIn,
    );

    controller.addListener(() {
      _mapController.move(
        LatLng(latTween.evaluate(animation), lngTween.evaluate(animation)),
        zoomTween.evaluate(animation),
      );
    });

    animation.addStatusListener((status) {
      if (status == AnimationStatus.completed || status == AnimationStatus.dismissed) {
        controller.dispose();
      }
    });

    controller.forward();
  }

  void _animateCameraTo(LatLng target, {double zoom = 15.5}) {
    _animatedMapMove(target, zoom);
  }

  /// Immediately pans to the device's live GPS coordinate like Google Maps
  Future<void> _goToMyLocation() async {
    try {
      LatLng? target = _myCurrentLocation;

      if (target == null) {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 4),
        ).catchError((_) async {
          return await Geolocator.getLastKnownPosition() ??
              Position(
                latitude: 37.7749,
                longitude: -122.4194,
                timestamp: DateTime.now(),
                accuracy: 10,
                altitude: 0,
                altitudeAccuracy: 0,
                heading: 0,
                headingAccuracy: 0,
                speed: 0,
                speedAccuracy: 0,
              );
        });

        target = LatLng(pos.latitude, pos.longitude);
        if (mounted) {
          setState(() {
            _myCurrentLocation = target;
          });
        }
      }

      // Smooth Google Maps-style curved glide to location
      _animatedMapMove(target, 16.5);

      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 1),
            backgroundColor: Color(0xFF0F172A),
            content: Row(
              children: [
                Icon(Icons.gps_fixed, color: Color(0xFF38BDF8), size: 18),
                SizedBox(width: 8),
                Text('Centered on your current location'),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      _animatedMapMove(_initialCenter, 16.5);
    }
  }

  /// Calculates LatLngBounds encompassing all active circle members with padding
  void _centerAllMembers() {
    final points = _membersMap.values.map((m) {
      return _interpolator.getCurrentPosition(m.id) ?? LatLng(m.latitude, m.longitude);
    }).toList();

    if (_myCurrentLocation != null) {
      points.add(_myCurrentLocation!);
    }

    if (points.isEmpty) return;

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
    _tileProvider.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 1. BASE LAYER: Full-screen OpenStreetMap with Persistent Multi-Tier Cache (Google/Apple Maps style)
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _initialCenter,
              initialZoom: _initialZoom,
              minZoom: 3.0,
              maxZoom: 18.0,
            ),
            children: [
              // Standard OpenStreetMap tiles with persistent local disk storage
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.life360.familylocation.life360_mobile',
                tileProvider: _tileProvider,
              ),

              // Dynamic Avatar Markers with 60/120fps tween interpolation + My Location Indicator
              MarkerLayer(
                markers: [
                  // 1. Google Maps style live current location pulsing blue dot
                  if (_myCurrentLocation != null)
                    Marker(
                      point: _myCurrentLocation!,
                      width: 70,
                      height: 70,
                      alignment: Alignment.center,
                      child: CurrentLocationMarker(
                        heading: _myHeading,
                        onTap: _goToMyLocation,
                      ),
                    ),

                  // 2. Family Circle Member Markers with pulsing emerald halos & status pills
                  ..._membersMap.values.where((m) => m.id != widget.currentUserId).map((member) {
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
                  }),
                ],
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
              onMenuTapped: _showAppMenuSheet,
            ),
          ),

          // 3. BOTTOM DRAGGABLE SHEET: Member horizontal cards & Center All button
          Positioned.fill(
            child: BottomDraggableSheet(
              members: _membersMap.values.toList(),
              selectedMember: _selectedMember,
              onSelectMember: _selectMember,
              onCenterAll: _centerAllMembers,
              onGoToMyLocation: _goToMyLocation,
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

  void _showAppMenuSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final isConnected = _wsClient?.isConnected == true;
            return Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.settings_suggest_rounded, color: Color(0xFF2563EB), size: 26),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Circle & Device Settings',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Real-time multi-device peer synchronization',
                                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Device Profile Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.smartphone_rounded, size: 20, color: Color(0xFF3B82F6)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _displayName,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              TextButton.icon(
                                onPressed: () {
                                  _showRenameDialog(setSheetState);
                                },
                                icon: const Icon(Icons.edit, size: 14),
                                label: const Text('Rename', style: TextStyle(fontSize: 12)),
                              ),
                            ],
                          ),
                          const Divider(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Device ID: ${widget.currentUserId}',
                                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isConnected ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  isConnected ? 'LIVE SYNC 🟢' : 'CONNECTING 🟡',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: isConnected ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Circle Info
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.group_work_rounded, color: Color(0xFF475569), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(_selectedCircle.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                Text('Invite Code: ${_selectedCircle.inviteCode}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                              ],
                            ),
                          ),
                          Text(
                            '${_membersMap.length} Active',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF2563EB)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Toggle Simulated Demo Data
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Simulated Demo Members', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      subtitle: const Text('Show fake Sarah, Noah, Maya for testing', style: TextStyle(fontSize: 11)),
                      value: _showDemoMembers,
                      activeThumbColor: const Color(0xFF2563EB),
                      onChanged: (val) {
                        setState(() {
                          _showDemoMembers = val;
                          if (val) {
                            _initializeSeedMembers();
                          } else {
                            _membersMap.removeWhere((key, val) => key.startsWith('demo-') || key.startsWith('user-0'));
                          }
                        });
                        setSheetState(() {});
                      },
                    ),
                    const Divider(height: 16),

                    // Offline Cache Management Action
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.download_for_offline_rounded, color: Color(0xFF2563EB), size: 20),
                      ),
                      title: const Text('Offline Maps & Tile Storage', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      subtitle: const Text('Pre-download map tiles for zero data usage', style: TextStyle(fontSize: 11)),
                      trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Color(0xFF94A3B8)),
                      onTap: () {
                        Navigator.pop(ctx);
                        _showOfflineCacheDialog();
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showRenameDialog(StateSetter setSheetState) {
    final controller = TextEditingController(text: _displayName);
    showDialog(
      context: context,
      builder: (dCtx) => AlertDialog(
        title: const Text('Rename Device'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Enter device or user name',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dCtx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final newName = controller.text.trim();
              if (newName.isNotEmpty) {
                setState(() {
                  _displayName = newName;
                  if (_membersMap.containsKey(widget.currentUserId)) {
                    _membersMap[widget.currentUserId]!.fullName = '$newName (You)';
                  }
                });
                setSheetState(() {});
              }
              Navigator.pop(dCtx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  /// Displays the Google/Apple Maps-style Offline Map & Disk Cache manager sheet
  void _showOfflineCacheDialog() async {
    final stats = await CachedTileProvider.getCacheStats();

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        bool isDownloading = false;
        int downloadProgress = 0;
        int downloadTotal = 0;
        Map<String, dynamic> currentStats = Map.from(stats);

        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: SafeArea(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.offline_pin_rounded, color: Color(0xFF2563EB), size: 26),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Offline Map Storage',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'Persistent tile caching (Google/Apple Maps style)',
                                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Column(
                            children: [
                              const Text('CACHED TILES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                              const SizedBox(height: 4),
                              Text(
                                '${currentStats['count']}',
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                            ],
                          ),
                          Container(width: 1, height: 32, color: const Color(0xFFE2E8F0)),
                          Column(
                            children: [
                              const Text('DISK STORAGE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                              const SizedBox(height: 4),
                              Text(
                                '${currentStats['formattedSize']}',
                                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF2563EB)),
                              ),
                            ],
                          ),
                          Container(width: 1, height: 32, color: const Color(0xFFE2E8F0)),
                          const Column(
                            children: [
                              Text('STATUS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                              SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.check_circle, color: Color(0xFF10B981), size: 16),
                                  SizedBox(width: 4),
                                  Text(
                                    'Active',
                                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (isDownloading) ...[
                      LinearProgressIndicator(
                        value: downloadTotal > 0 ? downloadProgress / downloadTotal : null,
                        backgroundColor: const Color(0xFFE2E8F0),
                        valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Downloading offline area: $downloadProgress / $downloadTotal tiles...',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 16),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            icon: const Icon(Icons.download_for_offline_rounded, color: Colors.white, size: 20),
                            label: const Text('Download Area', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            onPressed: isDownloading
                                ? null
                                : () async {
                                    setSheetState(() {
                                      isDownloading = true;
                                    });
                                    final center = _myCurrentLocation ?? _initialCenter;
                                    await CachedTileProvider.precacheArea(
                                      center: center,
                                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                      minZoom: 13,
                                      maxZoom: 15,
                                      radiusKm: 2.0,
                                      onProgress: (cur, tot) {
                                        setSheetState(() {
                                          downloadProgress = cur;
                                          downloadTotal = tot;
                                        });
                                      },
                                    );
                                    final updated = await CachedTileProvider.getCacheStats();
                                    setSheetState(() {
                                      isDownloading = false;
                                      currentStats = updated;
                                    });
                                  },
                          ),
                        ),
                        const SizedBox(width: 12),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            side: const BorderSide(color: Color(0xFFEF4444)),
                          ),
                          icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 20),
                          label: const Text('Clear', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
                          onPressed: isDownloading
                              ? null
                              : () async {
                                  await CachedTileProvider.clearCache();
                                  final updated = await CachedTileProvider.getCacheStats();
                                  setSheetState(() {
                                    currentStats = updated;
                                  });
                                },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
