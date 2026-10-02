import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Base Shimmer Skeleton Element
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const { isDark } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: isDark ? [0.28, 0.65] : [0.4, 0.85],
  });

  const baseBg = isDark ? '#334155' : '#E2E8F0';

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: baseBg,
          opacity,
        },
        style,
      ]}
    />
  );
};

export interface SkeletonCircleProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({
  size = 48,
  style,
}) => {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
};

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  lastLineWidth?: string | number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 2,
  lineHeight = 12,
  gap = 6,
  style,
  lastLineWidth = '65%',
}) => {
  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => {
        const isLast = index === lines - 1;
        return (
          <Skeleton
            key={index}
            width={isLast && lines > 1 ? lastLineWidth : '100%'}
            height={lineHeight}
            borderRadius={lineHeight / 2}
            style={index > 0 ? { marginTop: gap } : undefined}
          />
        );
      })}
    </View>
  );
};

/**
 * Skeleton for Member Rows in Bottom Sheet & Member Lists
 */
export const MemberCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.memberRowSkeleton,
            {
              backgroundColor: colors.tileBg,
              borderColor: colors.tileBorder,
            },
          ]}
        >
          {/* Avatar Placeholder */}
          <SkeletonCircle size={52} />

          {/* Details Column */}
          <View style={styles.memberInfoSkeleton}>
            <View style={styles.topInfoRow}>
              <Skeleton width={130} height={16} borderRadius={8} />
              <Skeleton width={55} height={14} borderRadius={7} />
            </View>
            <Skeleton
              width={180}
              height={12}
              borderRadius={6}
              style={{ marginTop: 8 }}
            />
            <Skeleton
              width={90}
              height={10}
              borderRadius={5}
              style={{ marginTop: 6 }}
            />
          </View>

          {/* Right Action Placeholder */}
          <SkeletonCircle size={24} style={{ marginLeft: 8 }} />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for Circle items in ManageCirclesModal
 */
export const CircleItemSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.circleItemSkeleton,
            {
              backgroundColor: colors.tileBg,
              borderColor: colors.tileBorder,
            },
          ]}
        >
          <SkeletonCircle size={44} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Skeleton width={140} height={16} borderRadius={8} />
            <Skeleton
              width={90}
              height={12}
              borderRadius={6}
              style={{ marginTop: 6 }}
            />
          </View>
          <SkeletonCircle size={22} />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for Timeline stops in MemberTimelineModal
 */
