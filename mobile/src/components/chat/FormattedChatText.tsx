import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FormattedChatTextProps {
  content: string;
  textColor?: string;
  accentColor?: string;
  fontSize?: number;
}

export const FormattedChatText: React.FC<FormattedChatTextProps> = ({
  content,
  textColor = '#E2E8F0',
  accentColor = '#6366F1',
  fontSize = 14,
}) => {
  if (!content) return null;

  // Split lines
  const lines = content.split('\n');

  // Render inline formatting (bold, code, normal)
  const renderInlineFormattedText = (lineText: string, keyPrefix: string, isBullet = false) => {
    // Regex matches **bold**, `code`, or regular text
    const parts = lineText.split(/(\*\*.*?\*\*|`.*?`)/g);

    return (
      <Text
        key={keyPrefix}
        style={[
          styles.lineText,
          { color: textColor, fontSize: fontSize, lineHeight: fontSize * 1.45 },
          isBullet && styles.bulletText,
        ]}
      >
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            return (
              <Text key={`${keyPrefix}_bold_${idx}`} style={[styles.boldText, { color: textColor }]}>
                {boldText}
              </Text>
            );
          } else if (part.startsWith('`') && part.endsWith('`')) {
            const codeText = part.slice(1, -1);
            return (
              <Text
                key={`${keyPrefix}_code_${idx}`}
                style={[styles.codeBadge, { backgroundColor: 'rgba(99, 102, 241, 0.15)', color: accentColor }]}
              >
                {codeText}
              </Text>
            );
          }
          return <React.Fragment key={`${keyPrefix}_text_${idx}`}>{part}</React.Fragment>;
        })}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();

        // Empty line spacer
        if (!line) {
          return <View key={`spacer_${idx}`} style={styles.paragraphSpacer} />;
        }

        // Headings: ###, ##, #
        if (line.startsWith('### ')) {
          return (
            <Text key={`h3_${idx}`} style={[styles.heading3, { color: accentColor }]}>
              {line.replace(/^###\s+/, '')}
            </Text>
          );
        }
        if (line.startsWith('## ') || line.startsWith('# ')) {
          return (
            <Text key={`h2_${idx}`} style={[styles.heading2, { color: textColor }]}>
              {line.replace(/^#+\s+/, '')}
            </Text>
          );
        }

        // Bullet point: * or -
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const bulletContent = line.replace(/^[\*\-]\s+/, '');
          return (
            <View key={`bullet_${idx}`} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: accentColor }]}>•</Text>
              <View style={styles.bulletContent}>
                {renderInlineFormattedText(bulletContent, `b_in_${idx}`, true)}
              </View>
            </View>
          );
        }

        // Numbered list: 1. 2. 3.
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const textAfter = numMatch[2];
          return (
            <View key={`num_${idx}`} style={styles.bulletRow}>
              <Text style={[styles.numBadge, { color: accentColor }]}>{num}.</Text>
              <View style={styles.bulletContent}>
                {renderInlineFormattedText(textAfter, `n_in_${idx}`, true)}
              </View>
            </View>
          );
        }

        // Standard line
        return (
          <View key={`line_wrap_${idx}`} style={styles.lineWrap}>
            {renderInlineFormattedText(line, `line_${idx}`)}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  paragraphSpacer: {
    height: 6,
  },
  lineWrap: {
    marginBottom: 3,
  },
  lineText: {
    letterSpacing: 0.2,
  },
  boldText: {
    fontWeight: '700',
  },
  codeBadge: {
    fontFamily: 'Courier',
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  heading3: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 20,
    marginRight: 6,
  },
  numBadge: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
    marginRight: 6,
    minWidth: 16,
  },
  bulletContent: {
    flex: 1,
  },
  bulletText: {
    flexWrap: 'wrap',
  },
});
