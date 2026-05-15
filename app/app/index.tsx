import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MapView } from "@/components/map/MapView";
import { bearingBetween } from "@/components/map/types";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Toggle } from "@/components/ui/Toggle";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useInitialMapCenter } from "@/lib/useInitialMapCenter";
import { useTheme } from "@/theme";

type LatLon = { lat: number; lon: number };

export default function PublicMapScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { accessToken } = useAuth();
  const [showReports, setShowReports] = useState(false);
  const mapCenter = useInitialMapCenter();

  // web-only pin-drop demo state
  const [pinMode, setPinMode] = useState(false);
  const [observer, setObserver] = useState<LatLon | null>(null);
  const [target, setTarget] = useState<LatLon | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [redrawTick, setRedrawTick] = useState(0);

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

  const bearing =
    observer && target ? bearingBetween(observer.lat, observer.lon, target.lat, target.lon) : null;

  const handleMapClick = (coord: LatLon) => {
    if (!pinMode) return;
    if (!observer) setObserver(coord);
    else setTarget(coord);
  };

  const resetPin = () => {
    setObserver(null);
    setTarget(null);
    setSubmitError(null);
  };

  const cancelPin = () => {
    setPinMode(false);
    resetPin();
    // force the map to reapply fires/reports — covers the case where the
    // structurally-shared array reference would otherwise leave the layers stale
    setRedrawTick((n) => n + 1);
  };

  const submitPin = async () => {
    if (!observer || !target || bearing == null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.reports.submitDemo({
        lat: observer.lat,
        lon: observer.lon,
        bearing_deg: bearing,
      });
      // surface the just-dropped pin to the user
      setShowReports(true);
      await Promise.all([
        qc.refetchQueries({ queryKey: ["fires"] }),
        qc.refetchQueries({ queryKey: ["reports", "public"] }),
      ]);
      resetPin();
      setRedrawTick((n) => n + 1);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
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
          showReports={showReports}
          pin={
            pinMode
              ? { observer, target, onMapClick: handleMapClick }
              : undefined
          }
          redrawTick={redrawTick}
          initialCenter={mapCenter.center}
          initialZoom={mapCenter.zoom}
          onSelectFire={(id) => (pinMode ? null : router.push(`/fire/${id}`))}
        />
      )}

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
              Get the mobile app to submit a real sighting.
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
            onChange={(v) => {
              setShowReports(v);
              if (v) qc.refetchQueries({ queryKey: ["reports", "public"] });
            }}
          />
          {Platform.OS === "web" && (
            <Toggle
              label={pinMode ? "Pin mode on" : "Drop a pin (demo)"}
              value={pinMode}
              onChange={(v) => {
                setPinMode(v);
                if (!v) resetPin();
              }}
            />
          )}
        </View>
      </SafeAreaView>

      {Platform.OS === "web" && pinMode && (
        <SafeAreaView pointerEvents="box-none" style={styles.bottom}>
          <View
            style={{
              backgroundColor: t.colors.surface,
              borderColor: t.colors.border,
              borderWidth: 1,
              borderRadius: t.radius.lg,
              padding: t.space.lg,
              gap: t.space.sm,
              maxWidth: 420,
              alignSelf: "center",
            }}
          >
            <Text variant="label" muted>
              demo · pin drop
            </Text>
            <Text variant="subtext">
              {!observer
                ? "Click the map where you’re standing."
                : !target
                  ? "Click toward what you’re seeing."
                  : `Bearing ${bearing!.toFixed(0)}° — submit or refine the target.`}
            </Text>
            {submitError && (
              <Text variant="subtext" color={t.colors.danger}>
                {submitError}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: t.space.sm, marginTop: t.space.xs }}>
              <Button
                label="Submit"
                disabled={!observer || !target || submitting}
                loading={submitting}
                onPress={submitPin}
              />
              <Button
                label="Reset"
                variant="secondary"
                disabled={(!observer && !target) || submitting}
                onPress={resetPin}
              />
              <View style={{ flex: 1 }} />
              <Button label="Done" variant="secondary" onPress={cancelPin} />
            </View>
          </View>
        </SafeAreaView>
      )}
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
    flexWrap: "wrap",
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
});
