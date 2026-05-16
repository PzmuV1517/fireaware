import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost";
type Tone = "accent" | "danger" | "info" | "neutral";
type Size = "sm" | "md" | "lg";
type Shape = "rounded" | "pill";

interface Props extends Omit<PressableProps, "children"> {
  label: string;
  variant?: Variant;
  /** Color family. `accent` (default) is the signature orange; `danger` is
   * red for destructive actions; `info` is the water-blue used for reserves;
   * `neutral` is ink-on-surface for non-themed actions. */
  tone?: Tone;
  size?: Size;
  shape?: Shape;
  /** Optional Ionicons glyph rendered before the label. */
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
}

const TONE_COLORS = {
  accent: "accent",
  danger: "danger",
  info: "#2A7FC9",
  neutral: "ink",
} as const;

const SIZE_TOKENS = {
  sm: { padV: 6, padH: 12, iconSize: 14, textVariant: "label" as const },
  md: { padV: 12, padH: 24, iconSize: 16, textVariant: "h4" as const },
  lg: { padV: 14, padH: 28, iconSize: 18, textVariant: "h4" as const },
};

/**
 * Single source of truth for buttons across FireAware. Every button (primary
 * CTA, outlined pill, danger remove, water-blue add) flows through this so the
 * press behaviour, padding, and font weight stay consistent.
 *
 *   primary   = solid tone fill, white text
 *   secondary = outlined tone, transparent fill; on press → solid tone + white text
 *   ghost     = no border, no fill; on press → faint tone tint
 */
export function Button({
  label,
  variant = "primary",
  tone = "accent",
  size = "md",
  shape = "rounded",
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  ...rest
}: Props) {
  const t = useTheme();
  const tokens = SIZE_TOKENS[size];

  const toneRef = TONE_COLORS[tone];
  const toneColor =
    toneRef === "accent" ? t.colors.accent
      : toneRef === "danger" ? t.colors.danger
      : toneRef === "ink" ? t.colors.ink
      : toneRef;

  const baseBg = variant === "primary" ? toneColor : "transparent";
  const baseFg = variant === "primary" ? "#FFFFFF" : toneColor;
  const baseBorder = variant === "secondary" ? toneColor : "transparent";

  return (
    <Pressable
      disabled={disabled || loading}
      {...rest}
      style={(state) => [
        {
          backgroundColor: state.pressed
            ? variant === "ghost" ? `${toneColor}1A` : toneColor
            : baseBg,
          borderColor: state.pressed && variant !== "ghost" ? toneColor : baseBorder,
          borderWidth: variant === "secondary" ? 1.5 : 0,
          paddingVertical: tokens.padV,
          paddingHorizontal: tokens.padH,
          borderRadius: shape === "pill" ? t.radius.pill : t.radius.md,
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
        const fg = pressed && variant !== "ghost" ? "#FFFFFF" : baseFg;
        if (loading) return <ActivityIndicator color={fg} />;
        return (
          <>
            {icon && <Ionicons name={icon} size={tokens.iconSize} color={fg} />}
            <Text
              variant={tokens.textVariant}
              color={fg}
              style={{ fontFamily: t.fonts.heading, letterSpacing: 0.4 }}
            >
              {label}
            </Text>
          </>
        );
      }}
    </Pressable>
  );
}
