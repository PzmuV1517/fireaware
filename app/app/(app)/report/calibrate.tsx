import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Magnetometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useReportDraft } from "@/lib/reportDraft";
import { useTheme } from "@/theme";

const GPS_ACC_THRESHOLD_M = 20;
const COMPASS_JITTER_THRESHOLD_DEG = 3;
const COMPASS_SAMPLES = 30; // ~3 s at 10 Hz

interface GpsState {
  lat: number | null;
  lon: number | null;
  acc: number | null;
  status: "idle" | "requesting" | "denied" | "active";
}

interface CompassState {
  heading: number | null;
  accuracy: number | null;
  samples: number[];
  status: "idle" | "denied" | "active";
}

export default function Calibrate() {
  const t = useTheme();
  const router = useRouter();
  const draft = useReportDraft();

  const [gps, setGps] = useState<GpsState>({ lat: null, lon: null, acc: null, status: "idle" });
  const [compass, setCompass] = useState<CompassState>({
    heading: null,
    accuracy: null,
    samples: [],
    status: "idle",
  });

  const gpsSubRef = useRef<Location.LocationSubscription | null>(null);
  const headSubRef = useRef<Location.LocationSubscription | null>(null);
  const magSubRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    (async () => {
      setGps((s) => ({ ...s, status: "requesting" }));
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setGps((s) => ({ ...s, status: "denied" }));
        return;
      }
      setGps((s) => ({ ...s, status: "active" }));

      gpsSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 0, timeInterval: 1000 },
        (loc) => {
          setGps({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
            acc: loc.coords.accuracy ?? null,
            status: "active",
          });
        },
      );

      headSubRef.current = await Location.watchHeadingAsync((h) => {
        setCompass((c) => ({
          ...c,
          heading: h.trueHeading >= 0 ? h.trueHeading : h.magHeading,
          accuracy: h.accuracy ?? c.accuracy,
          status: "active",
        }));
      });

      Magnetometer.setUpdateInterval(100);
      magSubRef.current = Magnetometer.addListener((data) => {
        const deg = (Math.atan2(data.y, data.x) * 180) / Math.PI;
        setCompass((c) => {
          const samples = [...c.samples, deg].slice(-COMPASS_SAMPLES);
          return { ...c, samples };
        });
      });
    })();

    return () => {
      gpsSubRef.current?.remove();
      headSubRef.current?.remove();
      magSubRef.current?.remove();
    };
  }, []);

  const jitter = circularStdDev(compass.samples);
  const gpsOk = gps.acc != null && gps.acc <= GPS_ACC_THRESHOLD_M;
  const compassOk =
    compass.samples.length >= COMPASS_SAMPLES && jitter < COMPASS_JITTER_THRESHOLD_DEG;
  const canProceed = gpsOk && compassOk;

  const advance = () => {
    if (!gps.lat || !gps.lon || gps.acc == null || compass.heading == null) return;
    draft.set({
      lat: gps.lat,
      lon: gps.lon,
      gpsAccM: gps.acc,
      bearingDeg: compass.heading,
      bearingAccDeg: Math.max(jitter, 2),
    });
    router.push("/(app)/report/capture");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.xl }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" muted>step 01 / 02</Text>
        <Text variant="h2">Calibrate sensors</Text>
        <Text variant="subtext" muted>
          step outside, away from buildings and metal, then trace a figure-8 with your phone
        </Text>
      </View>

      <SensorCard
        title="GPS precision"
        status={
          gps.status === "denied"
            ? "denied"
            : gps.status !== "active"
              ? "loading"
              : gpsOk
                ? "ok"
                : "wait"
        }
        readings={
          gps.status === "denied"
            ? [{ label: "permission", value: "denied" }]
            : [
                { label: "accuracy", value: gps.acc != null ? `± ${gps.acc.toFixed(1)} m` : "—" },
                { label: "target", value: `≤ ${GPS_ACC_THRESHOLD_M} m` },
                {
                  label: "position",
                  value: gps.lat != null ? `${gps.lat.toFixed(5)}, ${gps.lon!.toFixed(5)}` : "—",
                },
              ]
        }
      />

      <SensorCard
        title="Compass calibration"
        status={
          compass.status !== "active"
            ? "loading"
            : compassOk
              ? "ok"
              : compass.samples.length < COMPASS_SAMPLES
                ? "loading"
                : "wait"
        }
        readings={[
          {
            label: "heading",
            value: compass.heading != null ? `${compass.heading.toFixed(0)}°` : "—",
          },
          { label: "jitter", value: `${jitter.toFixed(1)}°` },
          { label: "target", value: `< ${COMPASS_JITTER_THRESHOLD_DEG}°` },
          { label: "samples", value: `${compass.samples.length} / ${COMPASS_SAMPLES}` },
        ]}
      />

      <Button label="Continue to capture" fullWidth disabled={!canProceed} onPress={advance} />
    </ScrollView>
  );
}

function SensorCard({
  title,
  status,
  readings,
}: {
  title: string;
  status: "loading" | "ok" | "wait" | "denied";
  readings: { label: string; value: string }[];
}) {
  const t = useTheme();
  const color =
    status === "ok"
      ? t.colors.success
      : status === "denied"
        ? t.colors.danger
        : status === "wait"
          ? t.colors.warn
          : t.colors.inkMuted;
  const label =
    status === "ok"
      ? "passed"
      : status === "denied"
        ? "permission denied"
        : status === "wait"
          ? "out of range"
          : "measuring";

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: t.space.lg,
        gap: t.space.md,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text variant="h3">{title}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.sm }}>
          {status === "loading" && <ActivityIndicator size="small" color={color} />}
          <Text variant="label" color={color}>
            {label}
          </Text>
        </View>
      </View>
      <View style={{ gap: t.space.xs }}>
        {readings.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="subtext" muted>
              {r.label}
            </Text>
            <Text variant="mono">{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function circularStdDev(samplesDeg: number[]): number {
  if (samplesDeg.length === 0) return Infinity;
  let sx = 0;
  let sy = 0;
  for (const d of samplesDeg) {
    const r = (d * Math.PI) / 180;
    sx += Math.cos(r);
    sy += Math.sin(r);
  }
  const n = samplesDeg.length;
  const r = Math.sqrt((sx / n) ** 2 + (sy / n) ** 2);
  if (r >= 1) return 0;
  return (Math.sqrt(-2 * Math.log(r)) * 180) / Math.PI;
}
