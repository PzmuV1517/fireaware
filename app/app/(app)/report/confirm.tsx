import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { useReportDraft } from "@/lib/reportDraft";
import { useTheme } from "@/theme";

export default function Confirm() {
  const t = useTheme();
  const router = useRouter();
  const draft = useReportDraft();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    draft.lat != null &&
    draft.lon != null &&
    draft.bearingDeg != null &&
    draft.photoUri != null &&
    draft.takenAt != null;

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          lat: draft.lat,
          lon: draft.lon,
          bearing_deg: draft.bearingDeg,
          bearing_acc_deg: draft.bearingAccDeg ?? 5,
          gps_acc_m: draft.gpsAccM ?? 20,
          taken_at: draft.takenAt,
          device_meta: { platform: Platform.OS, version: Platform.Version },
        }),
      );
      const photoFile = {
        uri: draft.photoUri!,
        name: "report.jpg",
        type: draft.photoMime ?? "image/jpeg",
      } as unknown as Blob;
      form.append("photo", photoFile);

      const res = await api.reports.submit(form);
      await qc.invalidateQueries({ queryKey: ["fires"] });
      await qc.invalidateQueries({ queryKey: ["reports", "mine"] });
      draft.reset();
      if (res.matched && res.fire_id) {
        router.replace(`/fire/${res.fire_id}`);
      } else {
        router.replace("/(app)/map");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" muted>step 02 / 02</Text>
        <Text variant="h2">Review your sighting</Text>
        <Text variant="subtext" muted>
          confirm the details below before we triangulate
        </Text>
      </View>

      {draft.photoUri ? (
        <Image
          source={{ uri: draft.photoUri }}
          style={{
            width: "100%",
            aspectRatio: 4 / 3,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.surfaceAlt,
          }}
          contentFit="cover"
        />
      ) : null}

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
        <Row label="position" value={fmtCoord(draft.lat, draft.lon)} />
        <Row label="bearing" value={draft.bearingDeg != null ? `${draft.bearingDeg.toFixed(0)}°` : "—"} />
        <Row
          label="bearing precision"
          value={draft.bearingAccDeg != null ? `± ${draft.bearingAccDeg.toFixed(1)}°` : "—"}
        />
        <Row
          label="gps precision"
          value={draft.gpsAccM != null ? `± ${draft.gpsAccM.toFixed(1)} m` : "—"}
        />
        <Row label="taken at" value={draft.takenAt ? new Date(draft.takenAt).toLocaleString() : "—"} />
      </View>

      {error && (
        <Text variant="subtext" color={t.colors.danger}>
          {error}
        </Text>
      )}

      <View style={{ gap: t.space.sm }}>
        <Button label="Submit sighting" fullWidth loading={submitting} onPress={submit} />
        <Button
          label="Retake photo"
          variant="secondary"
          fullWidth
          disabled={submitting}
          onPress={() => router.replace("/(app)/report/capture")}
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text variant="subtext" muted>
        {label}
      </Text>
      <Text variant="mono">{value}</Text>
    </View>
  );
}

function fmtCoord(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return "—";
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}
