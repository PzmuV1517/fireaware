import { ActivityIndicator, Pressable, type PressableProps, View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost";

interface Props extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  fullWidth,
  style,
  ...rest
}: Props) {
  const t = useTheme();

  // Buttons stay on-brand in every state: primary = filled orange, secondary
  // = outlined orange. Both turn solid orange while pressed; secondary lifts
  // back to outlined on release (never grey/white surface).
  const baseBg = variant === "primary" ? t.colors.accent : "transparent";
  const baseFg = variant === "primary" ? "#FFFFFF" : t.colors.accent;
  const baseBorder = variant === "secondary" ? t.colors.accent : "transparent";

  return (
    <Pressable
      disabled={disabled || loading}
      {...rest}
      style={(state) => [
        {
          backgroundColor: state.pressed ? t.colors.accent : baseBg,
          borderColor: state.pressed ? t.colors.accent : baseBorder,
          borderWidth: variant === "secondary" ? 1.5 : 0,
          paddingVertical: t.space.md,
          paddingHorizontal: t.space.xl,
          borderRadius: t.radius.md,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: t.space.sm,
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {({ pressed }) => {
        // when pressed the bg is solid accent, so the foreground must be white;
        // otherwise primary stays white, secondary uses the accent for text.
        const fg = pressed ? "#FFFFFF" : baseFg;
        return loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            <Text
              variant="h4"
              color={fg}
              style={{ fontFamily: t.fonts.heading, letterSpacing: 0.4 }}
            >
              {label}
            </Text>
            <View />
          </>
        );
      }}
    </Pressable>
  );
}
