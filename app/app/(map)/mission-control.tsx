import { Ionicons } from "@expo/vector-icons";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMapShell } from "@/components/MapShell";
import { haversineM } from "@/components/map/types";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { WebNavBar } from "@/components/ui/WebNavBar";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme";

const ZONE_COLORS = ["#C9532A", "#E8A317", "#2A7FC9", "#2AC968"];

export default function MissionControlScreen() {
  const t = useTheme();
  const router = useRouter();
  const { role, hydrated } = useAuth();
  const { setConfig, refetch, fires, waterReserves, resolveFire } = useMapShell();
  const [resolving, setResolving] = useState<string | null>(null);

  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [color, setColor] = useState(ZONE_COLORS[0]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleMapClick = useCallback(
    (coord: { lat: number; lon: number }) => {
      if (!drawing) return;
      setPoints((prev) => [...prev, [coord.lon, coord.lat]]);
    },
    [drawing],
  );

  // sync this screen's map config into the shell whenever drawing state changes
  useFocusEffect(
    useCallback(() => {
      setConfig({
        showReports: true,
        showClosestWater: true,
        drawingPoints: drawing ? points : undefined,
        onMapClick: drawing ? handleMapClick : undefined,
        onSelectFire: drawing ? undefined : (id) => router.push(`/fire/${id}`),
      });
      return () => setConfig({});
    }, [drawing, points, handleMapClick, router, setConfig]),
  );

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      await resolveFire(id);
    } finally {
      setResolving(null);
    }
  };

  if (!hydrated) return null;
  if (role !== "fireman") return <Redirect href="/" />;

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
      await refetch();
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
    <>
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
        <SafeAreaView pointerEvents="box-none" style={styles.sidebar}>
          <View
            style={[
              styles.sidebarCard,
              { backgroundColor: t.colors.surface, borderColor: t.colors.border },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text variant="label" muted>
                active fires
              </Text>
              <Text variant="caption" muted>
                {fires.length}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {fires.length === 0 ? (
                <Text variant="subtext" muted>
                  no active incidents
                </Text>
              ) : (
                fires.map((f) => {
                  const reserve = nearestReserve(f.lat, f.lon, waterReserves);
                  const isResolving = resolving === f.id;
                  return (
                    <View
                      key={f.id}
                      style={{
                        paddingVertical: t.space.sm,
                        borderBottomColor: t.colors.border,
                        borderBottomWidth: 1,
                        gap: 4,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Text variant="mono" style={{ fontSize: 12 }}>
                          {f.lat.toFixed(4)}°, {f.lon.toFixed(4)}°
                        </Text>
                        <Text variant="caption" muted>
                          {(f.confidence * 100).toFixed(0)}% · {f.report_count} reports
                        </Text>
                      </View>
                      {reserve ? (
                        <Text variant="caption" color="#2A7FC9">
                          ↳ {reserve.name} · {fmtKm(reserve.distance_m)}
                        </Text>
                      ) : (
                        <Text variant="caption" muted>
                          no water reserve known
                        </Text>
                      )}
                      <Pressable
                        onPress={() => handleResolve(f.id)}
                        disabled={isResolving}
                        style={({ pressed }) => ({
                          alignSelf: "flex-start",
                          marginTop: 4,
                          paddingHorizontal: t.space.md,
                          paddingVertical: 6,
                          borderRadius: t.radius.pill,
                          borderWidth: 1.5,
                          borderColor: t.colors.accent,
                          backgroundColor: pressed ? t.colors.accent : "transparent",
                          opacity: isResolving ? 0.5 : 1,
                        })}
                      >
                        {({ pressed }) => (
                          <Text
                            variant="label"
                            color={pressed ? "#FFFFFF" : t.colors.accent}
                          >
                            {isResolving ? "resolving…" : "incident resolved"}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      )}

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
    </>
  );
}

function fmtKm(m: number): string {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}

function nearestReserve(
  lat: number,
  lon: number,
  reserves: { id: string; lat: number; lon: number; name: string }[],
): { id: string; name: string; distance_m: number } | null {
  let best: { id: string; name: string; distance_m: number } | null = null;
  for (const r of reserves) {
    const d = haversineM(lat, lon, r.lat, r.lon);
    if (!best || d < best.distance_m) best = { id: r.id, name: r.name, distance_m: d };
  }
  return best;
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
  sidebar: {
    position: "absolute",
    top: 80, // sits below the WebNavBar
    right: 0,
    padding: 16,
    alignItems: "flex-end",
  },
  sidebarCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    width: 340,
    maxHeight: 380,
  },
  toolbar: {
    position: "absolute",
    bottom: 24, // clears the maplibre attribution strip
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
