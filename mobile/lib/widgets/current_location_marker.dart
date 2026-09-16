import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Authentic Google Maps-style current location indicator with:
/// 1. Outer radar pulse ring animation
/// 2. Soft accuracy halo
/// 3. Directional heading beam cone
/// 4. Crisp white border ring with shadow
/// 5. Vibrant royal blue core dot
class CurrentLocationMarker extends StatefulWidget {
  final double heading;
  final VoidCallback? onTap;

  const CurrentLocationMarker({
    Key? key,
    this.heading = 0.0,
    this.onTap,
  }) : super(key: key);

  @override
  State<CurrentLocationMarker> createState() => _CurrentLocationMarkerState();
}

class _CurrentLocationMarkerState extends State<CurrentLocationMarker>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _radiusAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    _radiusAnimation = Tween<double>(begin: 18.0, end: 56.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeOut),
    );

    _opacityAnimation = Tween<double>(begin: 0.5, end: 0.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: Center(
        child: SizedBox(
          width: 70,
          height: 70,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 1. Directional beam cone (pointing in device heading angle)
              if (widget.heading > 0)
                Transform.rotate(
                  angle: (widget.heading * math.pi) / 180.0,
                  child: CustomPaint(
                    size: const Size(64, 64),
                    painter: _HeadingBeamPainter(),
                  ),
                ),

              // 2. Pulsing radar ripple wave (Google Maps accuracy pulse)
              AnimatedBuilder(
                animation: _pulseController,
                builder: (context, child) {
                  return Container(
                    width: _radiusAnimation.value,
                    height: _radiusAnimation.value,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF2563EB).withValues(alpha: _opacityAnimation.value),
                    ),
                  );
                },
              ),

              // 3. Soft semi-transparent accuracy halo
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF3B82F6).withValues(alpha: 0.25),
                ),
              ),

              // 4. Crisp white border ring with drop shadow
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.28),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),

              // 5. Solid Google Maps Royal Blue core dot
              Container(
                width: 14,
                height: 14,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Color(0xFF3B82F6),
                      Color(0xFF1D4ED8),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeadingBeamPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFF3B82F6).withValues(alpha: 0.42),
          const Color(0xFF3B82F6).withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: 30));

    final path = Path()
      ..moveTo(center.dx, center.dy)
      ..arcTo(
        Rect.fromCircle(center: center, radius: 30),
        -math.pi / 2 - math.pi / 6,
        math.pi / 3,
        false,
      )
      ..close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
