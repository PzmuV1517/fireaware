import { useState } from "react";
import { TextInput, type TextInputProps, View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, style, onFocus, onBlur, ...rest }: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: t.space.xs }}>
      {label ? <Text variant="label" muted>{label}</Text> : null}
      <TextInput
        {...rest}
        placeholderTextColor={t.colors.inkMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            fontFamily: t.fonts.body,
            fontSize: t.sizes.body,
            color: t.colors.ink,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: error ? t.colors.danger : focused ? t.colors.ink : t.colors.border,
            borderRadius: t.radius.md,
            paddingHorizontal: t.space.md,
            paddingVertical: t.space.md,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="subtext" color={t.colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="subtext" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
