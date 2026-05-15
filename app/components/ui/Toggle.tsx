import { Pressable } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

interface Props {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

export function Toggle({ label, value, onChange }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: t.space.sm,
        backgroundColor: value ? t.colors.ink : t.colors.surface,
        borderColor: value ? t.colors.ink : t.colors.border,
        borderWidth: 1,
        paddingVertical: t.space.sm,
        paddingHorizontal: t.space.md,
        borderRadius: t.radius.pill,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        variant="label"
        color={value ? "#FFFFFF" : t.colors.ink}
        style={{ letterSpacing: 0.8 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
