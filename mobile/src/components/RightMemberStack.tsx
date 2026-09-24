import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MemberData } from '../models/Member';
import { Avatar } from './Avatar';
import { Colors } from '../theme/colors';

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
              isSelected && styles.selectedWrap,
            ]}
          >
            <Avatar
              name={member.fullName}
              avatarUrl={member.avatarUrl}
              size={38}
              borderWidth={2}
              borderColor={member.isOnline ? Colors.moving : '#CBD5E1'}
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  selectedWrap: {
    transform: [{ scale: 1.12 }],
    borderColor: Colors.primary,
    borderWidth: 2,
  },
});
