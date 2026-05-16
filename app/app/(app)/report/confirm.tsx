import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  View,
} from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { api, type AnalysisDetection, type AnalysisResult } from "@/lib/api";
import { useReportDraft } from "@/lib/reportDraft";
import { useTheme } from "@/theme";

type AnalyzeState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: AnalysisResult }
  | { kind: "error"; message: string };

export default function Confirm() {
  const t = useTheme();
  const router = useRouter();
  const draft = useReportDraft();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeState>({ kind: "idle" });
  const [imgLayout, setImgLayout] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const ready =
    draft.lat != null &&
    draft.lon != null &&
    draft.bearingDeg != null &&
    draft.photoUri != null &&
    draft.takenAt != null;

  const buildPhotoForm = (): FormData => {
    const form = new FormData();
    const photoFile = {
      uri: draft.photoUri!,
      name: "report.jpg",
      type: draft.photoMime ?? "image/jpeg",
    } as unknown as Blob;
    form.append("photo", photoFile);
    return form;
  };

  const runAnalysis = async () => {
    setAnalysis({ kind: "running" });
    setError(null);
    try {
      const result = await api.reports.analyze(buildPhotoForm());
      setAnalysis({ kind: "done", result });
    } catch (e) {
      setAnalysis({
        kind: "error",
        message: e instanceof Error ? e.message : "Analysis failed",
      });
    }
  };

  const sendReport = async () => {
    if (!ready) return;
    if (analysis.kind !== "done" || !analysis.result.valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = buildPhotoForm();
      form.append(
        "payload",
        JSON.stringify({
          lat: draft.lat,
          lon: draft.lon,
          bearing_deg: draft.bearingDeg,
          bearing_acc_deg: draft.bearingAccDeg ?? 5,
          gps_acc_m: draft.gpsAccM ?? 20,
          taken_at: draft.takenAt,
          device_meta: {
            platform: Platform.OS,
            version: Platform.Version,
            vision: {
              fire: analysis.result.max_fire_confidence,
              smoke: analysis.result.max_smoke_confidence,
            },
          },
        }),
      );
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

  // Submit button decides what to do based on the current analysis state.
  // First press: runs the YOLO check. Once valid: sends the report.
  const onPrimary = async () => {
    if (analysis.kind === "running" || submitting) return;
    if (analysis.kind === "done" && analysis.result.valid) {
      await sendReport();
    } else {
      await runAnalysis();
    }
  };

  const primaryLabel = (() => {
    if (submitting) return "Sending…";
    if (analysis.kind === "running") return "Verifying photo…";
    if (analysis.kind === "done" && analysis.result.valid)
      return `Send sighting · fire ${pct(analysis.result.max_fire_confidence)}`;
    if (analysis.kind === "done") return "Photo rejected — retry?";
    if (analysis.kind === "error") return "Verification failed — retry";
    return "Verify photo";
  })();

  const primaryDisabled =
    !ready ||
    submitting ||
    analysis.kind === "running" ||
    (analysis.kind === "done" && !analysis.result.valid);

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="label" muted>step 02 / 02</Text>
        <Text variant="h2">Review your sighting</Text>
        <Text variant="subtext" muted>
          tap verify so our fire model can confirm the photo before we triangulate
        </Text>
      </View>

      {draft.photoUri ? (
        <View
          onLayout={(e: LayoutChangeEvent) =>
            setImgLayout({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
          style={{
            width: "100%",
            aspectRatio: 4 / 3,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.surfaceAlt,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Image
            source={{ uri: draft.photoUri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
          />
          {analysis.kind === "done" && imgLayout.w > 0
            ? analysis.result.detections
                .filter((d) => d.bbox && d.confidence >= 0.25)
                .map((d, i) => (
                  <BoundingBox
                    key={i}
                    detection={d}
                    containerW={imgLayout.w}
                    containerH={imgLayout.h}
                  />
                ))
            : null}
        </View>
      ) : null}

      <AnalysisCard state={analysis} />

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
        <Button
          label={primaryLabel}
          fullWidth
          loading={submitting || analysis.kind === "running"}
          disabled={primaryDisabled}
          onPress={onPrimary}
        />
        <Button
          label="Retake photo"
          variant="secondary"
          fullWidth
          disabled={submitting || analysis.kind === "running"}
          onPress={() => router.replace("/(app)/report/capture")}
        />
      </View>
    </ScrollView>
  );
}

function AnalysisCard({ state }: { state: AnalyzeState }) {
  const t = useTheme();

  const borderColor =
    state.kind === "done"
      ? state.result.valid
        ? t.colors.success
        : t.colors.danger
      : state.kind === "error"
        ? t.colors.danger
        : t.colors.border;

  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor,
        padding: t.space.lg,
        gap: t.space.sm,
      }}
    >
      <Text variant="label" muted>vision check</Text>

      {state.kind === "idle" ? (
        <Text variant="subtext" muted>
          tap “Verify photo” below to run the fire-detection model
        </Text>
      ) : state.kind === "running" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.sm }}>
          <ActivityIndicator color={t.colors.inkMuted} />
          <Text variant="subtext" muted>analyzing your photo…</Text>
        </View>
      ) : state.kind === "error" ? (
        <Text variant="subtext" color={t.colors.danger}>{state.message}</Text>
      ) : (
        <>
          <Text
            variant="h4"
            color={state.result.valid ? t.colors.success : t.colors.danger}
          >
            {state.result.valid ? "Fire confirmed" : "Couldn’t verify fire"}
          </Text>
          <Text variant="subtext" muted>{state.result.message}</Text>
          <View style={{ flexDirection: "row", gap: t.space.lg, marginTop: t.space.xs }}>
            <Row label="fire" value={pct(state.result.max_fire_confidence)} />
            <Row label="smoke" value={pct(state.result.max_smoke_confidence)} />
          </View>
        </>
      )}
    </View>
  );
}

function BoundingBox({
  detection,
  containerW,
  containerH,
}: {
  detection: AnalysisDetection;
  containerW: number;
  containerH: number;
}) {
  const t = useTheme();
  if (!detection.bbox) return null;
  const [x1, y1, x2, y2] = detection.bbox;
  const left = x1 * containerW;
  const top = y1 * containerH;
  const width = Math.max(2, (x2 - x1) * containerW);
  const height = Math.max(2, (y2 - y1) * containerH);
  const isSmoke = detection.class_name.toLowerCase() === "smoke";
  const color = isSmoke ? "#E8A317" : t.colors.accent;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 4,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: -22,
          left: -2,
          backgroundColor: color,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
        }}
      >
        <Text variant="label" color="#000">
          {detection.class_name} {Math.round(detection.confidence * 100)}%
        </Text>
      </View>
    </View>
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

function pct(v: number): string {
  return `${(v * 100).toFixed(0)}%`;
}

function fmtCoord(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return "—";
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}
