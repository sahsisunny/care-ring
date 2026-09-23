import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { MapStyleConfig, ALL_MAP_STYLES } from '../../models/MapStyle';
import { TileCacheService, CacheStats } from '../../services/TileCacheService';
import { Colors } from '../../theme/colors';
import { getMemberInitials } from '../../models/Member';

interface SettingsModalProps {
  visible: boolean;
  currentUserName: string;
  currentUserEmail?: string;
  currentUserPhone?: string | null;
  currentUserAvatar?: string | null;
  activeMapStyle: MapStyleConfig;
  onClose: () => void;
  onUpdateName: (newName: string) => Promise<void>;
  onSelectMapStyle: (style: MapStyleConfig) => void;
  onSignOut: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  currentUserName,
  currentUserEmail,
  currentUserPhone,
  currentUserAvatar,
  activeMapStyle,
  onClose,
  onUpdateName,
  onSelectMapStyle,
  onSignOut,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUserName);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    setNameInput(currentUserName);
    if (visible) {
      TileCacheService.getCacheStats().then(setCacheStats);
    }
  }, [visible, currentUserName]);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await onUpdateName(nameInput.trim());
    setIsEditingName(false);
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    await TileCacheService.clearCache();
    const updated = await TileCacheService.getCacheStats();
    setCacheStats(updated);
    setIsClearingCache(false);
  };

  const initials = getMemberInitials(currentUserName);

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
            <Text style={styles.headerTitle}>Settings & Preferences</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* 1. Profile Section */}
            <View style={styles.sectionCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatarContainer}>
                  {currentUserAvatar ? (
                    <Image source={{ uri: currentUserAvatar }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </View>

                <View style={styles.profileDetails}>
                  {isEditingName ? (
                    <View style={styles.editNameRow}>
                      <TextInput
                        value={nameInput}
                        onChangeText={setNameInput}
                        style={styles.nameInput}
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleSaveName} style={styles.saveNameBtn}>
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.nameDisplayRow}>
                      <Text style={styles.profileName}>{currentUserName}</Text>
                      <TouchableOpacity onPress={() => setIsEditingName(true)} style={styles.editIconBtn}>
                        <Feather name="edit-2" size={14} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={styles.profileRole}>Active Family Member</Text>
                  {currentUserEmail ? (
                    <Text style={styles.profileEmail}>{currentUserEmail}</Text>
                  ) : null}
                  {currentUserPhone ? (
                    <Text style={styles.profilePhone}>📞 {currentUserPhone}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* 2. Map Styles Selection */}
            <Text style={styles.sectionHeader}>MAP CARTOGRAPHY STYLE</Text>
            <View style={styles.sectionCard}>
              {ALL_MAP_STYLES.map((style) => {
                const isSelected = style.id === activeMapStyle.id;
                return (
                  <TouchableOpacity
                    key={style.id}
                    activeOpacity={0.8}
                    onPress={() => onSelectMapStyle(style)}
                    style={[styles.styleOption, isSelected && styles.styleOptionSelected]}
                  >
                    <View style={styles.styleRadio}>
                      {isSelected && <View style={styles.styleRadioInner} />}
                    </View>
                    <View style={styles.styleTextContainer}>
                      <Text style={[styles.styleName, isSelected && styles.styleNameSelected]}>
                        {style.name}
                      </Text>
                      <Text style={styles.styleDesc}>{style.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Offline Cache Diagnostics */}
            <Text style={styles.sectionHeader}>OFFLINE MAP STORAGE & DATA</Text>
            <View style={styles.sectionCard}>
              <View style={styles.cacheRow}>
                <View>
                  <Text style={styles.cacheLabel}>Cached Raster Tiles</Text>
                  <Text style={styles.cacheValue}>
                    {cacheStats ? `${cacheStats.count} tiles • ${cacheStats.formattedSize}` : 'Calculating...'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleClearCache}
                  disabled={isClearingCache}
                  style={styles.clearCacheBtn}
                >
                  <Text style={styles.clearCacheText}>
                    {isClearingCache ? 'Clearing...' : 'Clear Cache'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Sign Out Button */}
            <TouchableOpacity activeOpacity={0.85} onPress={onSignOut} style={styles.signOutBtn}>
              <Ionicons name="log-out-outline" size={18} color={Colors.sos} />
              <Text style={styles.signOutText}>Sign Out from Life360</Text>
            </TouchableOpacity>
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
    maxHeight: '85%',
    paddingBottom: 32,
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
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#94A3B8',
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  nameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  editIconBtn: {
    padding: 4,
  },
  profileRole: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  profileEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  saveNameBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 6,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 12,
  },
  styleOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  styleRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  styleTextContainer: {
    flex: 1,
  },
  styleName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
  },
  styleNameSelected: {
    color: Colors.primary,
  },
  styleDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cacheLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
  },
  cacheValue: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  clearCacheBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  clearCacheText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.sosLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.sos,
  },
});
