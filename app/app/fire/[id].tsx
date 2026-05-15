import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { useTheme } from "@/theme";

export default function FireDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["fire", id],
    queryFn: () => api.fires.detail(id!),
    enabled: Boolean(id),
  });

  if (isLoading || !data) {
    return (
      <View style={{ flex: 1, padding: t.space.lg }}>
        <Text variant="subtext" muted>loading sighting…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" muted>active sighting</Text>
        <Text variant="h2">
          {data.lat.toFixed(4)}°, {data.lon.toFixed(4)}°
        </Text>
        <Text variant="subtext" muted>
          {data.report_count} report{data.report_count === 1 ? "" : "s"} · confidence{" "}
          {(data.confidence * 100).toFixed(0)}%
        </Text>
      </View>

      <View
        style={{
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: t.space.lg,
          gap: t.space.sm,
        }}
      >
        <Text variant="label" muted>first seen</Text>
        <Text variant="mono">{new Date(data.first_seen_at).toLocaleString()}</Text>
        <View style={{ height: t.space.sm }} />
        <Text variant="label" muted>last seen</Text>
        <Text variant="mono">{new Date(data.last_seen_at).toLocaleString()}</Text>
      </View>

      {data.photo_urls.length > 0 && (
        <View style={{ gap: t.space.sm }}>
          <Text variant="label" muted>photos</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.space.sm }}>
            {data.photo_urls.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: t.radius.md,
                  backgroundColor: t.colors.surfaceAlt,
                }}
                contentFit="cover"
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
