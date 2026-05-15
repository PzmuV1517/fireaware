import { useQueryClient } from "@tanstack/react-query";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LoginIsland } from "@/components/LoginIsland";
import { useMapShell } from "@/components/MapShell";
import { bearingBetween } from "@/components/map/types";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { Toggle } from "@/components/ui/Toggle";
import { WebNavBar } from "@/components/ui/WebNavBar";
import { WeatherWidget } from "@/components/ui/WeatherWidget";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/theme";

type LatLon = { lat: number; lon: number };

export default function PublicMapScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { accessToken, role } = useAuth();
  const { setConfig, bumpRedraw, refetch } = useMapShell();
  const [showReports, setShowReports] = useState(false);

  // web-only pin-drop demo state
  const [pinMode, setPinMode] = useState(false);
  const [observer, setObserver] = useState<LatLon | null>(null);
  const [target, setTarget] = useState<LatLon | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const bearing =
    observer && target ? bearingBetween(observer.lat, observer.lon, target.lat, target.lon) : null;

  const handleMapClick = useCallback(
    (coord: LatLon) => {
      if (!pinMode) return;
      if (!observer) setObserver(coord);
      else setTarget(coord);
    },
    [pinMode, observer],
  );

  // sync this screen's overrides into the shared MapShell every time relevant
  // state changes. On unfocus we clear the config so mission-control gets a
  // clean slate.
  useFocusEffect(
    useCallback(() => {
      setConfig({
        showReports,
        pin: pinMode ? { observer, target, onMapClick: handleMapClick } : undefined,
        onSelectFire: pinMode ? undefined : (id) => router.push(`/fire/${id}`),
      });
      return () => setConfig({});
    }, [showReports, pinMode, observer, target, handleMapClick, router, setConfig]),
  );

  const resetPin = () => {
    setObserver(null);
    setTarget(null);
    setSubmitError(null);
  };

  const cancelPin = () => {
    setPinMode(false);
    resetPin();
    bumpRedraw();
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
      setShowReports(true);
      await refetch();
      resetPin();
      bumpRedraw();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        {accessToken ? (
          Platform.OS === "web" ? (
            <WebNavBar currentPage="map" isFireman={role === "fireman"} />
          ) : (
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
              <Link href="/(app)/map" asChild>
                <Pressable style={{ marginTop: t.space.sm }}>
                  <Text variant="label" color={t.colors.accent}>
                    Open app →
                  </Text>
                </Pressable>
              </Link>
            </View>
          )
        ) : (
          <LoginIsland />
        )}

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

      {!pinMode && (
        <SafeAreaView pointerEvents="box-none" style={styles.bottomLeft}>
          <WeatherWidget />
        </SafeAreaView>
      )}

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
    </>
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
  bottomLeft: {
    position: "absolute",
    bottom: 24, // clears the maplibre attribution strip
    right: 0,
    padding: 16,
  },
});
