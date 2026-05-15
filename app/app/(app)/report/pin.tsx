import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PinPicker } from "@/components/map/PinPicker";
import type { LatLon } from "@/components/map/PinPickerTypes";
import { bearingBetween } from "@/components/map/types";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useReportDraft } from "@/lib/reportDraft";
import { useInitialMapCenter } from "@/lib/useInitialMapCenter";
import { useTheme } from "@/theme";

export default function PinDrop() {
  const t = useTheme();
  const router = useRouter();
  const draft = useReportDraft();
  const start = useInitialMapCenter();

  const [observer, setObserver] = useState<LatLon | null>(null);
  const [target, setTarget] = useState<LatLon | null>(null);

  const bearing =
    observer && target ? bearingBetween(observer.lat, observer.lon, target.lat, target.lon) : null;

  const handleTap = (coord: LatLon) => {
    if (!observer) setObserver(coord);
    else setTarget(coord); // first or subsequent target tap
  };

  const reset = () => {
    setObserver(null);
    setTarget(null);
  };

  const advance = () => {
    if (!observer || !target || bearing == null) return;
    draft.set({
      lat: observer.lat,
      lon: observer.lon,
      bearingDeg: bearing,
      bearingAccDeg: 1.5,
      gpsAccM: 1,
      pinDrop: true,
    });
    router.push("/(app)/report/capture");
  };

  const instruction = !observer
    ? "Tap the map where you’re standing"
    : !target
      ? "Tap toward what you’re seeing"
      : "Tap again to refine the target, or continue";

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {start && (
        <PinPicker
          start={{
            lat: start.center.lat,
            lon: start.center.lon,
            delta: 360 / Math.pow(2, start.zoom),
          }}
          observer={observer}
          target={target}
          onTap={handleTap}
        />
      )}

      <SafeAreaView pointerEvents="box-none" style={styles.top}>
        <View
          style={{
            backgroundColor: t.colors.surface,
            borderColor: t.colors.border,
            borderWidth: 1,
            borderRadius: t.radius.md,
            paddingVertical: t.space.sm,
            paddingHorizontal: t.space.md,
            gap: 2,
          }}
        >
          <Text variant="label" muted>
            demo · pin drop
          </Text>
          <Text variant="subtext">{instruction}</Text>
          {bearing != null && (
            <Text variant="mono" muted style={{ fontSize: 12, marginTop: 2 }}>
              bearing {bearing.toFixed(0)}°
            </Text>
          )}
        </View>
      </SafeAreaView>

      <SafeAreaView pointerEvents="box-none" style={styles.bottom}>
        <View style={{ flexDirection: "row", gap: t.space.sm }}>
          <Pressable
            onPress={reset}
            disabled={!observer && !target}
            style={{
              backgroundColor: t.colors.surface,
              borderColor: t.colors.border,
              borderWidth: 1,
              paddingHorizontal: t.space.lg,
              paddingVertical: t.space.md,
              borderRadius: t.radius.pill,
              opacity: !observer && !target ? 0.4 : 1,
            }}
          >
            <Text variant="label">reset</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button
              label="Take photo →"
              fullWidth
              disabled={!observer || !target}
              onPress={advance}
            />
          </View>
        </View>
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
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
});
