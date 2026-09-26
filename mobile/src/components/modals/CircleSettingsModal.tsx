import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Circle } from '../../models/Circle';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface CircleSettingsModalProps {
  visible: boolean;
  circle: Circle | null;
  currentUserId: string;
  onClose: () => void;
  onRenameCircle: (newName: string) => void;
  onAddPeople: () => void;
  onLeaveCircle: () => void;
  onEditProfilePhoto?: () => void;
}

export const CircleSettingsModal: React.FC<CircleSettingsModalProps> = ({
  visible,
  circle,
  currentUserId,
  onClose,
  onRenameCircle,
  onAddPeople,
  onLeaveCircle,
  onEditProfilePhoto,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const [role, setRole] = useState<'Son / Daughter / Child' | 'Parent' | 'Admin' | 'Member'>('Son / Daughter / Child');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState(circle?.name || 'Sahsi Family');
  const [bubblesAllowed, setBubblesAllowed] = useState(true);

  const roles = ['Son / Daughter / Child', 'Parent', 'Admin', 'Member'] as const;

  const handleSaveRename = () => {
    if (newName.trim()) {
      onRenameCircle(newName.trim());
      setShowRenameModal(false);
      Alert.alert('Updated', 'Circle name updated successfully.');
    }
  };

  const handleRoleSelect = (r: typeof roles[number]) => {
    setRole(r);
    setShowRolePicker(false);
    Alert.alert('Role Updated', `Your role in ${circle?.name || 'Circle'} is now ${r}.`);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.navBar, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.textMain} />
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: colors.textMain }]} numberOfLines={1}>
            {circle?.name || 'Sahsi Family Circle'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Card Carousel */}
          <View
            style={[
              styles.carouselCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1.5,
              },
            ]}
          >
            <View style={styles.illustrationWrap}>
              <View style={styles.userCirclePurple}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.userCirclePink}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.userCircleOrange}>
                <Ionicons name="person" size={16} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.carouselTextWrap}>
              <Text style={[styles.carouselTitle, { color: colors.textMain }]}>Circle management</Text>
              <Text style={[styles.carouselSubtitle, { color: colors.textSecondary }]}>
                Changes you make here apply only to the current selected Circle.
              </Text>
            </View>
          </View>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary, width: 14 }]} />
            <View style={[styles.dot, { backgroundColor: colors.divider }]} />
            <View style={[styles.dot, { backgroundColor: colors.divider }]} />
            <View style={[styles.dot, { backgroundColor: colors.divider }]} />
          </View>

          {/* Section: Circle details */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>Circle details</Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => {
              setNewName(circle?.name || 'Sahsi Family');
              setShowRenameModal(true);
            }}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Edit Circle Name</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => {
              if (onEditProfilePhoto) {
                onEditProfilePhoto();
              }
            }}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Profile Avatar (Photo Optional)</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Section: Circle management */}
          <View style={[styles.sectionHeaderWrap, { backgroundColor: colors.tileBg, borderColor: colors.divider }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>Circle management</Text>
          </View>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => setShowRolePicker(true)}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>My Role</Text>
            <View style={styles.roleValueWrap}>
              <Text style={[styles.roleValueText, { color: colors.primary }]}>{role}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Admin Status', 'Circle creator and admins have full management permissions.')}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Change Admin Status</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={onAddPeople}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Add People to Circle</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Remove Members', 'Tap a member from the list to view profile and manage access.')}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Remove People from Circle</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.divider }]}
            activeOpacity={0.7}
            onPress={() => {
              setBubblesAllowed(!bubblesAllowed);
              Alert.alert(
                'Bubbles Access',
                bubblesAllowed ? 'Bubbles disabled for circle members.' : 'Bubbles enabled for all circle members.'
              );
            }}
          >
            <Text style={[styles.itemTitle, { color: colors.textMain }]}>Set Bubbles access</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>
              {bubblesAllowed ? 'Allowed' : 'Disabled'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomWidth: 0, marginTop: 10 }]}
            activeOpacity={0.7}
            onPress={() => {
              Alert.alert(
                'Leave Circle',
                'Are you sure you want to leave this circle? You will need an invite code to rejoin.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: onLeaveCircle },
                ]
              );
            }}
          >
            <Text style={[styles.itemTitle, { color: colors.sos }]}>Leave Circle</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Modal: Change Role Picker */}
        <Modal visible={showRolePicker} transparent animationType="fade">
          <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1.5 }]}>
              <Text style={[styles.dialogTitle, { color: colors.textMain }]}>Select Your Role</Text>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.dialogOption, { borderBottomColor: colors.divider }]}
                  onPress={() => handleRoleSelect(r)}
                >
                  <Text style={[styles.dialogOptionText, { color: colors.textMain }, role === r && { color: colors.primary, fontWeight: '800' }]}>
                    {r}
                  </Text>
                  {role === r && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setShowRolePicker(false)}
                style={[styles.dialogCancelBtn, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}
              >
                <Text style={[styles.dialogCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal: Edit Circle Name */}
        <Modal visible={showRenameModal} transparent animationType="fade">
          <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1.5 }]}>
              <Text style={[styles.dialogTitle, { color: colors.textMain }]}>Edit Circle Name</Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textMain }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter circle name"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  onPress={() => setShowRenameModal(false)}
                  style={[styles.dialogBtnSecondary, { backgroundColor: colors.tileBg, borderColor: colors.tileBorder, borderWidth: 1 }]}
                >
                  <Text style={[styles.dialogBtnSecondaryText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveRename}
                  style={[styles.dialogBtnPrimary, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.dialogBtnPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  carouselCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  illustrationWrap: {
    width: 60,
    height: 60,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCirclePurple: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCirclePink: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCircleOrange: {
    position: 'absolute',
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselTextWrap: {
    flex: 1,
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  carouselSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 14,
  },
  sectionHeaderWrap: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleValueText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dialogOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  activeDialogOption: {
    color: Colors.primary,
    fontWeight: '800',
  },
  dialogCancelBtn: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dialogCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  dialogInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dialogBtnSecondary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  dialogBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  dialogBtnPrimary: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  dialogBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
