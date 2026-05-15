import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type TabKey = "map" | "mission-control";

interface WebNavBarProps {
  currentPage: TabKey;
  isFireman?: boolean;
}

const SLIDE = {
  duration: 260,
  easing: Easing.bezier(0.16, 1, 0.3, 1), // ease-out-quint, Apple-like deceleration
};

export function WebNavBar({ currentPage, isFireman = false }: WebNavBarProps) {
  const t = useTheme();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: 12,
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
      }}
    >
      <Text variant="h3">FireAware</Text>

      <View style={{ flex: 1 }} />

      {isFireman && (
        <SegmentedTabs
          currentPage={currentPage}
          onSelect={(key) => router.replace(key === "map" ? "/" : "/mission-control")}
        />
      )}

      <Pressable
        onPress={() => router.push("/settings")}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: pressed ? t.colors.accent : t.colors.border,
          backgroundColor: pressed ? t.colors.accent : t.colors.bg,
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        {({ pressed }) => (
          <Ionicons name="settings-outline" size={18} color={pressed ? "#fff" : t.colors.ink} />
        )}
      </Pressable>
    </View>
  );
}

interface SegmentedTabsProps {
  currentPage: TabKey;
  onSelect: (key: TabKey) => void;
}

/**
 * iOS-style segmented control. The orange pill is absolutely positioned and
 * its translateX + width animate to match the active tab — measured at mount
 * via onLayout so labels of any length work.
 */
function SegmentedTabs({ currentPage, onSelect }: SegmentedTabsProps) {
  const t = useTheme();
  const layouts = useRef<Record<TabKey, { x: number; width: number } | undefined>>({
    map: undefined,
    "mission-control": undefined,
  });
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const [measured, setMeasured] = useState(false);

  const movePillTo = (key: TabKey, animated: boolean) => {
    const l = layouts.current[key];
    if (!l) return;
    if (animated) {
      pillX.value = withTiming(l.x, SLIDE);
      pillW.value = withTiming(l.width, SLIDE);
    } else {
      pillX.value = l.x;
      pillW.value = l.width;
    }
  };

  const onTabLayout = (key: TabKey) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    layouts.current[key] = { x, width };
    // once both tabs are measured, snap the pill to the active one without
    // animation; subsequent currentPage changes will animate
    if (!measured && layouts.current.map && layouts.current["mission-control"]) {
      setMeasured(true);
      movePillTo(currentPage, false);
    } else if (measured && key === currentPage) {
      movePillTo(currentPage, false);
    }
  };

  useEffect(() => {
    if (measured) movePillTo(currentPage, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, measured]);

  const pillStyle = useAnimatedStyle(() => ({
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 0,
    width: pillW.value,
    transform: [{ translateX: pillX.value }],
    backgroundColor: t.colors.accent,
    borderRadius: t.radius.pill,
  }));

  return (
    <View
      style={{
        position: "relative",
        flexDirection: "row",
        backgroundColor: t.colors.bg,
        borderRadius: t.radius.pill,
        padding: 3,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <Animated.View style={pillStyle} pointerEvents="none" />
      <TabButton
        label="Map"
        active={currentPage === "map"}
        onLayout={onTabLayout("map")}
        onPress={() => onSelect("map")}
      />
      <TabButton
        label="Mission Control"
        active={currentPage === "mission-control"}
        onLayout={onTabLayout("mission-control")}
        onPress={() => onSelect("mission-control")}
      />
    </View>
  );
}

interface TabButtonProps {
  label: string;
  active: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}

function TabButton({ label, active, onLayout, onPress }: TabButtonProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: t.radius.pill,
      }}
    >
      <Text variant="label" color={active ? "#fff" : t.colors.inkMuted}>
        {label}
      </Text>
    </Pressable>
  );
}
