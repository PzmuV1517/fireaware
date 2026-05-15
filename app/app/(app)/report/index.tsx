import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useReportDraft } from "@/lib/reportDraft";
import { useTheme } from "@/theme";

const STEPS = [
  {
    n: "01",
    h: "GPS precision check",
    s: "we wait until your position is accurate to within 20 metres",
  },
  {
    n: "02",
    h: "Compass calibration",
    s: "we measure how steady your phone's heading is — calibrate by tracing a figure-8",
  },
  {
    n: "03",
    h: "Capture",
    s: "frame the fire on the crosshair, we record bearing & position at shutter",
  },
  {
    n: "04",
    h: "Confirm & submit",
    s: "review and send. we'll triangulate against nearby reports",
  },
];

export default function ReportIntro() {
  const t = useTheme();
  const router = useRouter();
  const reset = useReportDraft((s) => s.reset);

  return (
    <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.xl }}>
      <View style={{ gap: t.space.xs }}>
        <Text variant="h1">Submit a sighting</Text>
        <Text variant="subtext" muted>
          a single report becomes a confirmed fire when others sight it from a different angle
        </Text>
      </View>

      <View style={{ gap: t.space.lg }}>
        {STEPS.map((s) => (
          <View key={s.n} style={{ flexDirection: "row", gap: t.space.md }}>
            <Text variant="mono" muted style={{ width: 32 }}>
              {s.n}
            </Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h4">{s.h}</Text>
              <Text variant="subtext" muted>
                {s.s}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Button
        label="Begin calibration"
        fullWidth
        onPress={() => {
          reset();
          router.push("/(app)/report/calibrate");
        }}
      />
    </ScrollView>
  );
}
