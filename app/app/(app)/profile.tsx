import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function Profile() {
  const t = useTheme();
  const router = useRouter();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.auth.me() });
  const { data: reports } = useQuery({
    queryKey: ["reports", "mine"],
    queryFn: () => api.reports.mine(),
  });

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.xl }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" muted>signed in as</Text>
        <Text variant="h2">{me?.display_name ?? "—"}</Text>
        <Text variant="subtext" muted>{me?.email}</Text>
      </View>

      <View style={{ gap: t.space.md }}>
        <Text variant="label" muted>your reports</Text>
        {(reports ?? []).length === 0 ? (
          <Text variant="subtext" muted>nothing yet — submit your first sighting</Text>
        ) : (
          (reports ?? []).map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
                borderWidth: 1,
                borderRadius: t.radius.md,
                padding: t.space.md,
                gap: 2,
              }}
            >
              <Text variant="mono">
                {r.lat.toFixed(4)}°, {r.lon.toFixed(4)}° · {r.bearing_deg.toFixed(0)}°
              </Text>
              <Text variant="subtext" muted>
                {new Date(r.taken_at).toLocaleString()} ·{" "}
                {r.status === "matched" ? "triangulated" : "awaiting confirmation"}
              </Text>
            </View>
          ))
        )}
      </View>

      <Button
        label="Sign out"
        variant="secondary"
        fullWidth
        onPress={async () => {
          await authStore.getState().clear();
          router.replace("/");
        }}
      />
    </ScrollView>
  );
}
