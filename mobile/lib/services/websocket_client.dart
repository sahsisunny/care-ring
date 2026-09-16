import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/telemetry_ping.dart';

typedef OnTelemetryReceived = void Function(Map<String, dynamic> data);
typedef OnGeofenceAlert = void Function(Map<String, dynamic> alert);
typedef OnSOSAlert = void Function(Map<String, dynamic> sos);
typedef OnAddressResolved = void Function(String userId, String address);

class WebSocketClient {
  final String serverUrl;
  final String circleId;
  final String userId;
  final List<String> _candidateUrls;
  int _currentUrlIndex = 0;

  WebSocketChannel? _channel;
  StreamSubscription? _sub;
  Timer? _reconnectTimer;
  bool _isConnected = false;
  bool _isDisposed = false;

  bool get isConnected => _isConnected;
  String get activeUrl => _candidateUrls[_currentUrlIndex];

  OnTelemetryReceived? onTelemetryReceived;
  OnGeofenceAlert? onGeofenceAlert;
  OnSOSAlert? onSOSAlert;
  OnAddressResolved? onAddressResolved;

  WebSocketClient({
    required this.serverUrl,
    required this.circleId,
    required this.userId,
    List<String>? fallbackUrls,
  }) : _candidateUrls = [
          serverUrl,
          'ws://127.0.0.1:4000',
          'ws://10.0.2.2:4000',
          'ws://172.20.10.2:4000',
          ...?fallbackUrls,
        ].toSet().toList();

  void connect() {
    if (_isDisposed) return;

    try {
      final activeUrl = _candidateUrls[_currentUrlIndex];
      final wsUri = Uri.parse('$activeUrl/ws/circles/$circleId?userId=$userId');
      print('[WS] Connecting to $wsUri...');

      _channel = WebSocketChannel.connect(wsUri);
      _channel?.ready.catchError((err) {
        print('[WS] Socket handshake failed for $activeUrl: $err');
      });

      _sub = _channel!.stream.listen(
        (message) {
          _isConnected = true;
          _handleMessage(message);
        },
        onDone: () {
          print('[WS] Connection closed. Reconnecting in 3s...');
          _isConnected = false;
          _currentUrlIndex = (_currentUrlIndex + 1) % _candidateUrls.length;
          _scheduleReconnect();
        },
        onError: (err) {
          print('[WS] Connection error: $err');
          _isConnected = false;
          _currentUrlIndex = (_currentUrlIndex + 1) % _candidateUrls.length;
          _scheduleReconnect();
        },
        cancelOnError: true,
      );
    } catch (e) {
      print('[WS] Connect error: $e');
      _currentUrlIndex = (_currentUrlIndex + 1) % _candidateUrls.length;
      _scheduleReconnect();
    }
  }

  void _handleMessage(dynamic raw) {
    try {
      final Map<String, dynamic> payload = jsonDecode(raw as String);
      final type = payload['type'];

      switch (type) {
        case 'TELEMETRY_UPDATE':
          if (onTelemetryReceived != null && payload['data'] != null) {
            onTelemetryReceived!(payload['data']);
          }
          break;

        case 'GEOFENCE_ALERT':
          if (onGeofenceAlert != null && payload['data'] != null) {
            onGeofenceAlert!(payload['data']);
          }
          break;

        case 'SOS_ALERT':
          if (onSOSAlert != null && payload['data'] != null) {
            onSOSAlert!(payload['data']);
          }
          break;

        case 'ADDRESS_RESOLVED':
          if (onAddressResolved != null && payload['data'] != null) {
            final data = payload['data'];
            onAddressResolved!(data['userId'], data['address']);
          }
          break;

        case 'CONNECTED':
          print('[WS] Successfully authenticated and joined circle room.');
          break;
      }
    } catch (err) {
      print('[WS] Failed to parse message: $err');
    }
  }

  void sendTelemetry(TelemetryPing ping) {
    if (_isConnected && _channel != null) {
      try {
        _channel!.sink.add(jsonEncode(ping.toJson()));
      } catch (e) {
        print('[WS] Error sending telemetry: $e');
      }
    }
  }

  void sendSOS(double latitude, double longitude) {
    if (_isConnected && _channel != null) {
      _channel!.sink.add(jsonEncode({
        'type': 'SOS_TRIGGER',
        'userId': userId,
        'circleId': circleId,
        'latitude': latitude,
        'longitude': longitude,
      }));
    }
  }

  void _scheduleReconnect() {
    if (_isDisposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), () {
      connect();
    });
  }

  void dispose() {
    _isDisposed = true;
    _reconnectTimer?.cancel();
    _sub?.cancel();
    _channel?.sink.close();
  }
}
