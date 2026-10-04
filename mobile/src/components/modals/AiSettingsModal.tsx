import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import {
  aiSettingsService,
  AiSettingsConfig,
  AiProvider,
  AiLanguage,
  SUPPORTED_LANGUAGES,
} from '../../services/AiSettingsService';
import { aiChatService } from '../../services/AiChatService';

interface AiSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();

  const [config, setConfig] = useState<AiSettingsConfig>(aiSettingsService.getSettings());
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { valid: boolean; message?: string }>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      aiSettingsService.loadSettings().then(setConfig);
    }
  }, [visible]);

  const handleProviderSelect = async (provider: AiProvider) => {
    const updated = await aiSettingsService.saveSettings({ preferredProvider: provider });
    setConfig(updated);
  };

  const handleLanguageSelect = async (lang: AiLanguage) => {
    const updated = await aiSettingsService.saveSettings({ speechLanguage: lang });
    setConfig(updated);
  };

  const handleVoiceSelect = async (_voiceId: string) => {
    // Voice selection reserved for future use
  };

  const handleKeyChange = (field: keyof AiSettingsConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveKeys = async () => {
    await aiSettingsService.saveSettings({
      customGeminiKey: config.customGeminiKey.trim(),
      customClaudeKey: config.customClaudeKey.trim(),
      customOpenAiKey: config.customOpenAiKey.trim(),
    });
  };

  const handleTestKey = async (provider: 'gemini' | 'claude' | 'openai', key: string) => {
    if (!key.trim()) {
      setTestResult((prev) => ({
        ...prev,
        [provider]: { valid: false, message: 'Please enter a key to test' },
      }));
      return;
    }

    setTestingKey(provider);
    setTestResult((prev) => ({ ...prev, [provider]: { valid: false, message: undefined } }));

    const res = await aiChatService.testApiKey(provider, key.trim());
    setTestingKey(null);
    setTestResult((prev) => ({
      ...prev,
      [provider]: {
        valid: res.valid,
        message: res.valid ? 'Key is active & valid!' : res.error || 'Verification failed',
      },
    }));
  };

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.modalCardBg }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textMain }]}>CareAI Settings</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Configure AI brains, language & custom API keys
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            {/* Section 1: Active LLM Provider */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Primary AI Brain</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                Choose which AI intelligence generates answers. Default runs on server Gemini key.
              </Text>

              <View style={styles.providerGrid}>
                {/* Gemini Option */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleProviderSelect('gemini')}
                  style={[
                    styles.providerCard,
                    {
                      borderColor:
                        config.preferredProvider === 'gemini' ? colors.primary : colors.cardBorder,
                      backgroundColor:
                        config.preferredProvider === 'gemini'
                          ? colors.primary + '10'
                          : colors.tileBg,
                    },
                  ]}
                >
                  <View style={styles.providerHeader}>
                    <Ionicons
                      name="hardware-chip-outline"
                      size={22}
                      color={config.preferredProvider === 'gemini' ? colors.primary : colors.textSecondary}
                    />
                    <View style={styles.badgeDefault}>
                      <Text style={styles.badgeDefaultText}>DEFAULT</Text>
                    </View>
                  </View>
                  <Text style={[styles.providerName, { color: colors.textMain }]}>Google Gemini</Text>
                  <Text style={[styles.providerMeta, { color: colors.textSecondary }]}>
                    Gemini 1.5 Flash • Server .env key included
                  </Text>
                </TouchableOpacity>

                {/* Claude Option */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleProviderSelect('claude')}
                  style={[
                    styles.providerCard,
                    {
                      borderColor:
                        config.preferredProvider === 'claude' ? '#D97706' : colors.cardBorder,
                      backgroundColor:
                        config.preferredProvider === 'claude'
                          ? '#D9770615'
                          : colors.tileBg,
                    },
                  ]}
                >
                  <View style={styles.providerHeader}>
                    <Ionicons
                      name="bulb-outline"
                      size={22}
                      color={config.preferredProvider === 'claude' ? '#D97706' : colors.textSecondary}
                    />
                    <View style={styles.badgeCustom}>
                      <Text style={styles.badgeCustomText}>BYOK</Text>
                    </View>
                  </View>
                  <Text style={[styles.providerName, { color: colors.textMain }]}>Anthropic Claude</Text>
                  <Text style={[styles.providerMeta, { color: colors.textSecondary }]}>
                    Claude 3.5 Haiku/Sonnet • Requires your key
                  </Text>
                </TouchableOpacity>

                {/* OpenAI Option */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleProviderSelect('openai')}
                  style={[
                    styles.providerCard,
                    {
                      borderColor:
                        config.preferredProvider === 'openai' ? '#10B981' : colors.cardBorder,
                      backgroundColor:
                        config.preferredProvider === 'openai'
                          ? '#10B98115'
                          : colors.tileBg,
                    },
                  ]}
                >
                  <View style={styles.providerHeader}>
                    <Ionicons
                      name="logo-electron"
                      size={22}
                      color={config.preferredProvider === 'openai' ? '#10B981' : colors.textSecondary}
                    />
                    <View style={styles.badgeCustom}>
                      <Text style={styles.badgeCustomText}>BYOK</Text>
                    </View>
                  </View>
                  <Text style={[styles.providerName, { color: colors.textMain }]}>OpenAI GPT-4o</Text>
                  <Text style={[styles.providerMeta, { color: colors.textSecondary }]}>
                    GPT-4o Mini • Requires your key
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Section 2: Speech & Language */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textMain }]}>Language & Accents</Text>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                Supports natural Hindi, English, and Hinglish. Auto mode detects dynamically.
              </Text>

              <View style={styles.pillRow}>
                {SUPPORTED_LANGUAGES.map((lang) => {
                  const isSelected = config.speechLanguage === lang.code;
                  return (
                    <TouchableOpacity
                      key={lang.code}
                      onPress={() => handleLanguageSelect(lang.code)}
                      style={[
                        styles.langPill,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.tileBg,
                          borderColor: isSelected ? colors.primary : colors.cardBorder,
                        },
                      ]}
                    >
                      <Text style={styles.langPillFlag}>{lang.flag}</Text>
                      <Text
                        style={[
                          styles.langPillText,
                          { color: isSelected ? '#FFFFFF' : colors.textMain },
                        ]}
                      >
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 3: Voice Info — Free Google Translate TTS */}
            <View style={styles.section}>
              <View style={styles.voiceSectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                  Voice & Speech
                </Text>
                <View style={[styles.voiceTag, { backgroundColor: '#10B98120' }]}>
                  <Text style={[styles.voiceTagText, { color: '#10B981' }]}>Free • No Key Needed</Text>
                </View>
              </View>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                Voice responses use free Google Translate TTS with automatic Hindi/English/Hinglish support,
                plus your device's native speech synthesis as a seamless fallback.
              </Text>
            </View>

            {/* Section 4: Bring Your Own Keys (BYOK) */}
            <View style={styles.section}>
              <View style={styles.keySectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.textMain }]}>
                    Custom API Keys (BYOK)
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
                    Optional: Use your personal keys. Keys remain safely stored on this device.
                  </Text>
                </View>
              </View>

              {/* Gemini Key Input */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={[styles.inputLabel, { color: colors.textMain }]}>
                    Google Gemini Key
                  </Text>
                  <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                    (Leave empty to use server default)
                  </Text>
                </View>
                <View style={[styles.inputContainer, { borderColor: colors.cardBorder }]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.textMain }]}
                    placeholder="AIzaSy... (Personal Gemini Key)"
                    placeholderTextColor={colors.textSecondary + '80'}
                    value={config.customGeminiKey}
                    onChangeText={(val) => handleKeyChange('customGeminiKey', val)}
                    onBlur={handleSaveKeys}
                    secureTextEntry={!showKeys['gemini']}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => toggleShowKey('gemini')}
                    style={styles.inputIconBtn}
                  >
                    <Ionicons
                      name={showKeys['gemini'] ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleTestKey('gemini', config.customGeminiKey)}
                    style={[styles.testBtn, { backgroundColor: colors.primary + '20' }]}
                    disabled={testingKey === 'gemini'}
                  >
                    {testingKey === 'gemini' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={[styles.testBtnText, { color: colors.primary }]}>Test</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {testResult['gemini'] && (
                  <Text
                    style={[
                      styles.testResultText,
                      { color: testResult['gemini'].valid ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {testResult['gemini'].message}
                  </Text>
                )}
              </View>

              {/* Claude Key Input */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={[styles.inputLabel, { color: colors.textMain }]}>
                    Anthropic Claude Key
                  </Text>
                </View>
                <View style={[styles.inputContainer, { borderColor: colors.cardBorder }]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.textMain }]}
                    placeholder="sk-ant-... (Anthropic API Key)"
                    placeholderTextColor={colors.textSecondary + '80'}
                    value={config.customClaudeKey}
                    onChangeText={(val) => handleKeyChange('customClaudeKey', val)}
                    onBlur={handleSaveKeys}
                    secureTextEntry={!showKeys['claude']}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => toggleShowKey('claude')}
                    style={styles.inputIconBtn}
                  >
                    <Ionicons
                      name={showKeys['claude'] ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleTestKey('claude', config.customClaudeKey)}
                    style={[styles.testBtn, { backgroundColor: '#D9770620' }]}
                    disabled={testingKey === 'claude'}
                  >
                    {testingKey === 'claude' ? (
                      <ActivityIndicator size="small" color="#D97706" />
                    ) : (
                      <Text style={[styles.testBtnText, { color: '#D97706' }]}>Test</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {testResult['claude'] && (
                  <Text
                    style={[
                      styles.testResultText,
                      { color: testResult['claude'].valid ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {testResult['claude'].message}
                  </Text>
                )}
              </View>

              {/* OpenAI Key Input */}
              <View style={styles.inputGroup}>
                <View style={styles.inputLabelRow}>
                  <Text style={[styles.inputLabel, { color: colors.textMain }]}>
                    OpenAI Key
                  </Text>
                </View>
                <View style={[styles.inputContainer, { borderColor: colors.cardBorder }]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.textMain }]}
                    placeholder="sk-... (OpenAI API Key)"
                    placeholderTextColor={colors.textSecondary + '80'}
                    value={config.customOpenAiKey}
                    onChangeText={(val) => handleKeyChange('customOpenAiKey', val)}
                    onBlur={handleSaveKeys}
                    secureTextEntry={!showKeys['openai']}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => toggleShowKey('openai')}
                    style={styles.inputIconBtn}
                  >
                    <Ionicons
                      name={showKeys['openai'] ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleTestKey('openai', config.customOpenAiKey)}
                    style={[styles.testBtn, { backgroundColor: '#10B98120' }]}
                    disabled={testingKey === 'openai'}
                  >
                    {testingKey === 'openai' ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <Text style={[styles.testBtnText, { color: '#10B981' }]}>Test</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {testResult['openai'] && (
                  <Text
                    style={[
                      styles.testResultText,
                      { color: testResult['openai'].valid ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {testResult['openai'].message}
                  </Text>
                )}
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={[styles.footer, { borderTopColor: colors.cardBorder }]}>
            <TouchableOpacity
              onPress={() => {
                handleSaveKeys();
                onClose();
              }}
              style={[styles.saveDoneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.saveDoneBtnText}>Save Preferences</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    height: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  providerGrid: {
    gap: 10,
  },
  providerCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badgeDefault: {
    backgroundColor: '#3B82F620',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeDefaultText: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '700',
  },
  badgeCustom: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeCustomText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  providerMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  langPillFlag: {
    fontSize: 14,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  voiceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceTag: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  voiceTagText: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '700',
  },
  voiceList: {
    gap: 8,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  voiceItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  voiceItemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  keySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputHint: {
    fontSize: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  inputIconBtn: {
    padding: 6,
  },
  testBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 6,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  testResultText: {
    fontSize: 11,
    marginTop: 4,
    paddingLeft: 4,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveDoneBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
