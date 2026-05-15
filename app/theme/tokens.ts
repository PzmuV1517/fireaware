/**
 * FireAware design tokens — Claude-inspired warm paper palette.
 * Blocky geometric sans for headings; calligraphic serif italic for subtext.
 */

export const colors = {
  bg: "#F7F4EE",
  surface: "#FFFFFF",
  surfaceAlt: "#F1ECDF",
  ink: "#1A1714",
  inkMuted: "#6B6258",
  border: "#E5DFD3",
  accent: "#C9532A",
  accentSoft: "#E89B6F",
  success: "#5A7F3C",
  warn: "#B8862E",
  danger: "#A33524",
} as const;

export const colorsDark = {
  ...colors,
  bg: "#171411",
  surface: "#211C18",
  surfaceAlt: "#2A241F",
  ink: "#EFE9DD",
  inkMuted: "#9C9388",
  border: "#3A332C",
} as const;

export const fonts = {
  heading: "SpaceGrotesk_700Bold",
  headingMedium: "SpaceGrotesk_500Medium",
  body: "SpaceGrotesk_400Regular",
  subtext: "EBGaramond_400Regular_Italic",
  subtextBold: "EBGaramond_600SemiBold_Italic",
  mono: "JetBrainsMono_400Regular",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const sizes = {
  body: 15,
  small: 13,
  caption: 12,
  h1: 36,
  h2: 28,
  h3: 22,
  h4: 18,
} as const;
