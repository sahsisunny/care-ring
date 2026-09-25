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
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>
            {circle?.name || 'Sahsi Family Circle'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Card Carousel */}
          <View style={styles.carouselCard}>
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
              <Text style={styles.carouselTitle}>Circle management</Text>
              <Text style={styles.carouselSubtitle}>
                Changes you make here apply only to the current selected Circle.
              </Text>
            </View>
          </View>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          {/* Section: Circle details */}
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>Circle details</Text>
          </View>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => {
              setNewName(circle?.name || 'Sahsi Family');
              setShowRenameModal(true);
            }}
          >
            <Text style={styles.itemTitle}>Edit Circle Name</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => {
              if (onEditProfilePhoto) {
                onEditProfilePhoto();
              }
            }}
          >
            <Text style={styles.itemTitle}>Profile Avatar (Photo Optional)</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          {/* Section: Circle management */}
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>Circle management</Text>
          </View>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => setShowRolePicker(true)}
          >
            <Text style={styles.itemTitle}>My Role</Text>
            <View style={styles.roleValueWrap}>
              <Text style={styles.roleValueText}>{role}</Text>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Admin Status', 'Circle creator and admins have full management permissions.')}
          >
            <Text style={styles.itemTitle}>Change Admin Status</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={onAddPeople}
          >
            <Text style={styles.itemTitle}>Add People to Circle</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Remove Members', 'Tap a member from the list to view profile and manage access.')}
          >
            <Text style={styles.itemTitle}>Remove People from Circle</Text>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => {
              setBubblesAllowed(!bubblesAllowed);
              Alert.alert(
                'Bubbles Access',
                bubblesAllowed ? 'Bubbles disabled for circle members.' : 'Bubbles enabled for all circle members.'
              );
            }}
          >
            <Text style={styles.itemTitle}>Set Bubbles access</Text>
            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>
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
            <Text style={[styles.itemTitle, { color: '#EF4444' }]}>Leave Circle</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Modal: Change Role Picker */}
        <Modal visible={showRolePicker} transparent animationType="fade">
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Select Your Role</Text>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.dialogOption}
                  onPress={() => handleRoleSelect(r)}
                >
                  <Text style={[styles.dialogOptionText, role === r && styles.activeDialogOption]}>
                    {r}
                  </Text>
                  {role === r && <Ionicons name="checkmark" size={18} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setShowRolePicker(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Modal: Edit Circle Name */}
        <Modal visible={showRenameModal} transparent animationType="fade">
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Edit Circle Name</Text>
              <TextInput
                style={styles.dialogInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter circle name"
              />
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  onPress={() => setShowRenameModal(false)}
                  style={styles.dialogBtnSecondary}
                >
                  <Text style={styles.dialogBtnSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveRename}
                  style={styles.dialogBtnPrimary}
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
