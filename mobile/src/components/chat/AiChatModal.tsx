import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import {
  aiChatService,
  ChatMessageItem,
  AiChatContext,
  AiActionIntent,
} from '../../services/AiChatService';
import { aiSettingsService, AiSettingsConfig } from '../../services/AiSettingsService';
import { AiSettingsModal } from '../modals/AiSettingsModal';
import { FormattedChatText } from './FormattedChatText';
import { getBackendHttpUrl } from '../../services/backendUrl';
import { authService } from '../../services/AuthService';

// Inline Driving Report Card rendered directly inside the chat bubble
const InlineDrivingReportCard = ({
  action,
  colors,
}: {
  action: AiActionIntent;
  colors: any;
}) => {
  const stats = action.drivingStats || {
    safetyScore: 92,
    topSpeedKm: 45,
    totalDistanceKm: 14.2,
    tripsCount: 2,
    hardBrakingCount: 0,
    rapidAccelCount: 0,
  };

  const scoreColor =
    stats.safetyScore >= 85 ? '#10B981' : stats.safetyScore >= 70 ? '#F59E0B' : '#EF4444';

  return (
    <View style={[styles.inlineCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.inlineCardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[styles.inlineCardIconBox, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="speedometer" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.inlineCardTitle, { color: colors.textMain }]} numberOfLines={1}>
            {action.memberName || 'Driver'} Driving Report
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '18', borderColor: scoreColor }]}>
          <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>
            {stats.safetyScore}/100 Score
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Top Speed</Text>
          <Text style={[styles.statValue, { color: colors.textMain }]}>{stats.topSpeedKm} km/h</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</Text>
          <Text style={[styles.statValue, { color: colors.textMain }]}>{stats.totalDistanceKm} km</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Trips</Text>
          <Text style={[styles.statValue, { color: colors.textMain }]}>{stats.tripsCount}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hard Braking</Text>
          <Text style={[styles.statValue, { color: stats.hardBrakingCount > 0 ? '#EF4444' : colors.textMain }]}>
            {stats.hardBrakingCount}
          </Text>
        </View>
      </View>

      <View style={[styles.cardFooterBanner, { backgroundColor: colors.card }]}>
        <Ionicons name="shield-checkmark" size={14} color="#10B981" />
        <Text style={[styles.cardFooterText, { color: colors.textSecondary }]}>
          {stats.safetyScore >= 85 ? 'Safe and smooth driving detected' : 'Moderate driving patterns'}
        </Text>
      </View>
    </View>
  );
};

// Inline Timeline Card rendered directly inside the chat bubble
const InlineTimelineCard = ({
  action,
  colors,
}: {
  action: AiActionIntent;
  colors: any;
}) => {
  const timeline = action.timelineData;
  const stops = timeline?.stops || [];
  const trips = timeline?.trips || [];

  return (
    <View style={[styles.inlineCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={styles.inlineCardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <View style={[styles.inlineCardIconBox, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="map" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.inlineCardTitle, { color: colors.textMain }]} numberOfLines={1}>
            {action.memberName || 'Member'} Daily Timeline
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Places Visited</Text>
          <Text style={[styles.statValue, { color: colors.textMain }]}>{timeline?.stopCount ?? stops.length}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Trips Taken</Text>
          <Text style={[styles.statValue, { color: colors.textMain }]}>{timeline?.tripCount ?? trips.length}</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.card, width: '100%' }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Traveled Today</Text>
          <Text style={[styles.statValue, { color: colors.textMain }]}>{timeline?.totalDistanceKm || 0} km</Text>
        </View>
      </View>

      {/* Render Stops list */}
      {stops.length > 0 ? (
        <View style={styles.timelineList}>
          {stops.slice(0, 4).map((stop, sIdx) => (
            <View key={`tl_stop_${sIdx}`} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.timelineRowTitle, { color: colors.textMain }]} numberOfLines={1}>
                  {stop.title || stop.address}
                </Text>
                <Text style={[styles.timelineRowSub, { color: colors.textSecondary }]}>
                  {stop.startTime} • {stop.durationMinutes} mins stayed
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ paddingVertical: 6, alignItems: 'center' }}>
          <Text style={[styles.cardFooterText, { color: colors.textSecondary }]}>
            Member has been stationary or has no recent trips recorded.
          </Text>
        </View>
      )}
    </View>
  );
};

interface AiChatModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToVoice: () => void;
  context?: AiChatContext;
  onExecuteAction?: (action: AiActionIntent) => void;
}

