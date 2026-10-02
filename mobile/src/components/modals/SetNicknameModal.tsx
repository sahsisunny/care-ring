import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { InlineButtonLoader } from '../common/Loader';

interface SetNicknameModalProps {
  visible: boolean;
  memberName: string;
  memberId: string;
  currentNickname?: string;
  onClose: () => void;
  onSave: (memberId: string, nickname: string) => void;
}

const NICKNAME_PRESETS = [
  'Dad 👨',
  'Mom 👩',
  'Sis 👧',
  'Bro 👦',
  'Spouse ❤️',
  'Partner 💫',
  'Son 🧒',
  'Daughter 👧',
  'Grandma 👵',
  'Grandpa 👴',
  'Best Friend 🌟',
];

export const SetNicknameModal: React.FC<SetNicknameModalProps> = ({
  visible,
  memberName,
  memberId,
  currentNickname = '',
  onClose,
  onSave,
}) => {
  const { colors, isDark } = useTheme();
  const [nickname, setNickname] = useState(currentNickname);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNickname(currentNickname || '');
    }
  }, [visible, currentNickname]);

  const handleSave = () => {
    setIsSaving(true);
    try {
      onSave(memberId, nickname.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    onSave(memberId, '');
    onClose();
  };

  const handleSelectPreset = (preset: string) => {
    // Strip emojis for the name value or keep them cleanly
    const clean = preset.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    setNickname(clean);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardWrap}
          >
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  borderWidth: 1.5,
                },
              ]}
            >
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.textMain }]}>Personal Nickname</Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    For {memberName}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Privacy Reassurance Banner */}
              <View
                style={[
                  styles.privacyBanner,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.08)',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(14, 165, 233, 0.20)',
                  },
                ]}
              >
                <Ionicons name="lock-closed" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <Text style={[styles.privacyBannerText, { color: colors.textSecondary }]}>
                  <Text style={{ fontWeight: '700', color: colors.primary }}>100% Private to you. </Text>
                  Only you will see this nickname on your map and member lists. Other circle members will not see it.
                </Text>
              </View>

              {/* Input Field */}
              <View style={styles.inputWrap}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nickname</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                      color: colors.textMain,
                    },
                  ]}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder={`e.g. Dad, Pops, Honey`}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  maxLength={30}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsWrap}>
                <Text style={[styles.presetsLabel, { color: colors.textMuted }]}>Quick Presets</Text>
                <View style={styles.presetChipsRow}>
                  {NICKNAME_PRESETS.map((p) => {
                    const cleanP = p.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
                    const isSelected = nickname.toLowerCase() === cleanP.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={p}
                        activeOpacity={0.7}
                        onPress={() => handleSelectPreset(p)}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : isDark
                              ? 'rgba(255, 255, 255, 0.06)'
                              : '#F1F5F9',
                            borderColor: isSelected ? colors.primary : colors.divider,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            { color: isSelected ? '#FFFFFF' : colors.textMain },
                            isSelected && { fontWeight: '700' },
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBtnRow}>
                {Boolean(currentNickname) && (
                  <TouchableOpacity
                    onPress={handleClear}
                    style={[
                      styles.clearBtn,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FCA5A5',
                      },
                    ]}
                  >
                    <Text style={[styles.clearBtnText, { color: '#EF4444' }]}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: colors.tileBg,
                      borderColor: colors.tileBorder,
                    },
                  ]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={isSaving}
                  style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.8 : 1 }]}
                >
                  {isSaving ? (
                    <InlineButtonLoader size={16} label="Saving..." />
                  ) : (
                    <Text style={styles.saveBtnText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  keyboardWrap: {
    width: '100%',
    maxWidth: 420,
  },
  modalCard: {
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
    marginLeft: 12,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  privacyBannerText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  inputWrap: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  presetsWrap: {
    marginBottom: 20,
  },
  presetsLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 'auto',
  },
  clearBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
