import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

interface SavePlaceModalProps {
  visible: boolean;
  onClose: () => void;
  initialAddress?: string;
  latitude?: number;
  longitude?: number;
  onSavePlace: (place: {
    name: string;
    category: 'home' | 'work' | 'school' | 'gym' | 'other';
    radiusMeters: number;
    notifyOnEnter: boolean;
    notifyOnExit: boolean;
    latitude: number;
    longitude: number;
  }) => void;
}

export const SavePlaceModal: React.FC<SavePlaceModalProps> = ({
  visible,
  onClose,
  initialAddress = '',
  latitude = 12.9095,
  longitude = 77.6753,
  onSavePlace,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'home' | 'work' | 'school' | 'gym' | 'other'>('home');
  const [radiusMeters, setRadiusMeters] = useState(200);
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(true);

  const categories = [
    { key: 'home', label: 'Home', icon: 'home-outline' },
    { key: 'work', label: 'Work', icon: 'briefcase-outline' },
    { key: 'school', label: 'School', icon: 'school-outline' },
    { key: 'gym', label: 'Gym', icon: 'fitness-outline' },
    { key: 'other', label: 'Other', icon: 'location-outline' },
  ];

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Place Name Required', 'Please enter a name for this place (e.g. Home, Office).');
      return;
    }

    onSavePlace({
      name: name.trim(),
      category,
      radiusMeters,
      notifyOnEnter,
      notifyOnExit,
      latitude,
      longitude,
    });

    onClose();
    setName('');
    Alert.alert('📍 Place Saved', `"${name}" added with unlimited geofencing alerts.`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View>
              <View style={styles.unlockedBadge}>
                <Ionicons name="sparkles" size={11} color="#7C3AED" />
                <Text style={styles.unlockedBadgeText}>UNLIMITED PLACES UNLOCKED</Text>
              </View>
              <Text style={styles.title}>Save Place</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {initialAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.fieldLabel}>Place Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Home, Work, Grandma's, College"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  activeOpacity={0.8}
                  onPress={() => {
                    setCategory(c.key as any);
                    if (!name) setName(c.label);
                  }}
                  style={[
                    styles.categoryBtn,
                    category === c.key && styles.activeCategoryBtn,
                  ]}
                >
                  <Ionicons
                    name={c.icon as any}
                    size={18}
                    color={category === c.key ? Colors.primary : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
                      category === c.key && styles.activeCategoryLabel,
                    ]}
                  >
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Geofence Radius</Text>
            <View style={styles.radiusRow}>
              {[100, 200, 500, 1000].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRadiusMeters(r)}
                  style={[styles.radiusBtn, radiusMeters === r && styles.activeRadiusBtn]}
                >
                  <Text
                    style={[styles.radiusText, radiusMeters === r && styles.activeRadiusText]}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Notify on Arrival</Text>
                <Text style={styles.toggleDesc}>Alert circle when members arrive here</Text>
              </View>
              <Switch
                value={notifyOnEnter}
                onValueChange={setNotifyOnEnter}
                trackColor={{ true: Colors.primary, false: '#CBD5E1' }}
              />
            </View>

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Notify on Departure</Text>
                <Text style={styles.toggleDesc}>Alert circle when members leave this place</Text>
              </View>
              <Switch
                value={notifyOnExit}
                onValueChange={setNotifyOnExit}
                trackColor={{ true: Colors.primary, false: '#CBD5E1' }}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSave}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>Save Place</Text>
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
    paddingBottom: 36,
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
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  unlockedBadgeText: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
    maxWidth: 260,
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
    paddingTop: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  categoryBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  activeCategoryBtn: {
    backgroundColor: '#EDE9FE',
    borderColor: Colors.primary,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  activeCategoryLabel: {
    color: Colors.primary,
    fontWeight: '800',
  },
  radiusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  radiusBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeRadiusBtn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radiusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  activeRadiusText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
