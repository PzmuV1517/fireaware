import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MapView } from "@/components/map/MapView";
import { Text } from "@/components/ui/Text";
import { Toggle } from "@/components/ui/Toggle";
import { api } from "@/lib/api";
import { useInitialMapCenter } from "@/lib/useInitialMapCenter";
import { useTheme } from "@/theme";

export default function AppMap() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [showReports, setShowReports] = useState(false);
  const mapCenter = useInitialMapCenter();

  const { data: fires } = useQuery({
    queryKey: ["fires", "all"],
    queryFn: () => api.fires.list(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => api.reports.list({ sinceMin: 240 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
    placeholderData: keepPreviousData,
    enabled: showReports,
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {mapCenter && (
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
          initialCenter={mapCenter.center}
          initialZoom={mapCenter.zoom}
          onSelectFire={(id) => router.push(`/fire/${id}`)}
        />
      )}
      <SafeAreaView pointerEvents="box-none" style={styles.top}>
        <Toggle
          label={showReports ? "Reports on" : "Show reports"}
          value={showReports}
          onChange={(v) => {
            setShowReports(v);
            if (v) qc.refetchQueries({ queryKey: ["reports", "public"] });
          }}
        />
        <View style={{ flex: 1 }} />
        <Link href="/(app)/settings" asChild>
          <Pressable
            accessibilityLabel="Open settings"
            style={({ pressed }) => ({
              backgroundColor: t.colors.surface,
              borderColor: t.colors.border,
              borderWidth: 1,
              width: 40,
              height: 40,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name="settings-outline" size={20} color={t.colors.ink} />
          </Pressable>
        </Link>
      </SafeAreaView>
      <SafeAreaView pointerEvents="box-none" style={styles.bottomBar}>
        <Link href="/(app)/report" asChild>
          <Pressable
            style={{
              backgroundColor: t.colors.accent,
              paddingVertical: t.space.md,
              paddingHorizontal: t.space.xl,
              borderRadius: t.radius.pill,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
            }}
          >
            <Text variant="h4" color="#FFFFFF" style={{ letterSpacing: 0.5 }}>
              Report a fire
            </Text>
          </Pressable>
        </Link>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    padding: 16,
  },
});
