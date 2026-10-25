import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Circle } from '../../models/Circle';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { CircleItemSkeleton } from '../common/Skeleton';

interface ManageCirclesModalProps {
  visible: boolean;
  circles: Circle[];
  isLoadingCircles?: boolean;
  selectedCircle: Circle | null;
  currentUserId: string;
  onClose: () => void;
  onSelectCircle: (circle: Circle) => void;
  onCreateNewPress: () => void;
  onJoinPress: () => void;
  onRenameCircle?: (circleId: string, newName: string) => Promise<void>;
  onLeaveCircle?: (circleId: string) => Promise<void>;
  onDeleteCircle?: (circleId: string) => Promise<void>;
  onOpenCircleSettings?: () => void;
}

export const ManageCirclesModal: React.FC<ManageCirclesModalProps> = ({
  visible,
  circles,
  isLoadingCircles = false,
  selectedCircle,
  currentUserId,
  onClose,
  onSelectCircle,
  onCreateNewPress,
  onJoinPress,
  onRenameCircle,
  onLeaveCircle,
  onDeleteCircle,
  onOpenCircleSettings,
}) => {
  const { colors, isDark, isGlass } = useTheme();

  const webGlassCard =
    Platform.OS === 'web' && isGlass
      ? {
          backdropFilter: 'blur(30px) saturate(210%)',
          WebkitBackdropFilter: 'blur(30px) saturate(210%)',
          boxShadow: isDark
            ? 'inset 0 1px 0.8px rgba(255, 255, 255, 0.22), 0 8px 32px rgba(0, 0, 0, 0.4)'
            : 'inset 0 1px 1.2px rgba(255, 255, 255, 0.95), 0 8px 28px rgba(0, 0, 0, 0.08)',
        }
      : {};

  const webGlassTile =
    Platform.OS === 'web' && isGlass
      ? {
          backdropFilter: 'blur(20px) saturate(190%)',
          WebkitBackdropFilter: 'blur(20px) saturate(190%)',
          boxShadow: isDark
            ? 'inset 0 1px 0.5px rgba(255, 255, 255, 0.16)'
            : 'inset 0 1px 0.8px rgba(255, 255, 255, 0.9)',
        }
      : {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.cardBorder,
              borderTopWidth: 1.5,
              borderLeftWidth: 1.5,
              borderRightWidth: 1.5,
            },
            webGlassCard,
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.divider }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textMain }]}>Switch Circle</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Select your active circle or create a new group
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
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
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: isDark ? 'rgba(79, 70, 229, 0.25)' : Colors.primaryLight,
                    borderColor: isDark ? 'rgba(99, 102, 241, 0.5)' : '#BFDBFE',
                  },
                ]}
              >
                <Feather name="plus-circle" size={16} color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Create Circle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onJoinPress();
                }}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#F1F5F9',
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Ionicons name="key-outline" size={16} color={colors.textMain} />
                <Text style={[styles.actionBtnText, { color: colors.textMain }]}>Join with Code</Text>
              </TouchableOpacity>
            </View>

            {/* List of Circles */}
            <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>YOUR CONNECTED CIRCLES ({circles.length})</Text>

            {isLoadingCircles ? (
              <CircleItemSkeleton count={3} />
            ) : circles.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#F8FAFC',
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                <Ionicons name="people-outline" size={36} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.textMain }]}>No Circles Yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Create your first circle or join an existing one using an invite code.
                </Text>
              </View>
            ) : (
              circles.map((circle) => {
                const isSelected = circle.id === selectedCircle?.id;
                const isOwner = circle.role === 'owner';

                return (
                  <View
                    key={circle.id}
                    style={[
                      styles.circleCard,
                      {
                        backgroundColor: colors.tileBg,
                        borderColor: colors.cardBorder,
                      },
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(79, 70, 229, 0.22)' : '#EFF6FF',
                        borderColor: colors.primary,
                      },
                      webGlassTile,
                    ]}
                  >
                    <View style={styles.circleTopRow}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          onSelectCircle(circle);
                          onClose();
                        }}
                        style={styles.circleSelectArea}
                      >
                        <View
                          style={[
                            styles.radioCircle,
                            { borderColor: isSelected ? colors.primary : isDark ? '#475569' : '#CBD5E1' },
                            isSelected && { borderColor: colors.primary },
                          ]}
                        >
                          {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                        </View>

                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: circle.color || colors.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                          }}
                        >
                          {circle.badgeEmoji ? (
                            <Text style={{ fontSize: 17 }}>{circle.badgeEmoji}</Text>
                          ) : (
                            <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF' }}>
                              {circle.initials || circle.name.substring(0, 2).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={styles.circleNameContainer}>
                          <View style={styles.titleWithBadge}>
                            <Text
                              style={[
                                styles.circleNameText,
                                { color: colors.textMain },
                                isSelected && { color: colors.primary, fontWeight: '800' },
                              ]}
                              numberOfLines={1}
                            >
                              {circle.name}
                            </Text>
                            {isOwner && (
                              <View
                                style={[
                                  styles.ownerBadge,
                                  { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : '#FEF3C7' },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.ownerBadgeText,
                                    { color: isDark ? '#FBBF24' : '#B45309' },
                                  ]}
                                >
                                  Owner
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.circleMetaText, { color: colors.textSecondary }]}>
                            {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'} • Code: {circle.inviteCode || (circle as any).invite_code || '—'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {/* Settings Action Button - opens Circle Settings */}
                      {onOpenCircleSettings && (
                        <View style={styles.manageIcons}>
                          <TouchableOpacity
                            onPress={() => {
                              if (!isSelected) {
                                onSelectCircle(circle);
                              }
                              onClose();
                              onOpenCircleSettings();
                            }}
                            style={styles.iconActionBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityLabel="Circle settings and member governance"
                          >
                            <Ionicons name="settings-outline" size={18} color={colors.primary} />
                          </TouchableOpacity>
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
