import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Alert,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { DirectChatMessage, QUICK_PRESETS, QuickPreset } from '../../models/Chat';
import { MemberData, getMemberInitials, formatLastSeenTime } from '../../models/Member';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { TypingIndicator } from '../chat/TypingIndicator';

interface DirectChatModalProps {
  visible: boolean;
  peer: MemberData | null;
  currentUserId: string;
  messages: DirectChatMessage[];
  isPeerTyping?: boolean;
  onClose: () => void;
  onSendMessage: (content: string, messageType?: 'text' | 'preset' | 'location') => void;
  onTypingStatus?: (isTyping: boolean) => void;
}

export const DirectChatModal: React.FC<DirectChatModalProps> = ({
  visible,
  peer,
  currentUserId,
  messages,
  isPeerTyping = false,
  onClose,
  onSendMessage,
  onTypingStatus,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const isSendingRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingActiveRef = useRef(false);

  const notifyTyping = (isTyping: boolean) => {
    if (isTypingActiveRef.current !== isTyping) {
      isTypingActiveRef.current = isTyping;
      onTypingStatus?.(isTyping);
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);

    if (text.trim().length > 0) {
      notifyTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        notifyTyping(false);
      }, 2500);
    } else {
      notifyTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isTypingActiveRef.current) {
        notifyTyping(false);
      }
    };
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [visible, messages.length]);

  if (!peer) return null;

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || isSendingRef.current) return;
    isSendingRef.current = true;
    notifyTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendMessage(text, 'text');
    setInputText('');
    setTimeout(() => {
      isSendingRef.current = false;
    }, 350);
  };

  const handleSendPreset = (preset: QuickPreset) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    notifyTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendMessage(preset.text, 'preset');
    setTimeout(() => {
      isSendingRef.current = false;
    }, 350);
  };

  const handleCallPeer = () => {
    if (peer.phone && peer.phone.trim().length > 0) {
      Linking.openURL(`tel:${peer.phone.trim()}`).catch(() => {
        Alert.alert('Call Failed', `Could not initiate call to ${peer.fullName}`);
      });
    } else {
      Alert.alert(
        'No Phone Number',
        `${peer.fullName} has not added a mobile number to their profile yet.`
      );
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderMessageItem = ({ item }: { item: DirectChatMessage }) => {
    const isSelf = item.senderId === currentUserId;

    return (
      <View style={[styles.messageRow, isSelf ? styles.selfRow : styles.otherRow]}>
        {!isSelf && (
          <View style={styles.senderAvatarContainer}>
            {peer.avatarUrl ? (
              <Image source={{ uri: peer.avatarUrl }} style={styles.senderAvatarImg} />
            ) : (
              <View style={styles.senderAvatarFallback}>
                <Text style={styles.senderAvatarText}>
                  {getMemberInitials(peer.fullName)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bubbleWrapper}>
          <View
            style={[
              styles.bubble,
              isSelf
                ? [styles.selfBubble, { backgroundColor: colors.primary }]
                : [styles.otherBubble, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : '#F1F5F9' }],
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isSelf ? styles.selfMessageText : [styles.otherMessageText, { color: colors.textMain }],
              ]}
            >
              {item.content}
            </Text>
          </View>

          <Text style={[styles.timeText, isSelf ? styles.selfTimeText : styles.otherTimeText]}>
            {formatMessageTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerAvatar,
                  { borderColor: peer.isOnline ? '#10B981' : '#94A3B8' },
                ]}
              >
                {peer.avatarUrl ? (
                  <Image source={{ uri: peer.avatarUrl }} style={styles.headerAvatarImg} />
                ) : (
                  <Text style={styles.headerAvatarInitials}>
                    {getMemberInitials(peer.fullName)}
                  </Text>
                )}
              </View>

              <View style={styles.headerInfo}>
                <Text style={[styles.headerTitle, { color: colors.textMain }]} numberOfLines={1}>
                  {peer.fullName}
                </Text>
                <View style={styles.onlineStatusRow}>
                  <View
                    style={[
                      styles.onlineDot,
                      { backgroundColor: peer.isOnline ? '#10B981' : '#94A3B8' },
                    ]}
                  />
                  <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    {peer.isOnline
                      ? (peer.isMoving ? 'Moving now' : 'Online')
                      : `Offline • Active ${formatLastSeenTime(peer.lastOnlineAt)}`}
                  </Text>
                  {peer.batteryLevel !== undefined && (
                    <Text style={[styles.headerBattery, { color: colors.textMuted }]}>
                      • {peer.isCharging ? '⚡' : ''}{peer.batteryLevel}%
                    </Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              {/* Direct Call Button in Chat Header */}
              {peer.phone && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleCallPeer}
                  style={styles.headerCallBtn}
                >
                  <Ionicons name="call" size={17} color="#059669" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#F8FAFC' }]}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Presets Bar */}
          <View style={[styles.presetsBar, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUICK_PRESETS}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.presetsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#FFFFFF',
                      borderColor: colors.cardBorder,
                    },
                  ]}
                  activeOpacity={0.75}
                  onPress={() => handleSendPreset(item)}
                >
                  <Text style={[styles.presetChipText, { color: colors.textMain }]}>{item.text}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Messages Feed */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Personal Chat with {peer.fullName}</Text>
                <Text style={styles.emptySubtitle}>
                  This is a private 1-on-1 chat. Say hello or tap a preset above to connect!
                </Text>
              </View>
            }
          />

          {/* Typing Indicator Bar */}
          {isPeerTyping && (
            <TypingIndicator label={`${peer.fullName} is typing...`} />
          )}

          {/* Input Bar */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.divider,
                paddingBottom: isKeyboardVisible
                  ? 10
                  : Math.max(insets.bottom, 12),
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : '#F8FAFC',
                  borderColor: colors.cardBorder,
                  color: colors.textMain,
                },
              ]}
              placeholder={`Message ${peer.fullName.split(' ')[0]}...`}
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                inputText.trim().length > 0
                  ? [styles.sendBtnActive, { backgroundColor: colors.primary }]
                  : styles.sendBtnDisabled,
              ]}
              activeOpacity={0.8}
              onPress={handleSend}
              disabled={inputText.trim().length === 0}
            >
              <Feather name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  headerAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  onlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  headerBattery: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    backgroundColor: '#FAFAFA',
  },
  presetsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  selfRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  senderAvatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  senderAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  senderAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bubbleWrapper: {
    maxWidth: '78%',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  selfBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  selfMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: Colors.textMain,
  },
  timeText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  selfTimeText: {
    textAlign: 'right',
    marginRight: 4,
  },
  otherTimeText: {
    textAlign: 'left',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 14,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: Colors.textMain,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: Colors.primary,
  },
  sendBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
});
