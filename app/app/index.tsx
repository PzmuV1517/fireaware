import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MapView } from "@/components/map/MapView";
import { Text } from "@/components/ui/Text";
import { Toggle } from "@/components/ui/Toggle";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function PublicMapScreen() {
  const t = useTheme();
  const router = useRouter();
  const { accessToken } = useAuth();
  const [showReports, setShowReports] = useState(false);

  const { data: fires } = useQuery({
    queryKey: ["fires", "all"],
    queryFn: () => api.fires.list(),
    refetchInterval: 30_000,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => api.reports.list({ sinceMin: 240 }),
    refetchInterval: 30_000,
    enabled: showReports,
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <MapView
        fires={(fires ?? []).map((f) => ({
          id: f.id,
          lat: f.lat,
          lon: f.lon,
          confidence: f.confidence,
          reportCount: f.report_count,
        }))}
        reports={(reports ?? []).map((r) => ({
          id: r.id,
          lat: r.lat,
          lon: r.lon,
          bearingDeg: r.bearing_deg,
          matched: r.fire_id != null,
        }))}
        showReports={showReports}
        onSelectFire={(id) => router.push(`/fire/${id}`)}
      />
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View
          style={[
            styles.headerCard,
            { backgroundColor: t.colors.surface, borderColor: t.colors.border },
          ]}
        >
          <Text variant="h2">FireAware</Text>
          <Text variant="subtext" muted>
            community-sighted fires, triangulated and mapped
          </Text>
          {Platform.OS === "web" ? (
            <Text variant="caption" muted style={{ marginTop: t.space.xs }}>
              Get the mobile app to submit a sighting.
            </Text>
          ) : accessToken ? (
            <Link href="/(app)/map" asChild>
              <Pressable style={{ marginTop: t.space.sm }}>
                <Text variant="label" color={t.colors.accent}>
                  Open app →
                </Text>
              </Pressable>
            </Link>
          ) : (
            <Link href="/(auth)/login" asChild>
              <Pressable style={{ marginTop: t.space.sm }}>
                <Text variant="label" color={t.colors.accent}>
                  Sign in to report →
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
        <View style={styles.controlsRow} pointerEvents="box-none">
          <Toggle
            label={showReports ? "Reports on" : "Show reports"}
            value={showReports}
            onChange={setShowReports}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 12,
  },
  headerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    alignSelf: "flex-start",
    maxWidth: 380,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "flex-start",
  },
});
