import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'screens/map_screen.dart';

void main() {
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

  runApp(const Life360App());
}

// ==============================================================================
// CONFIGURATION FOR PHYSICAL DEVICES:
// When running on physical iPhone or Android, replace 'localhost' with your 
// Mac's Wi-Fi IP address (find it by running: ipconfig getifaddr en0).
// Example: const String kBackendHost = '192.168.1.45';
// ==============================================================================
const String kBackendHost = '192.168.0.9'; // Your Mac's local Wi-Fi IP
const String kBackendWsUrl = 'ws://$kBackendHost:4000';

class Life360App extends StatelessWidget {
  const Life360App({Key? key}) : super(key: key);

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
      home: const MapScreen(
        currentUserId: 'user_phone_local_01',
        backendWsUrl: kBackendWsUrl,
      ),
    );
  }
}
