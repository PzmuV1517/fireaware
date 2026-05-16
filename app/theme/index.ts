import { useEffect, useState } from "react";
import { Platform, useColorScheme } from "react-native";

import { colors, colorsDark, fonts, radius, sizes, space } from "./tokens";

export type ThemeColors = typeof colors;

type Scheme = "light" | "dark";

const forcedScheme = (process.env.EXPO_PUBLIC_COLOR_SCHEME ?? "").toLowerCase();
const forced = forcedScheme === "dark" || forcedScheme === "light" ? forcedScheme : null;

export function useResolvedColorScheme(): Scheme {
  const rnScheme = useColorScheme();
  const [webScheme, setWebScheme] = useState<Scheme | null>(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) {
      return null;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setWebScheme(media.matches ? "dark" : "light");
    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener?.(update);
    return () => media.removeListener?.(update);
  }, []);

  if (forced) return forced;
  if (Platform.OS === "web" && webScheme) return webScheme;
  return rnScheme === "dark" ? "dark" : "light";
}

export function useTheme() {
  const scheme = useResolvedColorScheme();
  const palette = scheme === "dark" ? colorsDark : colors;
  return { colors: palette, fonts, space, radius, sizes, scheme };
}

export { colors, colorsDark, fonts, radius, sizes, space };
