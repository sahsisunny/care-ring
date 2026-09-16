import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../models/member.dart';

class CustomMapMarkerGenerator {
  /// Generates a high-fidelity BitmapDescriptor for a circle member avatar marker:
  /// - Circular avatar image / initials badge
  /// - Online / moving status ring (emerald green for active, grey for offline)
  /// - Floating status pill displaying speed in km/h and battery level
  static Future<BitmapDescriptor> createCustomMarkerBitmap({
    required Member member,
    double size = 180.0,
  }) async {
    final ui.PictureRecorder pictureRecorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(pictureRecorder);
    final paint = Paint();

    final center = Offset(size / 2, size / 2 - 20);
    final avatarRadius = size * 0.28;

    // 1. Drop shadow for marker
    canvas.drawCircle(
      center.translate(0, 4),
      avatarRadius + 6,
      Paint()
        ..color = Colors.black.withOpacity(0.18)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );

    // 2. Outer status ring (Green if online/moving, Grey if offline)
    final ringColor = member.isOnline
        ? (member.isMoving ? const Color(0xFF10B981) : const Color(0xFF059669))
        : const Color(0xFF94A3B8);

    paint.color = ringColor;
    paint.style = PaintingStyle.stroke;
    paint.strokeWidth = 6.0;
    canvas.drawCircle(center, avatarRadius + 4, paint);

    // 3. Avatar Inner Circle (Solid background for initials or image)
    paint.style = PaintingStyle.fill;
    paint.color = const Color(0xFF3B82F6); // Blue accent
    canvas.drawCircle(center, avatarRadius, paint);

    // 4. Draw Initials if no image
    final initials = member.fullName.isNotEmpty
        ? member.fullName.trim().split(' ').map((e) => e[0]).take(2).join()
        : 'U';

    final textPainter = TextPainter(
      text: TextSpan(
        text: initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: avatarRadius * 0.8,
          fontWeight: FontWeight.bold,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(
      canvas,
      Offset(
        center.dx - textPainter.width / 2,
        center.dy - textPainter.height / 2,
      ),
    );

    // 5. Floating Status Pill (Speed & Battery Level)
    final pillCenterY = center.dy + avatarRadius + 24;
    final speedText = member.isMoving ? '${member.speed.toStringAsFixed(0)} km/h' : 'Idle';
    final batteryText = '${member.isCharging ? '⚡' : ''}${member.batteryLevel}%';
    final pillLabel = '$speedText • $batteryText';

    final pillTextPainter = TextPainter(
      text: TextSpan(
        text: pillLabel,
        style: const TextStyle(
          color: Color(0xFF0F172A),
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    pillTextPainter.layout();

    final pillWidth = pillTextPainter.width + 24;
    final pillHeight = 28.0;
    final pillRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(center.dx, pillCenterY),
        width: pillWidth,
        height: pillHeight,
      ),
      const Radius.circular(14),
    );

    // Pill shadow
    canvas.drawRRect(
      pillRect.shift(const Offset(0, 2)),
      Paint()
        ..color = Colors.black.withOpacity(0.15)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );

    // Pill body
    canvas.drawRRect(
      pillRect,
      Paint()..color = Colors.white,
    );

    // Pill text
    pillTextPainter.paint(
      canvas,
      Offset(
        center.dx - pillTextPainter.width / 2,
        pillCenterY - pillTextPainter.height / 2,
      ),
    );

    // 6. Convert canvas picture to BitmapDescriptor
    final picture = pictureRecorder.endRecording();
    final ui.Image image = await picture.toImage(size.toInt(), size.toInt() + 10);
    final byteData = await image.toByteData(format: ui.ImageByteFormat.png);

    return BitmapDescriptor.fromBytes(byteData!.buffer.asUint8List());
  }
}
