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

  const bg =
    variant === "primary" ? t.colors.accent : variant === "secondary" ? t.colors.surface : "transparent";
  const fg = variant === "primary" ? "#FFFFFF" : t.colors.ink;
  const borderColor = variant === "secondary" ? t.colors.border : "transparent";

  return (
    <Pressable
      disabled={disabled || loading}
      {...rest}
      style={(state) => [
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === "secondary" ? 1 : 0,
          paddingVertical: t.space.md,
          paddingHorizontal: t.space.xl,
          borderRadius: t.radius.md,
          opacity: disabled ? 0.5 : state.pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: t.space.sm,
        },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text
          variant="h4"
          color={fg}
          style={{ fontFamily: t.fonts.heading, letterSpacing: 0.4 }}
        >
          {label}
        </Text>
      )}
      <View />
    </Pressable>
  );
}
