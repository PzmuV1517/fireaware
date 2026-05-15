import { Stack } from "expo-router";

import { useTheme } from "@/theme";

export default function ReportLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: t.fonts.heading, color: t.colors.ink },
        headerTintColor: t.colors.ink,
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Report a fire" }} />
      <Stack.Screen name="calibrate" options={{ title: "Calibrate" }} />
      <Stack.Screen name="pin" options={{ title: "Drop a pin" }} />
      <Stack.Screen name="capture" options={{ title: "Capture" }} />
      <Stack.Screen name="confirm" options={{ title: "Confirm" }} />
    </Stack>
  );
}