export const TimelineItemSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.timelineRowSkeleton}>
          {/* Track and Node */}
          <View style={styles.timelineNodeCol}>
            <SkeletonCircle size={26} />
            {idx < count - 1 && (
              <Skeleton
                width={2}
                height={70}
                style={{ marginVertical: 4, alignSelf: 'center' }}
              />
            )}
          </View>

          {/* Card Body */}
          <View
            style={[
              styles.timelineCardSkeleton,
              {
                backgroundColor: colors.tileBg,
                borderColor: colors.tileBorder,
              },
            ]}
          >
            <View style={styles.timelineCardTop}>
              <Skeleton width={130} height={15} borderRadius={7} />
              <Skeleton width={60} height={14} borderRadius={7} />
            </View>
            <Skeleton
              width={200}
              height={12}
              borderRadius={6}
              style={{ marginTop: 8 }}
            />
            <View style={styles.timelineBadgesRow}>
              <Skeleton width={70} height={20} borderRadius={10} />
              <Skeleton width={85} height={20} borderRadius={10} style={{ marginLeft: 8 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for Drives / Trips in DrivingTabScreen & WeeklyDriveReportModal
 */
export const DriveCardSkeleton: React.FC<{ count?: number }> = ({ count = 2 }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.driveCardSkeleton,
            {
              backgroundColor: colors.tileBg,
              borderColor: colors.tileBorder,
            },
          ]}
        >
          {/* Driver header */}
          <View style={styles.driveHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SkeletonCircle size={28} />
              <Skeleton width={110} height={14} borderRadius={7} style={{ marginLeft: 8 }} />
            </View>
            <Skeleton width={80} height={12} borderRadius={6} />
          </View>

          {/* Trip Metrics */}
          <View style={styles.driveMetricsRow}>
            <View style={styles.driveMetricCol}>
              <Skeleton width={50} height={18} borderRadius={6} />
              <Skeleton width={60} height={11} borderRadius={5} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.driveMetricCol}>
              <Skeleton width={50} height={18} borderRadius={6} />
              <Skeleton width={60} height={11} borderRadius={5} style={{ marginTop: 4 }} />
            </View>
            <View style={styles.driveMetricCol}>
              <Skeleton width={50} height={18} borderRadius={6} />
              <Skeleton width={60} height={11} borderRadius={5} style={{ marginTop: 4 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for Saved Places in SafetyTabScreen & Bottom Sheet
 */
export const PlaceCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.placeCardSkeleton,
            {
              backgroundColor: colors.tileBg,
              borderColor: colors.tileBorder,
            },
          ]}
        >
          <SkeletonCircle size={40} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Skeleton width={130} height={15} borderRadius={7} />
            <Skeleton
              width={170}
              height={12}
              borderRadius={6}
              style={{ marginTop: 6 }}
            />
          </View>
          <Skeleton width={50} height={20} borderRadius={10} />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for Alerts in AlertsInboxModal
 */
export const AlertItemSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.alertCardSkeleton,
            {
              backgroundColor: colors.tileBg,
              borderColor: colors.tileBorder,
            },
          ]}
        >
          <SkeletonCircle size={40} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Skeleton width={120} height={15} borderRadius={7} />
              <Skeleton width={50} height={11} borderRadius={5} />
            </View>
            <Skeleton
              width={200}
              height={12}
              borderRadius={6}
              style={{ marginTop: 6 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton for Chat Bubbles in GroupChatModal & DirectChatModal
 */
export const ChatBubbleSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  const { isDark } = useTheme();

  return (
    <View style={{ paddingVertical: 12 }}>
      {Array.from({ length: count }).map((_, idx) => {
        const isRight = idx % 2 === 1;
        const bubbleWidth = [190, 140, 230, 160][idx % 4];

        return (
          <View
            key={idx}
            style={[
              styles.chatBubbleRow,
              isRight ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
            ]}
          >
            {!isRight && <SkeletonCircle size={32} style={{ marginRight: 8, alignSelf: 'flex-end' }} />}
            <View
              style={[
                styles.chatBubbleBox,
                {
                  width: bubbleWidth,
                  backgroundColor: isRight
                    ? (isDark ? '#4338CA' : '#E0E7FF')
                    : (isDark ? '#1E293B' : '#F1F5F9'),
                  borderRadius: 18,
                  borderBottomRightRadius: isRight ? 4 : 18,
                  borderBottomLeftRadius: isRight ? 18 : 4,
                },
              ]}
            >
              <Skeleton width={bubbleWidth - 36} height={13} borderRadius={6} />
              <Skeleton
                width={(bubbleWidth - 36) * 0.7}
                height={10}
                borderRadius={5}
                style={{ marginTop: 6 }}
              />
            </View>
            {isRight && <SkeletonCircle size={32} style={{ marginLeft: 8, alignSelf: 'flex-end' }} />}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: {
    width: '100%',
  },
  memberRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
  },
  memberInfoSkeleton: {
    flex: 1,
    marginLeft: 14,
  },
  topInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleItemSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  timelineRowSkeleton: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineNodeCol: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  timelineCardSkeleton: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  timelineCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineBadgesRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  driveCardSkeleton: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  driveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  driveMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  driveMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  placeCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 10,
  },
  alertCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  chatBubbleBox: {
    padding: 12,
  },
});
