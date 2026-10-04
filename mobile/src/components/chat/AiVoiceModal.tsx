import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { audioVoiceEngine } from '../../services/AudioVoiceEngine';
import {
  aiChatService,
  AiChatContext,
  AiActionIntent,
} from '../../services/AiChatService';
import { aiSettingsService, AiLanguage } from '../../services/AiSettingsService';
import { AiSettingsModal } from '../modals/AiSettingsModal';

interface AiVoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToChat: () => void;
  context?: AiChatContext;
  onExecuteAction?: (action: AiActionIntent) => void;
}

type VoiceStatus = 'idle' | 'listening' | 'analyzing' | 'speaking' | 'paused';

export const AiVoiceModal: React.FC<AiVoiceModalProps> = ({
  visible,
  onClose,
  onSwitchToChat,
  context,
  onExecuteAction,
}) => {
  const { colors, isDark } = useTheme();

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [userCaption, setUserCaption] = useState<string>('');
  const [aiCaption, setAiCaption] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('Listening continuously...');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<AiLanguage>('auto');
  const [activeAction, setActiveAction] = useState<AiActionIntent | null>(null);

  const conversationHistory = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const isContinuousActive = useRef<boolean>(true);
  const statusRef = useRef<VoiceStatus>('idle');
  statusRef.current = voiceStatus;

  // Soundwave animated bars
  const barAnim1 = useRef(new Animated.Value(0.2)).current;
  const barAnim2 = useRef(new Animated.Value(0.4)).current;
  const barAnim3 = useRef(new Animated.Value(0.6)).current;
  const barAnim4 = useRef(new Animated.Value(0.8)).current;
  const barAnim5 = useRef(new Animated.Value(0.3)).current;

  // Load language settings on modal open & auto-start continuous session
  useEffect(() => {
    if (visible) {
      const settings = aiSettingsService.getSettings();
      setSelectedLanguage(settings.speechLanguage);
      isContinuousActive.current = true;
      setUserCaption('');
      setAiCaption('');
      setActiveAction(null);
      startListeningLoop();
    } else {
      isContinuousActive.current = false;
      audioVoiceEngine.stopPlayback();
      audioVoiceEngine.stopListening();
      setVoiceStatus('idle');
    }
  }, [visible]);

  // Animate soundwave bars with real volume
  useEffect(() => {
    const isAudioActive = voiceStatus === 'listening' || voiceStatus === 'speaking';
    const mult = isAudioActive ? Math.max(0.25, audioVolume) : 0.15;

    Animated.parallel([
      Animated.timing(barAnim1, { toValue: Math.min(1.0, mult * 1.1 + 0.1), duration: 100, useNativeDriver: false }),
      Animated.timing(barAnim2, { toValue: Math.min(1.0, mult * 1.5 + 0.2), duration: 100, useNativeDriver: false }),
      Animated.timing(barAnim3, { toValue: Math.min(1.0, mult * 1.8 + 0.3), duration: 100, useNativeDriver: false }),
      Animated.timing(barAnim4, { toValue: Math.min(1.0, mult * 1.3 + 0.2), duration: 100, useNativeDriver: false }),
      Animated.timing(barAnim5, { toValue: Math.min(1.0, mult * 0.9 + 0.1), duration: 100, useNativeDriver: false }),
    ]).start();
  }, [audioVolume, voiceStatus]);

  // Continuous Listening Loop
  const startListeningLoop = async () => {
    if (!isContinuousActive.current) return;

    setStatusText('Listening... speak in Hindi or English');
    setVoiceStatus('listening');

    const micGranted = await audioVoiceEngine.requestMicPermission();
    if (!micGranted) {
      setVoiceStatus('paused');
      setStatusText('Microphone access required. Please enable in Settings.');
      return;
    }

    audioVoiceEngine.startListening(selectedLanguage, {
      onVolumeChange: (vol) => {
        setAudioVolume(vol);
      },
      onResult: (transcript, isFinal) => {
        if (!transcript) return;
        setUserCaption(transcript);

        // When user pauses speaking (final speech segment detected)
        if (isFinal && transcript.trim().length > 0) {
          handleUserSpeech(transcript.trim());
        }
      },
      onError: (err) => {
        // Auto-recover continuous listening
        if (isContinuousActive.current && statusRef.current === 'listening') {
          setTimeout(() => {
            if (isContinuousActive.current) startListeningLoop();
          }, 800);
        }
      },
      onEnd: () => {
        // Keep listening active unless analyzing or speaking
        if (isContinuousActive.current && statusRef.current === 'listening') {
          startListeningLoop();
        }
      },
    });
  };

  const handleUserSpeech = async (spokenText: string) => {
    if (!spokenText || statusRef.current === 'analyzing' || statusRef.current === 'speaking') return;

    // Stop listening during processing
    audioVoiceEngine.stopListening();
    setVoiceStatus('analyzing');
    setStatusText('CareAI is thinking...');
    setUserCaption(spokenText);

    conversationHistory.current.push({ role: 'user', content: spokenText });

    try {
      // 1. Send clean text directly to backend (NO heavy audio files)
      const res = await aiChatService.sendChatMessage(conversationHistory.current, {
        voiceMode: true,
        language: selectedLanguage,
        context,
      });

      const reply = res.reply;
      conversationHistory.current.push({ role: 'assistant', content: reply });
      setAiCaption(reply);

      // Save action if returned
      if (res.action) {
        setActiveAction(res.action);
        onExecuteAction?.(res.action);
      }

      // 2. Synthesize speech and play aloud
      setVoiceStatus('speaking');
      setStatusText('CareAI speaking...');

      try {
        const ttsData = await aiChatService.synthesizeSpeech(reply);
        if (ttsData.audioDataUri) {
          await audioVoiceEngine.playSpeechAudio(ttsData.audioDataUri, {
            onFrequency: (freq) => setAudioVolume(freq),
            onFinish: () => onFinishedSpeaking(),
            onError: () => onFinishedSpeaking(),
          });
        } else {
          // Native device fallback
          await audioVoiceEngine.speakNativeText(reply, selectedLanguage, {
            onFrequency: (freq) => setAudioVolume(freq),
            onFinish: () => onFinishedSpeaking(),
            onError: () => onFinishedSpeaking(),
          });
        }
      } catch (_) {
        // Native speech fallback
        await audioVoiceEngine.speakNativeText(reply, selectedLanguage, {
          onFrequency: (freq) => setAudioVolume(freq),
          onFinish: () => onFinishedSpeaking(),
          onError: () => onFinishedSpeaking(),
        });
      }
    } catch (err: any) {
      setAiCaption(`Sorry: ${err.message || 'Could not connect to CareAI.'}`);
      setTimeout(() => onFinishedSpeaking(), 1500);
    }
  };

  // Called when CareAI finishes speaking: immediately resume continuous listening!
  const onFinishedSpeaking = () => {
    setAudioVolume(0);
    if (isContinuousActive.current) {
      startListeningLoop();
    } else {
      setVoiceStatus('paused');
      setStatusText('Paused. Tap mic to resume.');
    }
  };

  // Toggle continuous mic mute/unmute
  const toggleMic = () => {
    if (voiceStatus === 'listening') {
      isContinuousActive.current = false;
      audioVoiceEngine.stopListening();
      setVoiceStatus('paused');
      setStatusText('Listening paused. Tap mic to talk.');
    } else {
      isContinuousActive.current = true;
      audioVoiceEngine.stopPlayback();
      startListeningLoop();
    }
  };

  // Suggestions for voice mode
  const voiceSuggestions = React.useMemo(() => {
    const list: string[] = [];
    const otherMembers = context?.members?.filter((m) => !m.isSelf) || [];
    if (otherMembers.length > 0) {
      const first = otherMembers[0];
      const name = first.nickname || first.name.split(' ')[0];
      list.push(`Where is ${name}?`);
      list.push(`Show ${name}'s driving score`);
      list.push(`Show ${name}'s timeline`);
    }
    list.push('Are all members safe?');
    list.push('Who is driving right now?');
    list.push('Check battery levels');
    list.push('Join circle');
    return list;
  }, [context?.members]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.careAiBadge, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textMain }]}>CareAI Voice</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Continuous Voice Mode
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
                onPress={onSwitchToChat}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textMain} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
                onPress={() => setShowSettings(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={colors.textMain} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIndicator,
                voiceStatus === 'listening' && { backgroundColor: '#10B981' },
                voiceStatus === 'analyzing' && { backgroundColor: '#F59E0B' },
                voiceStatus === 'speaking' && { backgroundColor: colors.primary },
                voiceStatus === 'paused' && { backgroundColor: '#6B7280' },
              ]}
            />
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              {statusText}
            </Text>
          </View>

          {/* Dynamic Interactive Soundwave Visualizer */}
          <View style={styles.visualizerContainer}>
            <Animated.View
              style={[
                styles.soundBar,
                {
                  backgroundColor: colors.primary,
                  height: barAnim1.interpolate({ inputRange: [0, 1], outputRange: [12, 60] }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.soundBar,
                {
                  backgroundColor: colors.primary,
                  height: barAnim2.interpolate({ inputRange: [0, 1], outputRange: [18, 80] }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.soundBar,
                {
                  backgroundColor: colors.primary,
                  height: barAnim3.interpolate({ inputRange: [0, 1], outputRange: [24, 100] }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.soundBar,
                {
                  backgroundColor: colors.primary,
                  height: barAnim4.interpolate({ inputRange: [0, 1], outputRange: [18, 80] }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.soundBar,
                {
                  backgroundColor: colors.primary,
                  height: barAnim5.interpolate({ inputRange: [0, 1], outputRange: [12, 60] }),
                },
              ]}
            />
          </View>

          {/* Live Captions Display */}
          <View style={[styles.captionsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC' }]}>
            {userCaption ? (
              <View style={styles.captionBlock}>
                <View style={styles.captionSpeakerRow}>
                  <Ionicons name="person" size={12} color={colors.textSecondary} />
                  <Text style={[styles.captionSpeaker, { color: colors.textSecondary }]}>You</Text>
                </View>
                <Text style={[styles.userCaptionText, { color: colors.textMain }]}>
                  "{userCaption}"
                </Text>
              </View>
            ) : null}

            {voiceStatus === 'analyzing' && (
              <View style={styles.analyzingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.analyzingText, { color: colors.textSecondary }]}>
                  CareAI is processing...
                </Text>
              </View>
            )}

            {aiCaption ? (
              <View style={[styles.captionBlock, styles.aiCaptionBlock]}>
                <View style={styles.captionSpeakerRow}>
                  <Ionicons name="sparkles" size={12} color={colors.primary} />
                  <Text style={[styles.captionSpeaker, { color: colors.primary }]}>CareAI</Text>
                </View>
                <Text style={[styles.aiCaptionText, { color: colors.textMain }]}>
                  {aiCaption}
                </Text>
              </View>
            ) : !userCaption && voiceStatus === 'listening' ? (
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                Speak naturally... e.g. "Where is everyone?" or "Show Alex's driving score"
              </Text>
            ) : null}

            {/* Active Action Pill */}
            {activeAction && (
              <TouchableOpacity
                style={[styles.actionPill, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                activeOpacity={0.7}
                onPress={() => onExecuteAction?.(activeAction)}
              >
                <Ionicons name="flash" size={14} color={colors.primary} />
                <Text style={[styles.actionPillText, { color: colors.primary }]}>
                  Action: {activeAction.type.replace(/_/g, ' ')}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Quick Voice Suggestions */}
          <View style={styles.suggestionsSection}>
            <Text style={[styles.suggestionsLabel, { color: colors.textSecondary }]}>
              QUICK ASKS
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
              {voiceSuggestions.map((prompt, idx) => (
                <TouchableOpacity
                  key={`vsug_${idx}`}
                  style={[
                    styles.voiceChip,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleUserSpeech(prompt)}
                >
                  <Text style={[styles.voiceChipText, { color: colors.textMain }]}>
                    {prompt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Bottom Interactive Controls */}
          <View style={styles.controlsRow}>
            {/* Pause / Resume Mic */}
            <TouchableOpacity
              style={[
                styles.micBtn,
                voiceStatus === 'listening'
                  ? [styles.micBtnActive, { backgroundColor: colors.primary }]
                  : [styles.micBtnPaused, { backgroundColor: colors.card, borderColor: colors.cardBorder }],
              ]}
              onPress={toggleMic}
              activeOpacity={0.8}
            >
              <Ionicons
                name={voiceStatus === 'listening' ? 'mic' : 'mic-off'}
                size={28}
                color={voiceStatus === 'listening' ? '#FFFFFF' : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Settings Modal */}
      <AiSettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  careAiBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  visualizerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 100,
    marginVertical: 10,
  },
  soundBar: {
    width: 8,
    borderRadius: 4,
    minHeight: 12,
  },
  captionsContainer: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 14,
    minHeight: 90,
    justifyContent: 'center',
  },
  captionBlock: {
    marginBottom: 8,
  },
  aiCaptionBlock: {
    marginTop: 4,
  },
  captionSpeakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  captionSpeaker: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userCaptionText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  aiCaptionText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  analyzingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  suggestionsSection: {
    marginTop: 14,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  suggestionsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  voiceChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  micBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  micBtnActive: {},
  micBtnPaused: {
    borderWidth: 1.5,
  },
});
