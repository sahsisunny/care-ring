import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  ScrollView,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { MapStyleConfig, ALL_MAP_STYLES } from '../../models/MapStyle';
import { hapticService } from '../../services/HapticService';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Google Maps-style style icons mapping
const STYLE_ICONS: Record<string, { icon: string; iconType: 'ionicon' | 'material' | 'emoji'; color: string }> = {
  detailedOsm: { icon: '🗺️', iconType: 'emoji', color: '#4CAF50' },
  satellite: { icon: '🛰️', iconType: 'emoji', color: '#1565C0' },
  topographic: { icon: '⛰️', iconType: 'emoji', color: '#795548' },
  streetMap: { icon: '🛣️', iconType: 'emoji', color: '#FF9800' },
  cyclosm: { icon: '🚴', iconType: 'emoji', color: '#26C6DA' },
  humanitarian: { icon: '🌍', iconType: 'emoji', color: '#E53935' },
};

interface MapStylePickerModalProps {
  visible: boolean;
  activeStyle: MapStyleConfig;
  onSelectStyle: (style: MapStyleConfig) => void;
  onClose: () => void;
}

export const MapStylePickerModal: React.FC<MapStylePickerModalProps> = ({
  visible,
  activeStyle,
  onSelectStyle,
  onClose,
}) => {
  const { colors, isDark, isGlass } = useTheme();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 22,
          stiffness: 280,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSelectStyle = (style: MapStyleConfig) => {
    hapticService.light();
    onSelectStyle(style);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Dimmed backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Bottom Sheet Panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
            transform: [{ translateY: slideAnim }],
          },
          isDark ? styles.panelShadowDark : styles.panelShadowLight,
        ]}
      >
        {/* Header (Clean & plain with title and close button) */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textMain }]}>Map Type</Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Style grid — horizontal scrollable row (Google Maps style) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.styleScroll}
        >
          {ALL_MAP_STYLES.map((style) => {
            const isActive = style.id === activeStyle.id;
            const meta = STYLE_ICONS[style.id] ?? { icon: '🗺️', iconType: 'emoji', color: '#4CAF50' };

            return (
              <TouchableOpacity
                key={style.id}
                activeOpacity={0.8}
                onPress={() => handleSelectStyle(style)}
                style={styles.styleItem}
                accessibilityLabel={`Select ${style.name} map style`}
              >
                {/* Thumbnail / Preview Card */}
                <View
                  style={[
                    styles.thumbnailWrap,
                    isActive && styles.thumbnailWrapActive,
                    { borderColor: isActive ? colors.primary : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                  ]}
                >
                  {style.previewThumbnail ? (
                    <Image
                      source={{ uri: style.previewThumbnail }}
                      style={styles.thumbnailImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.thumbnailFallback, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
                      <Text style={styles.thumbnailEmoji}>{meta.icon}</Text>
                    </View>
                  )}

                  {/* Emoji overlay badge */}
                  <View
                    style={[
                      styles.thumbnailBadge,
                      { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.85)' },
                    ]}
                  >
                    <Text style={styles.thumbnailBadgeEmoji}>{meta.icon}</Text>
                  </View>

                  {/* Active checkmark */}
                  {isActive && (
                    <View style={[styles.activeCheckmark, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                {/* Label */}
                <Text
                  style={[
                    styles.styleLabel,
                    {
                      color: isActive ? colors.primary : colors.textMain,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {style.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Active style description */}
        <View style={[styles.descriptionRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
          <View style={styles.descriptionIcon}>
            <Text style={{ fontSize: 18 }}>{STYLE_ICONS[activeStyle.id]?.icon ?? '🗺️'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.descriptionTitle, { color: colors.textMain }]}>{activeStyle.name}</Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]} numberOfLines={2}>
              {activeStyle.description}
            </Text>
          </View>
        </View>

        {/* Bottom safe area padding */}
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 0,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 4,
    zIndex: 1,
  },
  panelShadowLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 24,
  },
  panelShadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleScroll: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
    flexDirection: 'row',
  },
  styleItem: {
    alignItems: 'center',
    width: 86,
  },
  thumbnailWrap: {
    width: 86,
    height: 72,
    borderRadius: 12,
    borderWidth: 2.5,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailWrapActive: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  thumbnailFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailEmoji: {
    fontSize: 26,
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailBadgeEmoji: {
    fontSize: 12,
  },
  activeCheckmark: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleLabel: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 15,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  descriptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  descriptionText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
