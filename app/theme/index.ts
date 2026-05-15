import { useColorScheme } from "react-native";

import { colors, colorsDark, fonts, radius, sizes, space } from "./tokens";

export type ThemeColors = typeof colors;

export function useTheme() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colorsDark : colors;
  return { colors: palette, fonts, space, radius, sizes, scheme };
}

export { colors, colorsDark, fonts, radius, sizes, space };
