import { Tabs, Redirect } from "expo-router";
import { Platform } from "react-native";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function AppLayout() {
  const t = useTheme();
  const { accessToken, hydrated } = useAuth();

  if (Platform.OS === "web") return <Redirect href="/" />;
  if (!hydrated) return null;
  if (!accessToken) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: t.fonts.heading, color: t.colors.ink },
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: t.fonts.headingMedium,
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.inkMuted,
      }}
    >
      <Tabs.Screen name="map" options={{ title: "Map", headerShown: false }} />
      <Tabs.Screen name="report" options={{ title: "Report", headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", href: null }} />
    </Tabs>
  );
}
