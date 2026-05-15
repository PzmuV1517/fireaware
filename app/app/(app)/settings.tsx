import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { BackendUrlEditor } from "@/components/BackendUrlEditor";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { authStore } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function Settings() {
  const t = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: t.space.lg,
          gap: t.space.xl,
        }}
      >
        <View style={{ gap: t.space.xs }}>
          <Text variant="h1">Settings</Text>
          <Text variant="subtext" muted>
            local preferences and connection
          </Text>
        </View>

        <View style={{ gap: t.space.md }}>
          <Text variant="label" muted>
            backend
          </Text>
          <BackendUrlEditor alwaysExpanded />
        </View>

        <View style={{ gap: t.space.md }}>
          <Text variant="label" muted>
            session
          </Text>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={async () => {
              await authStore.getState().clear();
              router.replace("/");
            }}
          />
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ alignItems: "center", paddingTop: t.space.xl }}>
          <Text variant="caption" muted>
            © 2026 FERRITEWORKS S.R.L.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
