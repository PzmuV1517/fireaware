import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

interface Props {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}

/**
 * Pill-shaped on/off button matching the FireAware brand. Three states:
 *   - inactive: white surface, ink text, subtle border
 *   - active: solid accent fill, white text
 *   - pressed: solid accent fill (regardless of active), white text
 * The icon swaps to its filled variant when active for an extra visual cue.
 */
export function ChipButton({ label, icon, iconActive, active, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: t.space.sm,
        paddingVertical: t.space.sm,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        backgroundColor:
          pressed || active ? t.colors.accent : t.colors.surface,
        borderColor:
          pressed || active ? t.colors.accent : t.colors.border,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      {({ pressed }) => {
        const on = pressed || active;
        const fg = on ? "#FFFFFF" : t.colors.ink;
        return (
          <>
            <Ionicons
              name={on && iconActive ? iconActive : icon}
              size={16}
              color={fg}
            />
            <Text
              variant="label"
              color={fg}
              style={{ letterSpacing: 0.6 }}
            >
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}
