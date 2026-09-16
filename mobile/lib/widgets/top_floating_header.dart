import 'dart:ui';
import 'package:flutter/material.dart';
import '../models/circle.dart';

class TopFloatingHeader extends StatelessWidget {
  final List<Circle> availableCircles;
  final Circle selectedCircle;
  final Function(Circle) onCircleChanged;
  final VoidCallback onSOSTapped;
  final VoidCallback? onMenuTapped;

  const TopFloatingHeader({
    Key? key,
    required this.availableCircles,
    required this.selectedCircle,
    required this.onCircleChanged,
    required this.onSOSTapped,
    this.onMenuTapped,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24.0),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16.0, sigmaY: 16.0),
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 14.0),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.85),
                borderRadius: BorderRadius.circular(24.0),
                border: Border.all(color: Colors.white.withOpacity(0.6)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  // Menu Icon
                  IconButton(
                    icon: const Icon(Icons.menu, color: Color(0xFF1E293B)),
                    onPressed: onMenuTapped ?? () {},
                  ),

                  // Circle Switcher Dropdown
                  Expanded(
                    child: Center(
                      child: PopupMenuButton<Circle>(
                        onSelected: onCircleChanged,
                        offset: const Offset(0, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        itemBuilder: (context) {
                          return availableCircles.map((circle) {
                            final isSelected = circle.id == selectedCircle.id;
                            return PopupMenuItem<Circle>(
                              value: circle,
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.group_outlined,
                                    size: 18,
                                    color: isSelected ? const Color(0xFF3B82F6) : Colors.grey[600],
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    circle.name,
                                    style: TextStyle(
                                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                      color: isSelected ? const Color(0xFF3B82F6) : Colors.black87,
                                    ),
                                  ),
                                  const Spacer(),
                                  if (isSelected)
                                    const Icon(Icons.check, size: 16, color: Color(0xFF3B82F6)),
                                ],
                              ),
                            );
                          }).toList();
                        },
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  selectedCircle.name,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                const Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF64748B)),
                              ],
                            ),
                            Text(
                              '${selectedCircle.memberCount} Members',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // SOS Emergency Button
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: onSOSTapped,
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFEF4444), Color(0xFFDC2626)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFEF4444).withOpacity(0.4),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shield, color: Colors.white, size: 16),
                            SizedBox(width: 4),
                            Text(
                              'SOS',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 13,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
