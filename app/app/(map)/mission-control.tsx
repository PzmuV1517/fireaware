import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { MapView } from "@/components/map/MapView";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { WebNavBar } from "@/components/ui/WebNavBar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInitialMapCenter } from "@/lib/useInitialMapCenter";
import { useTheme } from "@/theme";

const ZONE_COLORS = ["#C9532A", "#E8A317", "#2A7FC9", "#2AC968"];

export default function MissionControlScreen() {
  const t = useTheme();
  const router = useRouter();
  const { role, hydrated } = useAuth();
  const mapCenter = useInitialMapCenter();

  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [color, setColor] = useState(ZONE_COLORS[0]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: fires } = useQuery({
    queryKey: ["fires", "all"],
    queryFn: () => api.fires.list(),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const { data: reports } = useQuery({
    queryKey: ["reports", "public"],
    queryFn: () => api.reports.list({ sinceMin: 240 }),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const { data: fireZones, refetch: refetchZones } = useQuery({
    queryKey: ["fire-zones"],
    queryFn: () => api.fireZones.list(),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  if (!hydrated) return null;
  if (role !== "fireman") return <Redirect href="/" />;

  const handleMapClick = (coord: { lat: number; lon: number }) => {
    if (!drawing) return;
    setPoints((prev) => [...prev, [coord.lon, coord.lat]]);
  };

  const handleUndo = () => setPoints((prev) => prev.slice(0, -1));

  const handleSave = async () => {
    if (points.length < 3) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.fireZones.create({
        coordinates: points,
        label: label.trim() || null,
        color,
      });
      setPoints([]);
      setLabel("");
      setDrawing(false);
      await refetchZones();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save zone");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPoints([]);
    setLabel("");
    setDrawing(false);
    setSaveError(null);
  };

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
          showReports
          fireZones={(fireZones ?? []).map((z) => ({
            id: z.id,
            coordinates: z.coordinates as [number, number][],
            label: z.label,
            color: z.color,
          }))}
          drawingPoints={drawing ? points : undefined}
          onMapClick={drawing ? handleMapClick : undefined}
          initialCenter={mapCenter.center}
          initialZoom={mapCenter.zoom}
          onSelectFire={(id) => (drawing ? undefined : router.push(`/fire/${id}`))}
        />
      )}

      <SafeAreaView pointerEvents="box-none" style={styles.header}>
        {Platform.OS === "web" ? (
          <WebNavBar currentPage="mission-control" isFireman />
        ) : (
          <View
            style={[
              styles.headerCard,
              { backgroundColor: t.colors.surface, borderColor: t.colors.border },
            ]}
          >
            <Text variant="h3">Mission Control</Text>
            <Pressable
              onPress={() => router.back()}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
            >
              <Ionicons name="arrow-back" size={14} color={t.colors.accent} />
              <Text variant="label" color={t.colors.accent}>
                Back to map
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      {Platform.OS === "web" && (
        <SafeAreaView pointerEvents="box-none" style={styles.toolbar}>
          {!drawing ? (
            <Button label="Draw zone" onPress={() => setDrawing(true)} />
          ) : (
            <View
              style={[
                styles.toolbarCard,
                { backgroundColor: t.colors.surface, borderColor: t.colors.border },
              ]}
            >
              <Text variant="label" muted>
                {points.length === 0
                  ? "Click the map to add vertices"
                  : points.length < 3
                    ? `${points.length} point${points.length > 1 ? "s" : ""} — need at least 3`
                    : `${points.length} vertices — ready to save`}
              </Text>

              <View style={{ flexDirection: "row", gap: t.space.sm, alignItems: "center" }}>
                <Text variant="caption" muted>
                  Color:
                </Text>
                {ZONE_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: c,
                      borderWidth: color === c ? 3 : 1,
                      borderColor: color === c ? t.colors.ink : "transparent",
                    }}
                  />
                ))}
              </View>

              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Zone label (optional)"
                placeholderTextColor={t.colors.inkMuted}
                style={{
                  borderWidth: 1,
                  borderColor: t.colors.border,
                  borderRadius: t.radius.md,
                  paddingHorizontal: t.space.md,
                  paddingVertical: t.space.sm,
                  color: t.colors.ink,
                  fontFamily: t.fonts.body,
                  fontSize: 14,
                  backgroundColor: t.colors.bg,
                }}
              />

              {saveError && (
                <Text variant="caption" color={t.colors.danger}>
                  {saveError}
                </Text>
              )}

              <View style={{ flexDirection: "row", gap: t.space.sm }}>
                <Button
                  label="Save"
                  onPress={handleSave}
                  disabled={points.length < 3 || saving}
                  loading={saving}
                />
                <Button
                  label="Undo"
                  variant="secondary"
                  disabled={points.length === 0}
                  onPress={handleUndo}
                />
                <Button label="Cancel" variant="secondary" onPress={handleCancel} />
              </View>
            </View>
          )}
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  headerCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    alignSelf: "flex-start",
  },
  toolbar: {
    position: "absolute",
    bottom: 0,
    right: 0,
    padding: 16,
    alignItems: "flex-end",
  },
  toolbarCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    maxWidth: 480,
  },
});
