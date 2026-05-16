import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { type LayoutChangeEvent, Pressable, View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type TabKey = "map" | "mission-control";

interface WebNavBarProps {
  currentPage: TabKey;
  isFireman?: boolean;
}

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
 * animates to the active tab using a plain CSS transition under the hood
 * (react-native-web passes the `transition*` style props through to the DOM).
 * This component only renders on web — `WebNavBar` is gated by
 * `Platform.OS === "web"` in every callsite.
 */
function SegmentedTabs({ currentPage, onSelect }: SegmentedTabsProps) {
  const t = useTheme();
  const [layouts, setLayouts] = useState<Record<TabKey, { x: number; width: number } | null>>({
    map: null,
    "mission-control": null,
  });

  const onTabLayout = (key: TabKey) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((s) => {
      const prev = s[key];
      if (prev && prev.x === x && prev.width === width) return s;
      return { ...s, [key]: { x, width } };
    });
  };

  const bothMeasured = layouts.map != null && layouts["mission-control"] != null;
  const active = layouts[currentPage];

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
      {bothMeasured && active && (
        <View
          pointerEvents="none"
          style={
            {
              position: "absolute",
              top: 3,
              bottom: 3,
              left: 0,
              width: active.width,
              transform: [{ translateX: active.x }],
              backgroundColor: t.colors.accent,
              borderRadius: t.radius.pill,
              // react-native-web maps these directly to CSS — runs in the
              // browser's compositor, smooth on every refresh rate.
              transitionProperty: "transform, width",
              transitionDuration: "260ms",
              transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            } as object
          }
        />
      )}
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
      <Text
        variant="label"
        color={active ? "#fff" : t.colors.inkMuted}
        // text color transition matches the pill so the swap doesn't feel
        // detached from the slide
        style={
          {
            transitionProperty: "color",
            transitionDuration: "260ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          } as object
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}
