import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
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

const ZONE_COLORS = ["#C9532A", "#2AC968"];

export default function MissionControlScreen() {
  const t = useTheme();
  const router = useRouter();
  const { role, hydrated } = useAuth();
  const { setConfig, refetch, fires, waterReserves, resolveFire } = useMapShell();

  // fire incidents
  const [resolving, setResolving] = useState<string | null>(null);

  // fire zones
  const [deletingZone, setDeletingZone] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [color, setColor] = useState(ZONE_COLORS[0]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // cutting lines
  const [deletingLine, setDeletingLine] = useState<string | null>(null);
  const [drawingLine, setDrawingLine] = useState(false);
  const [linePoints, setLinePoints] = useState<[number, number][]>([]);
  const [lineLabel, setLineLabel] = useState("");
  const [lineRange, setLineRange] = useState("");
  const [savingLine, setSavingLine] = useState(false);
  const [saveLineError, setSaveLineError] = useState<string | null>(null);

  // water reserves
  const [deletingWater, setDeletingWater] = useState<string | null>(null);
  const [placingWater, setPlacingWater] = useState(false);
  const [pendingWaterCoord, setPendingWaterCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [waterName, setWaterName] = useState("");
  const [waterCapacity, setWaterCapacity] = useState("");
  const [savingWater, setSavingWater] = useState(false);

  const { data: fireZones = [] } = useQuery({
    queryKey: ["fire-zones"],
    queryFn: () => api.fireZones.list(),
    refetchInterval: 60_000,
  });

  const { data: cuttingLines = [] } = useQuery({
    queryKey: ["cutting-lines"],
    queryFn: () => api.cuttingLines.list(),
    refetchInterval: 60_000,
  });

  const handleMapClick = useCallback(
    (coord: { lat: number; lon: number }) => {
      if (drawing) {
        setPoints((prev) => [...prev, [coord.lon, coord.lat]]);
      } else if (drawingLine) {
        setLinePoints((prev) => [...prev, [coord.lon, coord.lat]]);
      } else if (placingWater) {
        setPendingWaterCoord(coord);
        setPlacingWater(false);
      }
    },
    [drawing, drawingLine, placingWater],
  );

  useFocusEffect(
    useCallback(() => {
      const anyMode = drawing || drawingLine || placingWater;
      setConfig({
        showReports: true,
        showClosestWater: true,
        drawingPoints: drawing ? points : drawingLine ? linePoints : undefined,
        onMapClick: anyMode ? handleMapClick : undefined,
        onSelectFire: anyMode ? undefined : (id) => router.push(`/fire/${id}`),
        styleUrl: "https://tiles.openfreemap.org/styles/bright",
        hidePois: true,
      });
      return () => setConfig({});
    }, [drawing, points, drawingLine, linePoints, placingWater, handleMapClick, router, setConfig]),
  );

  if (!hydrated) return null;
  if (role !== "fireman") return <Redirect href="/" />;

  // ── fire zone handlers ──────────────────────────────────────────────────
  const handleResolve = async (id: string) => {
    setResolving(id);
    try { await resolveFire(id); } finally { setResolving(null); }
  };

  const handleDeleteZone = async (id: string) => {
    setDeletingZone(id);
    try { await api.fireZones.delete(id); await refetch(); } finally { setDeletingZone(null); }
  };

  const handleSaveZone = async () => {
    if (points.length < 3) return;
    setSaving(true); setSaveError(null);
    try {
      await api.fireZones.create({ coordinates: points, label: label.trim() || null, color });
      setPoints([]); setLabel(""); setDrawing(false);
      await refetch();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save zone");
    } finally { setSaving(false); }
  };

  const handleCancelZone = () => { setPoints([]); setLabel(""); setDrawing(false); setSaveError(null); };

  // ── cutting line handlers ───────────────────────────────────────────────
  const handleDeleteLine = async (id: string) => {
    setDeletingLine(id);
    try { await api.cuttingLines.delete(id); await refetch(); } finally { setDeletingLine(null); }
  };

  const handleSaveLine = async () => {
    if (linePoints.length < 2) return;
    setSavingLine(true); setSaveLineError(null);
    try {
      const range_m = parseFloat(lineRange) || 0;
      await api.cuttingLines.create({ coordinates: linePoints, label: lineLabel.trim() || null, range_m });
      setLinePoints([]); setLineLabel(""); setLineRange(""); setDrawingLine(false);
      await refetch();
    } catch (e) {
      setSaveLineError(e instanceof Error ? e.message : "Failed to save line");
    } finally { setSavingLine(false); }
  };

  const handleCancelLine = () => { setLinePoints([]); setLineLabel(""); setLineRange(""); setDrawingLine(false); setSaveLineError(null); };

  // ── water reserve handlers ──────────────────────────────────────────────
  const handleDeleteWater = async (id: string) => {
    setDeletingWater(id);
    try { await api.waterReserves.delete(id); await refetch(); } finally { setDeletingWater(null); }
  };

  const handleSaveWater = async () => {
    if (!pendingWaterCoord || !waterName.trim()) return;
    setSavingWater(true);
    try {
      await api.waterReserves.create({
        lat: pendingWaterCoord.lat,
        lon: pendingWaterCoord.lon,
        name: waterName.trim(),
        capacity_l: waterCapacity ? (parseInt(waterCapacity, 10) || null) : null,
      });
      setPendingWaterCoord(null); setWaterName(""); setWaterCapacity("");
      await refetch();
    } finally { setSavingWater(false); }
  };

  const handleCancelWater = () => {
    setPendingWaterCoord(null); setWaterName(""); setWaterCapacity("");
    setPlacingWater(false);
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.radius.md,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.sm,
    color: t.colors.ink,
    fontFamily: t.fonts.body,
    fontSize: 14,
    backgroundColor: t.colors.bg,
  };

  const isIdle = !drawing && !drawingLine;

  return (
    <>
      <SafeAreaView pointerEvents="box-none" style={styles.header}>
        {Platform.OS === "web" ? (
          <WebNavBar currentPage="mission-control" isFireman />
        ) : (
          <View style={[styles.headerCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
            <Text variant="h3">Mission Control</Text>
            <Pressable
              onPress={() => router.back()}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}
            >
              <Ionicons name="arrow-back" size={14} color={t.colors.accent} />
              <Text variant="label" color={t.colors.accent}>Back to map</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      {Platform.OS === "web" && (
        <SafeAreaView pointerEvents="box-none" style={styles.sidebar}>
          <ScrollView
            style={{ flex: 1, width: 340 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── fire zones ── */}
            <View style={[styles.sidebarCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="label" muted>fire zones</Text>
                <Text variant="caption" muted>{fireZones.length}</Text>
              </View>
              <ScrollView style={{ maxHeight: 140 }}>
                {fireZones.length === 0 ? (
                  <Text variant="subtext" muted>no zones defined</Text>
                ) : (
                  fireZones.map((z) => {
                    const isDeleting = deletingZone === z.id;
                    return (
                      <View key={z.id} style={{ paddingVertical: t.space.sm, borderBottomColor: t.colors.border, borderBottomWidth: 1, gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: z.color }} />
                          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{z.label ?? "unlabeled"}</Text>
                          <Text variant="mono" style={{ fontSize: 11 }} muted>{fmtArea(z.area_m2)}</Text>
                        </View>
                        <Pressable
                          onPress={() => handleDeleteZone(z.id)}
                          disabled={isDeleting}
                          style={({ pressed }) => removeButtonStyle(t, pressed, isDeleting)}
                        >
                          {({ pressed }) => (
                            <Text variant="label" color={pressed ? "#fff" : t.colors.danger}>
                              {isDeleting ? "removing…" : "remove zone"}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* ── cutting lines ── */}
            <View style={[styles.sidebarCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="label" muted>cutting lines</Text>
                <Text variant="caption" muted>{cuttingLines.length}</Text>
              </View>
              <ScrollView style={{ maxHeight: 120 }}>
                {cuttingLines.length === 0 ? (
                  <Text variant="subtext" muted>no cutting lines defined</Text>
                ) : (
                  cuttingLines.map((l) => {
                    const isDeleting = deletingLine === l.id;
                    return (
                      <View key={l.id} style={{ paddingVertical: t.space.sm, borderBottomColor: t.colors.border, borderBottomWidth: 1, gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 20, height: 3, backgroundColor: "#E8A317", borderRadius: 2 }} />
                          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{l.label ?? "unlabeled"}</Text>
                          <Text variant="mono" style={{ fontSize: 11 }} muted>{fmtKm(l.length_m)}</Text>
                          {l.range_m > 0 && (
                            <Text variant="mono" style={{ fontSize: 11 }} muted>±{l.range_m}m</Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => handleDeleteLine(l.id)}
                          disabled={isDeleting}
                          style={({ pressed }) => removeButtonStyle(t, pressed, isDeleting)}
                        >
                          {({ pressed }) => (
                            <Text variant="label" color={pressed ? "#fff" : t.colors.danger}>
                              {isDeleting ? "removing…" : "remove line"}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* ── water reserves ── */}
            <View style={[styles.sidebarCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="label" muted>water reserves</Text>
                <Text variant="caption" muted>{waterReserves.length}</Text>
              </View>
              <ScrollView style={{ maxHeight: 120 }}>
                {waterReserves.length === 0 ? (
                  <Text variant="subtext" muted>no reserves added</Text>
                ) : (
                  waterReserves.map((r) => {
                    const isDeleting = deletingWater === r.id;
                    return (
                      <View key={r.id} style={{ paddingVertical: t.space.sm, borderBottomColor: t.colors.border, borderBottomWidth: 1, gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#2A7FC9" }} />
                          <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{r.name}</Text>
                          {r.capacity_l != null && (
                            <Text variant="mono" style={{ fontSize: 11 }} muted>{fmtCapacity(r.capacity_l)}</Text>
                          )}
                        </View>
                        <Pressable
                          onPress={() => handleDeleteWater(r.id)}
                          disabled={isDeleting}
                          style={({ pressed }) => removeButtonStyle(t, pressed, isDeleting)}
                        >
                          {({ pressed }) => (
                            <Text variant="label" color={pressed ? "#fff" : t.colors.danger}>
                              {isDeleting ? "removing…" : "remove"}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </ScrollView>

              {pendingWaterCoord ? (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text variant="caption" muted>
                    {pendingWaterCoord.lat.toFixed(4)}°, {pendingWaterCoord.lon.toFixed(4)}° — name this point:
                  </Text>
                  <TextInput
                    value={waterName}
                    onChangeText={setWaterName}
                    placeholder="Name (required)"
                    placeholderTextColor={t.colors.inkMuted}
                    style={inputStyle}
                  />
                  <TextInput
                    value={waterCapacity}
                    onChangeText={setWaterCapacity}
                    placeholder="Capacity in litres (optional)"
                    placeholderTextColor={t.colors.inkMuted}
                    keyboardType="numeric"
                    style={inputStyle}
                  />
                  <View style={{ flexDirection: "row", gap: t.space.sm }}>
                    <Button
                      label="Save"
                      onPress={handleSaveWater}
                      disabled={!waterName.trim() || savingWater}
                      loading={savingWater}
                    />
                    <Button label="Cancel" variant="secondary" onPress={handleCancelWater} />
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setPlacingWater(true)}
                  disabled={placingWater}
                  style={({ pressed }) => ({
                    marginTop: 4,
                    paddingHorizontal: t.space.md,
                    paddingVertical: 8,
                    borderRadius: t.radius.pill,
                    borderWidth: 1.5,
                    borderColor: "#2A7FC9",
                    backgroundColor: pressed ? "#2A7FC9" : "transparent",
                    alignItems: "center",
                    opacity: placingWater ? 0.5 : 1,
                  })}
                >
                  {({ pressed }) => (
                    <Text variant="label" color={pressed ? "#fff" : "#2A7FC9"}>
                      {placingWater ? "click map to place…" : "+ add water point"}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* ── active fires ── */}
            <View style={[styles.sidebarCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text variant="label" muted>active fires</Text>
                <Text variant="caption" muted>{fires.length}</Text>
              </View>
              <ScrollView style={{ maxHeight: 200 }}>
                {fires.length === 0 ? (
                  <Text variant="subtext" muted>no active incidents</Text>
                ) : (
                  fires.map((f) => {
                    const reserve = nearestReserve(f.lat, f.lon, waterReserves);
                    const isResolving = resolving === f.id;
                    return (
                      <View key={f.id} style={{ paddingVertical: t.space.sm, borderBottomColor: t.colors.border, borderBottomWidth: 1, gap: 4 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text variant="mono" style={{ fontSize: 12 }}>{f.lat.toFixed(4)}°, {f.lon.toFixed(4)}°</Text>
                          <Text variant="caption" muted>{(f.confidence * 100).toFixed(0)}% · {f.report_count} reports</Text>
                        </View>
                        {reserve ? (
                          <Text variant="caption" color="#2A7FC9">↳ {reserve.name} · {fmtKm(reserve.distance_m)}</Text>
                        ) : (
                          <Text variant="caption" muted>no water reserve known</Text>
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
                            <Text variant="label" color={pressed ? "#FFFFFF" : t.colors.accent}>
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
          </ScrollView>
        </SafeAreaView>
      )}

      {Platform.OS === "web" && (
        <SafeAreaView pointerEvents="box-none" style={styles.toolbar}>
          {isIdle ? (
            <View style={{ flexDirection: "row", gap: t.space.sm }}>
              <Button label="Draw zone" onPress={() => setDrawing(true)} />
              <Button label="Draw cutting line" variant="secondary" onPress={() => setDrawingLine(true)} />
            </View>
          ) : drawing ? (
            <View style={[styles.toolbarCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <Text variant="label" muted>
                {points.length === 0
                  ? "Click the map to add vertices"
                  : points.length < 3
                    ? `${points.length} point${points.length > 1 ? "s" : ""} — need at least 3`
                    : `${points.length} vertices — ready to save`}
              </Text>

              <View style={{ flexDirection: "row", gap: t.space.sm, alignItems: "center" }}>
                <Text variant="caption" muted>Color:</Text>
                {ZONE_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: 12,
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
                style={inputStyle}
              />

              {saveError && <Text variant="caption" color={t.colors.danger}>{saveError}</Text>}

              <View style={{ flexDirection: "row", gap: t.space.sm }}>
                <Button label="Save" onPress={handleSaveZone} disabled={points.length < 3 || saving} loading={saving} />
                <Button label="Undo" variant="secondary" disabled={points.length === 0} onPress={() => setPoints((p) => p.slice(0, -1))} />
                <Button label="Cancel" variant="secondary" onPress={handleCancelZone} />
              </View>
            </View>
          ) : (
            <View style={[styles.toolbarCard, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
              <Text variant="label" muted>
                {linePoints.length === 0
                  ? "Click the map to add points"
                  : linePoints.length < 2
                    ? "1 point — need at least 2"
                    : `${linePoints.length} points — ready to save`}
              </Text>

              <TextInput
                value={lineLabel}
                onChangeText={setLineLabel}
                placeholder="Line label (optional)"
                placeholderTextColor={t.colors.inkMuted}
                style={inputStyle}
              />
              <TextInput
                value={lineRange}
                onChangeText={setLineRange}
                placeholder="Corridor range (m)"
                placeholderTextColor={t.colors.inkMuted}
                keyboardType="numeric"
                style={inputStyle}
              />

              {saveLineError && <Text variant="caption" color={t.colors.danger}>{saveLineError}</Text>}

              <View style={{ flexDirection: "row", gap: t.space.sm }}>
                <Button label="Save" onPress={handleSaveLine} disabled={linePoints.length < 2 || savingLine} loading={savingLine} />
                <Button label="Undo" variant="secondary" disabled={linePoints.length === 0} onPress={() => setLinePoints((p) => p.slice(0, -1))} />
                <Button label="Cancel" variant="secondary" onPress={handleCancelLine} />
              </View>
            </View>
          )}
        </SafeAreaView>
      )}
    </>
  );
}

function removeButtonStyle(
  t: ReturnType<typeof useTheme>,
  pressed: boolean,
  disabled: boolean,
) {
  return {
    alignSelf: "flex-start" as const,
    marginTop: 2,
    paddingHorizontal: t.space.md,
    paddingVertical: 6,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.danger,
    backgroundColor: pressed ? t.colors.danger : "transparent",
    opacity: disabled ? 0.5 : 1,
  };
}

function fmtKm(m: number): string {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}

function fmtArea(m2: number): string {
  return m2 < 1_000_000
    ? `${Math.round(m2).toLocaleString()} m²`
    : `${(m2 / 1_000_000).toFixed(2)} km²`;
}

function fmtCapacity(l: number): string {
  return l >= 1000 ? `${(l / 1000).toFixed(0)} kL` : `${l} L`;
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
  header: { position: "absolute", top: 0, left: 0, right: 0, padding: 16 },
  headerCard: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 2, alignSelf: "flex-start" },
  sidebar: {
    position: "absolute",
    top: 80,
    // bottom is fixed so the sidebar always stops short of the toolbar,
    // regardless of screen height. The inner ScrollView handles overflow.
    bottom: 250,
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
  },
  toolbar: {
    position: "absolute",
    bottom: 24,
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
