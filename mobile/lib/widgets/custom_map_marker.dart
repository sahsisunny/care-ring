import 'package:flutter/material.dart';
import '../models/member.dart';

class FamilyMemberMarkerWidget extends StatelessWidget {
  final Member member;
  final VoidCallback onTap;

  const FamilyMemberMarkerWidget({
    Key? key,
    required this.member,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final ringColor = member.isOnline
        ? (member.isMoving ? const Color(0xFF10B981) : const Color(0xFF059669))
        : const Color(0xFF94A3B8);

    final speedText = member.isMoving ? '${member.speed.toStringAsFixed(0)} km/h' : 'Idle';
    final batteryText = '${member.isCharging ? '⚡' : ''}${member.batteryLevel}%';
    final initials = member.fullName.isNotEmpty
        ? member.fullName.trim().split(' ').map((e) => e[0]).take(2).join()
        : 'U';

    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 1. Circular Avatar with Online/Moving Glowing Halo
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF3B82F6),
              border: Border.all(
                color: ringColor,
                width: 3.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: ringColor.withOpacity(0.45),
                  blurRadius: 10,
                  spreadRadius: 2,
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.18),
                  blurRadius: 6,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ),
          ),

          const SizedBox(height: 4),

          // 2. Floating Status Pill (Speed & Battery Level)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.12),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '$speedText • $batteryText',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
