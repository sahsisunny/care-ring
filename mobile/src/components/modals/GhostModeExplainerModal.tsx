import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

interface GhostModeExplainerModalProps {
  visible: boolean;
  onClose: () => void;
  onEnableGhostMode?: () => void;
}

export const GhostModeExplainerModal: React.FC<GhostModeExplainerModalProps> = React.memo(({
  visible,
  onClose,
  onEnableGhostMode,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const statusBarHeight = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 36) : Math.max(insets.top, 44);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header Bar */}
        <View style={[styles.header, { paddingTop: statusBarHeight + 8, borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.tileBg }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color={colors.textMain} />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.textMain }]}>What is Ghost Mode?</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Discreet Personal Privacy</Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner with Generated Graphic Image */}
          <View style={[styles.imageCard, { borderColor: colors.cardBorder }]}>
            <Image
              source={require('../../../assets/ghost_mode_guide.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlayBadge}>
              <Text style={styles.imageOverlayBadgeText}>🔒 100% PRIVATE TO YOU</Text>
            </View>
          </View>

          {/* Key Rule Highlight Banner */}
          <View
            style={[
              styles.guaranteeBanner,
              {
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : '#F5F3FF',
                borderColor: isDark ? 'rgba(139, 92, 246, 0.4)' : '#DDD6FE',
              },
            ]}
          >
            <View style={styles.guaranteeIconWrap}>
              <Ionicons name="notifications-off" size={22} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.guaranteeTitle, { color: isDark ? '#DDD6FE' : '#6D28D9' }]}>
                Zero Notifications to Circle Members
              </Text>
              <Text style={[styles.guaranteeDesc, { color: colors.textSecondary }]}>
                When you activate Ghost Mode, <Text style={{ fontWeight: '700', color: colors.textMain }}>no alert, notification, or indicator</Text> is ever sent to other circle members. To everyone else, everything looks completely ordinary. Only you see your active status.
              </Text>
            </View>
          </View>

          {/* How It Works Section */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>How Ghost Mode Works</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              Control your location resolution while remaining a member of your family circle.
            </Text>
          </View>

          {/* Side-by-Side Comparison */}
          <View style={styles.comparisonContainer}>
            {/* Mode 1: Precise Mode */}
            <View style={[styles.comparisonCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.comparisonHeader}>
                <View style={[styles.modePill, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                  <Ionicons name="navigate-circle" size={16} color="#10B981" />
                  <Text style={[styles.modePillText, { color: '#10B981' }]}>Normal Mode</Text>
                </View>
              </View>
              <Text style={[styles.comparisonTitle, { color: colors.textMain }]}>Precise Real-Time GPS</Text>
              <Text style={[styles.comparisonText, { color: colors.textSecondary }]}>
                • Exact pinpoint pin on map{'\n'}
                • Street address and building{'\n'}
                • Live vehicle speed & motion telemetry{'\n'}
                • Instant arrival & departure alerts
              </Text>
            </View>

            {/* Mode 2: Ghost Mode */}
            <View
              style={[
                styles.comparisonCard,
                {
                  backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#FAF5FF',
                  borderColor: isDark ? '#8B5CF6' : '#C4B5FD',
                },
              ]}
            >
              <View style={styles.comparisonHeader}>
                <View style={[styles.modePill, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.25)' : '#EDE9FE' }]}>
                  <Text style={{ fontSize: 13, marginRight: 4 }}>👻</Text>
                  <Text style={[styles.modePillText, { color: '#8B5CF6' }]}>Ghost Mode</Text>
                </View>
              </View>
              <Text style={[styles.comparisonTitle, { color: colors.textMain }]}>Cloaked Privacy Zone</Text>
              <Text style={[styles.comparisonText, { color: colors.textSecondary }]}>
                • Exact street & building hidden{'\n'}
                • Only approximate ~0.5km - 8km zone{'\n'}
                • Speed and movement veiled{'\n'}
                • <Text style={{ fontWeight: '700', color: '#8B5CF6' }}>Zero alerts sent to other members</Text>
              </Text>
            </View>
          </View>

          {/* Real-World Examples */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Real-World Examples</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              Practical situations where Ghost Mode provides peace of mind.
            </Text>
          </View>

          {/* Example 1 */}
          <View style={[styles.exampleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.exampleIconRow}>
              <View style={[styles.exampleIconBox, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
                <Text style={{ fontSize: 20 }}>🎁</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.exampleCardTitle, { color: colors.textMain }]}>
                  Example 1: Buying a Surprise Birthday Gift
                </Text>
                <Text style={[styles.exampleCardSubtitle, { color: colors.textMuted }]}>
                  Shopping without spoiling the surprise
                </Text>
              </View>
            </View>
            <Text style={[styles.exampleCardBody, { color: colors.textSecondary }]}>
              You want to visit a jewelry store or bakery to buy a birthday present for a family member. Turn on Ghost Mode for 2 hours. Your circle members only see a generalized neighborhood area without seeing which specific store you visited, and <Text style={{ fontWeight: '700', color: colors.textMain }}>they receive no notification</Text> that you activated ghost mode.
            </Text>
          </View>

          {/* Example 2 */}
          <View style={[styles.exampleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.exampleIconRow}>
              <View style={[styles.exampleIconBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#DBEAFE' }]}>
                <Text style={{ fontSize: 20 }}>☕</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.exampleCardTitle, { color: colors.textMain }]}>
                  Example 2: Personal Me-Time & Solitude
                </Text>
                <Text style={[styles.exampleCardSubtitle, { color: colors.textMuted }]}>
                  Unwind without feeling micro-managed
                </Text>
              </View>
            </View>
            <Text style={[styles.exampleCardBody, { color: colors.textSecondary }]}>
              Taking a quiet evening walk, reading at a cafe, or visiting a private appointment. Ghost Mode gives you full personal autonomy. You do not have to leave the circle or turn off location services completely.
            </Text>
          </View>

          {/* Example 3 */}
          <View style={[styles.exampleCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.exampleIconRow}>
              <View style={[styles.exampleIconBox, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#D1FAE5' }]}>
                <Text style={{ fontSize: 20 }}>🚗</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.exampleCardTitle, { color: colors.textMain }]}>
                  Example 3: Commute & Downtime
                </Text>
                <Text style={[styles.exampleCardSubtitle, { color: colors.textMuted }]}>
                  Avoid unwanted questions during travel
                </Text>
              </View>
            </View>
            <Text style={[styles.exampleCardBody, { color: colors.textSecondary }]}>
              Moving between meetings or commuting. Exact road and velocity tracking are hidden, preventing intrusive notifications without triggering unnecessary worry.
            </Text>
          </View>

          {/* Safety First Card */}
          <View
            style={[
              styles.safetyCard,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={24} color="#10B981" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.safetyCardTitle, { color: colors.textMain }]}>
                Emergency SOS & Crash Override Guarantee
              </Text>
              <Text style={[styles.safetyCardDesc, { color: colors.textSecondary }]}>
                Your safety is paramount. If you press the Emergency SOS button or if an automotive crash is detected, Ghost Mode automatically pops instantly. Your exact GPS coordinates will be immediately broadcast to family members and emergency response.
              </Text>
            </View>
          </View>

          {/* Action Button */}
          {onEnableGhostMode && (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                onClose();
                onEnableGhostMode();
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>👻</Text>
              <Text style={styles.actionBtnText}>Configure Ghost Mode</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  imageCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 16,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: 200,
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  imageOverlayBadgeText: {
    color: '#DDD6FE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  guaranteeBanner: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  guaranteeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  guaranteeTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  guaranteeDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  comparisonContainer: {
    marginBottom: 20,
    gap: 12,
  },
  comparisonCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  comparisonHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  comparisonTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  comparisonText: {
    fontSize: 13,
    lineHeight: 20,
  },
  exampleCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  exampleIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  exampleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exampleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  exampleCardSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  exampleCardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  safetyCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  safetyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  safetyCardDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  actionBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
