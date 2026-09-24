import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '../Avatar';
import { Colors } from '../../theme/colors';

interface ProfilePhotoModalProps {
  visible: boolean;
  currentName: string;
  currentAvatarUrl?: string | null;
  onClose: () => void;
  onSaveAvatar: (avatarUrl: string | null) => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  visible,
  currentName,
  currentAvatarUrl,
  onClose,
  onSaveAvatar,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl || null);

  // Keep state in sync with currentAvatarUrl when modal opens
  React.useEffect(() => {
    setAvatarUrl(currentAvatarUrl || null);
  }, [currentAvatarUrl, visible]);

  // 1. Direct upload from photo library / gallery
  const pickFromGallery = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photo Permission Needed',
            'Please grant access to your photo library to select a profile photo.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAvatarUrl(dataUri);
      }
    } catch (err) {
      console.warn('[ProfilePhotoModal] Gallery pick error:', err);
      Alert.alert('Upload Error', 'Could not access photo library. Please try again.');
    }
  };

  // 2. Direct capture using device camera
  const takePhotoWithCamera = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Needed',
            'Please grant camera access to take a profile picture.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const dataUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAvatarUrl(dataUri);
      }
    } catch (err) {
      console.warn('[ProfilePhotoModal] Camera error:', err);
      Alert.alert('Camera Error', 'Could not open camera on this device.');
    }
  };

  // 3. Remove photo to revert back to clean initials avatar
  const handleRemovePhoto = () => {
    setAvatarUrl(null);
  };

  // 4. Save Avatar
  const handleSave = () => {
    onSaveAvatar(avatarUrl);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Profile Avatar</Text>
              <Text style={styles.subtitle}>Photos are completely optional</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Interactive Avatar Preview */}
            <View style={styles.previewContainer}>
              <View style={styles.avatarWrapper}>
                <Avatar
                  name={currentName}
                  avatarUrl={avatarUrl}
                  size={96}
                  borderWidth={3.5}
                  borderColor={Colors.primary}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={pickFromGallery}
                  style={styles.avatarEditBadge}
                >
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={styles.previewLabel}>
                {avatarUrl
                  ? 'Custom photo selected'
                  : 'Initials avatar (Default • No photo needed)'}
              </Text>
            </View>

            {/* Direct Upload Action Buttons */}
            <View style={styles.buttonList}>
              {/* Choose from Library / Gallery */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={pickFromGallery}
                style={styles.actionBtnPrimary}
              >
                <Feather name="image" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnPrimaryText}>
                  {avatarUrl ? 'Choose Another Photo' : 'Upload from Library'}
                </Text>
              </TouchableOpacity>

              {/* Take Photo with Camera (if on mobile) */}
              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={takePhotoWithCamera}
                  style={styles.actionBtnSecondary}
                >
                  <Feather name="camera" size={18} color={Colors.primary} />
                  <Text style={styles.actionBtnSecondaryText}>Take Photo</Text>
                </TouchableOpacity>
              )}

              {/* Remove Photo (Revert to initials) */}
              {avatarUrl && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleRemovePhoto}
                  style={styles.actionBtnDestructive}
                >
                  <Feather name="trash-2" size={16} color="#EF4444" />
                  <Text style={styles.actionBtnDestructiveText}>
                    Remove Photo & Use Initials
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleSave}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save Profile Avatar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 12,
  },
  buttonList: {
    gap: 10,
    marginBottom: 16,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
  },
  actionBtnSecondaryText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  actionBtnDestructive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnDestructiveText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
