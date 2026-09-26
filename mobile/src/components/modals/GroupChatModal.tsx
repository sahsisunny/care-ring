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
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ChatMessage, QUICK_PRESETS, QuickPreset } from '../../models/Chat';
import { Circle } from '../../models/Circle';
import { Colors } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';
import { TypingIndicator } from '../chat/TypingIndicator';

interface GroupChatModalProps {
  visible: boolean;
  circle: Circle | null;
  currentUserId: string;
  messages: ChatMessage[];
  typingUsers?: string[];
  onClose: () => void;
  onSendMessage: (content: string, messageType?: 'text' | 'preset' | 'location') => void;
  onTypingStatus?: (isTyping: boolean) => void;
}

export const GroupChatModal: React.FC<GroupChatModalProps> = ({
  visible,
  circle,
  currentUserId,
  messages,
  typingUsers = [],
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

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatTypingLabel = (users: string[]): string => {
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users[0]}, ${users[1]} and ${users.length - 2} other${users.length - 2 > 1 ? 's' : ''} are typing...`;
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isSelf = item.userId === currentUserId;

    return (
      <View style={[styles.messageRow, isSelf ? styles.selfRow : styles.otherRow]}>
        {!isSelf && (
          <View style={styles.senderAvatarContainer}>
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} style={styles.senderAvatarImg} />
            ) : (
              <View style={styles.senderAvatarFallback}>
                <Text style={styles.senderAvatarText}>
                  {item.userName ? item.userName.charAt(0).toUpperCase() : 'M'}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.bubbleWrapper}>
          {!isSelf && (
            <Text style={[styles.senderNameText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.userName || 'Family Member'}
            </Text>
          )}

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
          style={[styles.keyboardContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.divider }]}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={colors.textMain} />
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.textMain }]} numberOfLines={1}>
                {circle?.name || 'Family Chat'}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {circle?.memberCount ? `${circle.memberCount} Members` : 'CareRing Family'}
              </Text>
            </View>

            <View style={styles.headerRightPlaceholder} />
          </View>

          {/* Quick Presets Carousel */}
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
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#EFF6FF',
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
                <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  Say hello or tap a quick preset above to start chatting with your family!
                </Text>
              </View>
            }
          />

          {/* Typing Indicator Bar */}
          {typingUsers.length > 0 && (
            <TypingIndicator label={formatTypingLabel(typingUsers)} />
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
              placeholder="Message your family..."
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  presetsBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  presetsList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
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
  },
  selfRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  senderAvatarContainer: {
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  senderAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  senderAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bubbleWrapper: {
    maxWidth: '75%',
  },
  senderNameText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selfBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 15,
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
    marginTop: 2,
  },
  selfTimeText: {
    color: '#94A3B8',
    textAlign: 'right',
    marginRight: 4,
  },
  otherTimeText: {
    color: '#94A3B8',
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
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
    backgroundColor: '#CBD5E1',
  },
});
