import { Text as RNText, type TextProps, type TextStyle } from "react-native";

import { useTheme } from "@/theme";

type Variant = "h1" | "h2" | "h3" | "h4" | "body" | "label" | "caption" | "subtext" | "mono";

interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  align?: TextStyle["textAlign"];
}

export function Text({ variant = "body", muted, color, align, style, ...rest }: Props) {
  const t = useTheme();

  const base: TextStyle = (() => {
    switch (variant) {
      case "h1":
        return { fontFamily: t.fonts.heading, fontSize: t.sizes.h1, letterSpacing: -0.5 };
      case "h2":
        return { fontFamily: t.fonts.heading, fontSize: t.sizes.h2, letterSpacing: -0.3 };
      case "h3":
        return { fontFamily: t.fonts.heading, fontSize: t.sizes.h3, letterSpacing: -0.2 };
      case "h4":
        return { fontFamily: t.fonts.headingMedium, fontSize: t.sizes.h4 };
      case "label":
        return {
          fontFamily: t.fonts.headingMedium,
          fontSize: t.sizes.small,
          textTransform: "uppercase",
          letterSpacing: 1.2,
        };
      case "caption":
        return { fontFamily: t.fonts.body, fontSize: t.sizes.caption };
      case "subtext":
        return { fontFamily: t.fonts.subtext, fontSize: t.sizes.body + 1, fontStyle: "italic" };
      case "mono":
        return { fontFamily: t.fonts.mono, fontSize: t.sizes.small };
      default:
        return { fontFamily: t.fonts.body, fontSize: t.sizes.body };
    }
  })();

  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: color ?? (muted ? t.colors.inkMuted : t.colors.ink), textAlign: align },
        style,
      ]}
    />
  );
}
