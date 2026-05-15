import { Redirect, Stack } from "expo-router";
import { Platform } from "react-native";

import { useAuth } from "@/lib/auth";

export default function AuthLayout() {
  const { accessToken, hydrated } = useAuth();

  if (!hydrated) return null;
  if (accessToken) {
    if (Platform.OS === "web") return <Redirect href="/" />;
    return <Redirect href="/(app)/map" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
