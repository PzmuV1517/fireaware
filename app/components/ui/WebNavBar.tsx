import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { useTheme } from "@/theme";

import { Text } from "./Text";

interface WebNavBarProps {
  currentPage: "map" | "mission-control";
  isFireman?: boolean;
}

export function WebNavBar({ currentPage, isFireman = false }: WebNavBarProps) {
  const t = useTheme();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: t.colors.surface,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: 12,
        gap: 10,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
      }}
    >
      <Text variant="h3">FireAware</Text>

      <View style={{ flex: 1 }} />

      {isFireman && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: t.colors.bg,
            borderRadius: t.radius.pill,
            padding: 3,
            borderWidth: 1,
            borderColor: t.colors.border,
            gap: 2,
          }}
        >
          <Pressable
            onPress={() => router.replace("/")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: t.radius.pill,
              backgroundColor: currentPage === "map" ? t.colors.accent : "transparent",
            }}
          >
            <Text variant="label" color={currentPage === "map" ? "#fff" : t.colors.inkMuted}>
              Map
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/mission-control")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 5,
              borderRadius: t.radius.pill,
              backgroundColor:
                currentPage === "mission-control" ? t.colors.accent : "transparent",
            }}
          >
            <Text
              variant="label"
              color={currentPage === "mission-control" ? "#fff" : t.colors.inkMuted}
            >
              Mission Control
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={() => router.push("/settings")}
        android_ripple={{ color: t.colors.accent, borderless: true }}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: pressed ? t.colors.accent : t.colors.border,
          backgroundColor: pressed ? t.colors.accent : t.colors.bg,
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        {({ pressed }) => (
          <Ionicons name="settings-outline" size={18} color={pressed ? "#fff" : t.colors.ink} />
        )}
      </Pressable>
    </View>
  );
}
