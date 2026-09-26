import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MemberData } from '../models/Member';
import { Avatar } from './Avatar';
import { useTheme } from '../theme/ThemeContext';

interface RightMemberStackProps {
  members: MemberData[];
  selectedMemberId?: string | null;
  onSelectMember: (member: MemberData) => void;
}

export const RightMemberStack: React.FC<RightMemberStackProps> = ({
  members,
  selectedMemberId,
  onSelectMember,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  if (members.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {members.map((member) => {
        const isSelected = member.id === selectedMemberId;

        return (
          <TouchableOpacity
            key={member.id}
            activeOpacity={0.8}
            onPress={() => onSelectMember(member)}
            style={[
              styles.avatarWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
              isGlass && (isDark ? styles.darkGlassShadow : styles.lightGlassShadow),
              isSelected && { borderColor: colors.primary, borderWidth: 2.5 },
            ]}
          >
            <Avatar
              name={member.fullName}
              avatarUrl={member.avatarUrl}
              size={38}
              borderWidth={2}
              borderColor={member.isOnline ? colors.moving : '#CBD5E1'}
              showOnlineDot={false}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'ios' ? 116 : 98,
    zIndex: 90,
    gap: 8,
    alignItems: 'center',
  },
  avatarWrap: {
    borderRadius: 22,
    padding: 2,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lightGlassShadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  darkGlassShadow: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
