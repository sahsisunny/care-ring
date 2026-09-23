import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { Circle } from '../../models/Circle';
import { Colors } from '../../theme/colors';

interface ManageCirclesModalProps {
  visible: boolean;
  circles: Circle[];
  selectedCircle: Circle | null;
  currentUserId: string;
  onClose: () => void;
  onSelectCircle: (circle: Circle) => void;
  onCreateNewPress: () => void;
  onJoinPress: () => void;
  onRenameCircle: (circleId: string, newName: string) => Promise<void>;
  onLeaveCircle: (circleId: string) => Promise<void>;
  onDeleteCircle: (circleId: string) => Promise<void>;
}

export const ManageCirclesModal: React.FC<ManageCirclesModalProps> = ({
  visible,
  circles,
  selectedCircle,
  currentUserId,
  onClose,
  onSelectCircle,
  onCreateNewPress,
  onJoinPress,
  onRenameCircle,
  onLeaveCircle,
  onDeleteCircle,
}) => {
  const [editingCircleId, setEditingCircleId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const startRename = (circle: Circle) => {
    setEditingCircleId(circle.id);
    setEditNameText(circle.name);
  };

  const handleSaveRename = async (circleId: string) => {
    if (!editNameText.trim()) return;
    setActionLoading(true);
    try {
      await onRenameCircle(circleId, editNameText.trim());
      setEditingCircleId(null);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to rename circle');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmLeave = (circle: Circle) => {
    Alert.alert(
      'Leave Family Group',
      `Are you sure you want to leave "${circle.name}"? You will need an invite code to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await onLeaveCircle(circle.id);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to leave circle');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleConfirmDelete = (circle: Circle) => {
    Alert.alert(
      'Delete Family Group',
      `Are you sure you want to delete "${circle.name}"? All member memberships and geofences will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await onDeleteCircle(circle.id);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete circle');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Family Groups</Text>
              <Text style={styles.headerSubtitle}>
                Switch circles or manage group settings
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Quick Actions Bar */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onCreateNewPress();
                }}
                style={styles.actionBtn}
              >
                <Feather name="plus-circle" size={16} color={Colors.primary} />
                <Text style={styles.actionBtnText}>Create Family</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onJoinPress();
                }}
                style={[styles.actionBtn, styles.actionBtnSecondary]}
              >
                <Ionicons name="key-outline" size={16} color={Colors.textMain} />
                <Text style={[styles.actionBtnText, { color: Colors.textMain }]}>Join with Code</Text>
              </TouchableOpacity>
            </View>

            {/* List of Circles */}
            <Text style={styles.sectionHeader}>YOUR CONNECTED CIRCLES ({circles.length})</Text>

            {circles.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={36} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Family Groups Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first family group or join an existing one using an invite code.
                </Text>
              </View>
            ) : (
              circles.map((circle) => {
                const isSelected = circle.id === selectedCircle?.id;
                const isOwner = circle.role === 'owner';
                const isEditing = editingCircleId === circle.id;

                return (
                  <View
                    key={circle.id}
                    style={[
                      styles.circleCard,
                      isSelected && styles.circleCardActive,
                    ]}
                  >
                    <View style={styles.circleTopRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => onSelectCircle(circle)}
                        style={styles.circleSelectArea}
                      >
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>

                        {isEditing ? (
                          <View style={styles.editRow}>
                            <TextInput
                              value={editNameText}
                              onChangeText={setEditNameText}
                              style={styles.editInput}
                              autoFocus
                            />
                            <TouchableOpacity
                              onPress={() => handleSaveRename(circle.id)}
                              style={styles.saveBtn}
                              disabled={actionLoading}
                            >
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setEditingCircleId(null)}
                              style={styles.cancelEditBtn}
                            >
                              <Ionicons name="close" size={16} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.circleNameContainer}>
                            <View style={styles.titleWithBadge}>
                              <Text
                                style={[
                                  styles.circleNameText,
                                  isSelected && styles.circleNameActiveText,
                                ]}
                                numberOfLines={1}
                              >
                                {circle.name}
                              </Text>
                              {isOwner && (
                                <View style={styles.ownerBadge}>
                                  <Text style={styles.ownerBadgeText}>Owner</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.circleMetaText}>
                              {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'} • Code: {circle.inviteCode}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      {/* Edit / Manage Action Buttons */}
                      {!isEditing && (
                        <View style={styles.manageIcons}>
                          {isOwner ? (
                            <>
                              <TouchableOpacity
                                onPress={() => startRename(circle)}
                                style={styles.iconActionBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="edit-2" size={15} color={Colors.primary} />
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => handleConfirmDelete(circle)}
                                style={styles.iconActionBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="trash-outline" size={16} color={Colors.sos} />
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity
                              onPress={() => handleConfirmLeave(circle)}
                              style={styles.leaveBtn}
                            >
                              <Ionicons name="exit-outline" size={15} color={Colors.sos} />
                              <Text style={styles.leaveBtnText}>Leave</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    paddingBottom: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionBtnSecondary: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#94A3B8',
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 10,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  circleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  circleCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  circleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleSelectArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  circleNameContainer: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
    maxWidth: 160,
  },
  circleNameActiveText: {
    color: Colors.primary,
    fontWeight: '800',
  },
  ownerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
  },
  circleMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  manageIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 8,
  },
  iconActionBtn: {
    padding: 4,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.sosLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  leaveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.sos,
  },
  editRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: Colors.textMain,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 6,
  },
  cancelEditBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 6,
  },
});
