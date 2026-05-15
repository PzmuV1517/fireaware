import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useReportDraft } from "@/lib/reportDraft";
import { useTheme } from "@/theme";

export default function Capture() {
  const t = useTheme();
  const router = useRouter();
  const draft = useReportDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [heading, setHeading] = useState<number | null>(draft.bearingDeg);
  const [busy, setBusy] = useState(false);
  const pinMode = draft.pinDrop;

  useEffect(() => {
    if (pinMode) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      sub = await Location.watchHeadingAsync((h) => {
        setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading);
      });
    })();
    return () => sub?.remove();
  }, [pinMode]);

  if (!permission) {
    return (
      <View style={{ flex: 1, padding: t.space.lg }}>
        <Text variant="subtext" muted>requesting camera…</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, padding: t.space.lg, gap: t.space.md, justifyContent: "center" }}>
        <Text variant="h2">Camera access needed</Text>
        <Text variant="subtext" muted>
          we need the camera to attach a photo to your sighting
        </Text>
        <Button label="Grant access" onPress={requestPermission} />
      </View>
    );
  }

  const shoot = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.75,
        skipProcessing: false,
      });
      if (!photo) return;
      if (pinMode) {
        // pin-drop: keep the lat/lon/bearing the user explicitly placed
        draft.set({
          photoUri: photo.uri,
          photoMime: "image/jpeg",
          takenAt: new Date().toISOString(),
        });
      } else {
        // capture position again at shutter for the live-sensor flow
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        draft.set({
          photoUri: photo.uri,
          photoMime: "image/jpeg",
          bearingDeg: heading ?? draft.bearingDeg,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          gpsAccM: pos.coords.accuracy ?? draft.gpsAccM,
          takenAt: new Date().toISOString(),
        });
      }
      router.push("/(app)/report/confirm");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

      <View pointerEvents="none" style={styles.crosshairContainer}>
        <View style={[styles.crosshairLineV, { backgroundColor: t.colors.accent }]} />
        <View style={[styles.crosshairLineH, { backgroundColor: t.colors.accent }]} />
        <View style={[styles.crosshairDot, { borderColor: t.colors.accent }]} />
      </View>

      <SafeAreaView style={styles.top}>
        <View
          style={[
            styles.headingBadge,
            { backgroundColor: "rgba(0,0,0,0.55)", borderColor: "rgba(255,255,255,0.2)" },
          ]}
        >
          <Text variant="label" color="#FFFFFFCC">
            {pinMode ? "pinned bearing" : "bearing"}
          </Text>
          <Text variant="mono" color="#FFFFFF" style={{ fontSize: 20 }}>
            {heading != null ? `${heading.toFixed(0)}°` : "—"}
          </Text>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottom}>
        <Pressable
          onPress={shoot}
          disabled={busy}
          style={[
            styles.shutter,
            { borderColor: "#FFFFFF", backgroundColor: busy ? "#FFFFFF44" : "transparent" },
          ]}
        >
          <View style={[styles.shutterInner, { backgroundColor: t.colors.accent }]} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  crosshairContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  crosshairLineV: { position: "absolute", width: 1, height: 80, opacity: 0.8 },
  crosshairLineH: { position: "absolute", height: 1, width: 80, opacity: 0.8 },
  crosshairDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 12,
  },
  headingBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 24,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30 },
});
