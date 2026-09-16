import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'screens/map_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set immersive edge-to-edge transparent system overlay
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  String deviceUserId = 'user_${DateTime.now().millisecondsSinceEpoch % 100000}';
  String deviceUserName = 'Family Member';
  bool isPhysical = false;

  try {
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      isPhysical = androidInfo.isPhysicalDevice;
      final model = androidInfo.model;
      final brand = androidInfo.brand;
      final idShort = androidInfo.id.hashCode.abs().toString().padLeft(4, '0').substring(0, 4);

      if (isPhysical) {
        deviceUserName = '$brand $model (Physical)';
        deviceUserId = 'physical_$idShort';
      } else {
        deviceUserName = 'Android Emulator (Virtual)';
        deviceUserId = 'emulator_$idShort';
      }
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      isPhysical = iosInfo.isPhysicalDevice;
      final idShort = (iosInfo.identifierForVendor ?? 'ios').hashCode.abs().toString().substring(0, 4);
      deviceUserName = isPhysical ? '${iosInfo.name} (iPhone)' : 'iOS Simulator';
      deviceUserId = 'ios_$idShort';
    }
  } catch (e) {
    print('[Main] Device info resolution failed: $e');
  }

  // With `adb reverse tcp:4000 tcp:4000`, 127.0.0.1:4000 works on both physical and emulator.
  // Wi-Fi fallback: ws://172.20.10.2:4000
  const String kDefaultBackendWsUrl = 'ws://127.0.0.1:4000';

  runApp(Life360App(
    currentUserId: deviceUserId,
    currentUserName: deviceUserName,
    backendWsUrl: kDefaultBackendWsUrl,
  ));
}

class Life360App extends StatelessWidget {
  final String currentUserId;
  final String currentUserName;
  final String backendWsUrl;

  const Life360App({
    Key? key,
    required this.currentUserId,
    required this.currentUserName,
    required this.backendWsUrl,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Life360 MVP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF3B82F6),
          primary: const Color(0xFF3B82F6),
          secondary: const Color(0xFF10B981),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      ),
      home: MapScreen(
        currentUserId: currentUserId,
        currentUserName: currentUserName,
        backendWsUrl: backendWsUrl,
      ),
    );
  }
}
