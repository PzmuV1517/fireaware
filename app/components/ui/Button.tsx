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

  const baseBg =
    variant === "primary"
      ? t.colors.accent
      : variant === "secondary"
        ? t.colors.surface
        : "transparent";
  const baseFg = variant === "primary" ? "#FFFFFF" : t.colors.ink;
  const borderColor = variant === "secondary" ? t.colors.border : "transparent";

  return (
    <Pressable
      disabled={disabled || loading}
      android_ripple={{ color: t.colors.accent }}
      {...rest}
      style={(state) => [
        {
          backgroundColor: state.pressed ? t.colors.accent : baseBg,
          borderColor: state.pressed ? t.colors.accent : borderColor,
          borderWidth: variant === "secondary" ? 1 : 0,
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