export const AiChatModal: React.FC<AiChatModalProps> = ({
  visible,
  onClose,
  onSwitchToVoice,
  context,
  onExecuteAction,
}) => {
  const { colors, isDark } = useTheme();

  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content:
        'Namaste! I am **CareAI**, your personal family intelligence and safety assistant.\n\nYou can ask me about family locations, driving records, timeline routes, or ask me to manage your circle, set nicknames, or trigger safety alerts!',
      timestamp: Date.now(),
      provider: 'CareAI',
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [config, setConfig] = useState<AiSettingsConfig>(aiSettingsService.getSettings());

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      aiSettingsService.loadSettings().then(setConfig);
    }
  }, [visible]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessageItem = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await aiChatService.sendChatMessage(history, {
        voiceMode: false,
        language: config.speechLanguage,
        context,
      });

      let finalAction = res.action;

      // If driving report or timeline was requested, enrich with live client fetch if missing
      if (finalAction?.type === 'VIEW_DRIVING_REPORT' && !finalAction.drivingStats) {
        try {
          const targetMem = context?.members?.find(
            (m) =>
              (finalAction?.memberId && m.id === finalAction.memberId) ||
              (finalAction?.memberName && m.name.toLowerCase().includes(finalAction.memberName.toLowerCase())) ||
              (finalAction?.memberName && m.nickname?.toLowerCase().includes(finalAction.memberName.toLowerCase()))
          ) || context?.members?.[0];

          if (targetMem?.id && context?.circleId) {
            const report = await authService.fetchDriverReport(getBackendHttpUrl(), context.circleId, targetMem.id);
            if (report) {
              finalAction.drivingStats = {
                topSpeedKm: report.topSpeedKm || 0,
                totalDistanceKm: report.totalDistanceKm || 0,
                safetyScore: report.weeklyScore || 90,
                tripsCount: report.totalTrips || report.trips?.length || 0,
                hardBrakingCount: report.hardBraking?.count || 0,
                rapidAccelCount: report.rapidAccel?.count || 0,
              };
            }
          }
        } catch (_) {}
      } else if (finalAction?.type === 'VIEW_TIMELINE' && !finalAction.timelineData) {
        try {
          const targetMem = context?.members?.find(
            (m) =>
              (finalAction?.memberId && m.id === finalAction.memberId) ||
              (finalAction?.memberName && m.name.toLowerCase().includes(finalAction.memberName.toLowerCase())) ||
              (finalAction?.memberName && m.nickname?.toLowerCase().includes(finalAction.memberName.toLowerCase()))
          ) || context?.members?.[0];

          if (targetMem?.id && context?.circleId) {
            const tl = await authService.fetchMemberTimeline(getBackendHttpUrl(), context.circleId, targetMem.id);
            if (tl) {
              finalAction.timelineData = {
                userId: tl.userId,
                totalDistanceKm: tl.totalDistanceKm || 0,
                stopCount: tl.stopCount || tl.timeline?.filter((t) => t.type === 'stay').length || 0,
                tripCount: tl.tripCount || tl.timeline?.filter((t) => t.type === 'trip').length || 0,
                stops: tl.timeline?.filter((t) => t.type === 'stay').map((s) => ({
                  title: s.title,
                  address: s.address,
                  startTime: new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  endTime: new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  durationMinutes: s.durationMinutes || 10,
                })),
                trips: tl.timeline?.filter((t) => t.type === 'trip').map((t) => ({
                  fromAddress: t.fromAddress || 'Departure Location',
                  toAddress: t.toAddress || 'Arrival Location',
                  distanceKm: t.distanceKm || 0,
                  durationMinutes: t.durationMinutes || 5,
                  topSpeed: t.topSpeed || 0,
                })),
              };
            }
          }
        } catch (_) {}
      }

      const aiMsg: ChatMessageItem = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: Date.now(),
        provider: res.provider,
        action: finalAction,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // DO NOT open any external modal or page for VIEW_DRIVING_REPORT or VIEW_TIMELINE!
      if (finalAction && onExecuteAction && finalAction.type !== 'VIEW_DRIVING_REPORT' && finalAction.type !== 'VIEW_TIMELINE') {
        onExecuteAction(finalAction);
      }
    } catch (err: any) {
      const errorMsg: ChatMessageItem = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to get response. Please check your AI API key in Settings.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Dynamic interactive suggestions based on actual circle context
  const quickSuggestions = React.useMemo(() => {
    const list: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; prompt: string }> = [];

    const otherMembers = context?.members?.filter((m) => !m.isSelf) || [];
    if (otherMembers.length > 0) {
      const firstMember = otherMembers[0];
      const memberName = firstMember.nickname || firstMember.name.split(' ')[0];
      list.push({
        label: `Where is ${memberName}?`,
        icon: 'location-outline',
        prompt: `Where is ${memberName} right now and what is their current status?`,
      });
      list.push({
        label: `${memberName}'s Driving Record`,
        icon: 'speedometer-outline',
        prompt: `Show ${memberName}'s driving report and safety scores.`,
      });
      list.push({
        label: `${memberName}'s Timeline`,
        icon: 'time-outline',
        prompt: `Show timeline and route for ${memberName}.`,
      });
    }

    list.push({
      label: 'Check Family Safety',
      icon: 'shield-checkmark-outline',
      prompt: 'Are all circle members safe right now?',
    });
    list.push({
      label: 'Who is Driving?',
      icon: 'car-sport-outline',
      prompt: 'Who in our circle is currently driving or moving?',
    });
    list.push({
      label: 'Battery Levels',
      icon: 'battery-charging-outline',
      prompt: 'Which family member has the lowest battery level?',
    });
    list.push({
      label: 'Saved Places',
      icon: 'home-outline',
      prompt: 'What places are saved in this circle and who is currently there?',
    });
    list.push({
      label: 'Join Circle',
      icon: 'enter-outline',
      prompt: 'I want to join a circle with an invite code.',
    });

    return list;
  }, [context?.members, context?.savedPlaces]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.aiAvatar, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </View>
              <View style={styles.headerTexts}>
                <View style={styles.titleBadgeRow}>
                  <Text style={[styles.headerTitle, { color: colors.textMain }]}>CareAI</Text>
                  <View style={[styles.proBadge, { backgroundColor: colors.primary + '25' }]}>
                    <Text style={[styles.proBadgeText, { color: colors.primary }]}>INTELLIGENCE</Text>
                  </View>
                </View>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                  {context?.circleName ? `Active in "${context.circleName}"` : 'Family Safety & Circles Companion'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {/* Switch to Voice Mode */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary + '18' }]}
                onPress={onSwitchToVoice}
                activeOpacity={0.7}
              >
                <Ionicons name="mic" size={19} color={colors.primary} />
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card }]}
                onPress={() => setShowSettings(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="options-outline" size={19} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Close */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.card }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={colors.textMain} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages List */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesContainer}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userMessageRow : styles.aiMessageRow,
                  ]}
                >
                  {!isUser && (
                    <View style={[styles.msgAvatar, { backgroundColor: colors.primary + '25' }]}>
                      <Ionicons name="sparkles" size={13} color={colors.primary} />
                    </View>
                  )}

                  <View
                    style={[
                      styles.messageBubble,
                      isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                        : [
                            styles.aiBubble,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                            },
                          ],
                    ]}
                  >
                    {isUser ? (
                      <Text style={[styles.userMessageText, { color: '#FFFFFF' }]}>
                        {item.content}
                      </Text>
                    ) : (
                      <FormattedChatText
                        content={item.content}
                        textColor={colors.textMain}
                        accentColor={colors.primary}
                        fontSize={14}
                      />
                    )}

                    {/* Inline Driving Report Card (Shown right inside chat!) */}
                    {!isUser && item.action?.type === 'VIEW_DRIVING_REPORT' && (
                      <InlineDrivingReportCard action={item.action} colors={colors} />
                    )}

                    {/* Inline Timeline Card (Shown right inside chat!) */}
                    {!isUser && item.action?.type === 'VIEW_TIMELINE' && (
                      <InlineTimelineCard action={item.action} colors={colors} />
                    )}

                    {/* Action Execution Button/Badge for other in-app actions */}
                    {!isUser && item.action && item.action.type !== 'VIEW_DRIVING_REPORT' && item.action.type !== 'VIEW_TIMELINE' && (
                      <TouchableOpacity
                        style={[styles.actionBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                        activeOpacity={0.75}
                        onPress={() => item.action && onExecuteAction?.(item.action)}
                      >
                        <Ionicons name="flash" size={14} color={colors.primary} />
                        <Text style={[styles.actionBadgeText, { color: colors.primary }]}>
                          {item.action.type === 'SET_NICKNAME' && `Set Nickname: "${item.action.nickname}"`}
                          {item.action.type === 'REMOVE_MEMBER' && `Remove ${item.action.memberName || 'Member'}`}
                          {item.action.type === 'JOIN_CIRCLE' && `Join Circle (${item.action.inviteCode || 'Code'})`}
                          {item.action.type === 'CREATE_CIRCLE' && `Create Circle`}
                          {item.action.type === 'INVITE_MEMBER' && `Invite Member`}
                          {item.action.type === 'TRIGGER_SOS' && `Emergency SOS`}
                          {item.action.type === 'CREATE_BUBBLE' && `Privacy Bubble`}
                          {item.action.type === 'ADD_PLACE' && `Save Place`}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    )}

                    {!isUser && (
                      <View style={styles.bubbleFooter}>
                        {item.provider && (
                          <Text style={[styles.providerTag, { color: colors.textSecondary }]}>
                            {item.provider}
                          </Text>
                        )}
                        <Text style={[styles.timeTag, { color: colors.textSecondary }]}>
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />

          {/* Loading Indicator */}
          {isSending && (
            <View style={[styles.loadingBar, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                CareAI is analyzing live circle telemetry...
              </Text>
            </View>
          )}

          {/* Interactive Suggestions Chips Carousel */}
          <View style={styles.suggestionsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {quickSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`sug_${idx}`}
                  style={[
                    styles.suggestionChip,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSendMessage(item.prompt)}
                >
                  <Ionicons name={item.icon} size={13} color={colors.primary} style={styles.chipIcon} />
                  <Text style={[styles.suggestionText, { color: colors.textMain }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={[styles.inputContainer, { borderTopColor: colors.cardBorder, backgroundColor: colors.card }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.card,
                  color: colors.textMain,
                  borderColor: colors.cardBorder,
                },
              ]}
              placeholder="Ask CareAI about members, safety, or actions..."
              placeholderTextColor={colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
              multiline={false}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() && !isSending ? colors.primary : colors.card },
              ]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isSending}
              activeOpacity={0.7}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() && !isSending ? '#FFFFFF' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* AI Settings Modal */}
      <AiSettingsModal
        visible={showSettings}
        onClose={() => {
          setShowSettings(false);
          aiSettingsService.loadSettings().then(setConfig);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTexts: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  proBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    maxWidth: '92%',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
  },
  aiMessageRow: {
    alignSelf: 'flex-start',
  },
  msgAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '92%',
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  userMessageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  actionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 4,
  },
  providerTag: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timeTag: {
    fontSize: 10,
  },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
  },
  loadingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  suggestionsWrapper: {
    paddingVertical: 8,
  },
  suggestionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: 6,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    width: '100%',
  },
  inlineCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  inlineCardIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  statBox: {
    flex: 1,
    minWidth: '46%',
    padding: 8,
    borderRadius: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardFooterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 6,
  },
  cardFooterText: {
    fontSize: 11,
    fontWeight: '500',
  },
  timelineList: {
    marginTop: 6,
    gap: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineRowTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineRowSub: {
    fontSize: 10,
  },
});
