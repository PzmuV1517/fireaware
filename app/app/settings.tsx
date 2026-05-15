import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackendUrlEditor } from "@/components/BackendUrlEditor";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { authStore } from "@/lib/auth";
import { getApiBase } from "@/lib/config";
import { useTheme } from "@/theme";

type ConnState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; ms: number }
  | { kind: "fail"; reason: string };

export default function WebSettings() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [conn, setConn] = useState<ConnState>({ kind: "idle" });

  const reloadConnection = async () => {
    setConn({ kind: "checking" });
    const started = Date.now();
    try {
      const res = await fetch(`${getApiBase()}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ms = Date.now() - started;
      await Promise.all([
        qc.refetchQueries({ queryKey: ["fires"] }),
        qc.refetchQueries({ queryKey: ["reports", "public"] }),
        qc.refetchQueries({ queryKey: ["me"] }),
        qc.refetchQueries({ queryKey: ["reports", "mine"] }),
      ]);
      setConn({ kind: "ok", ms });
    } catch (e) {
      setConn({ kind: "fail", reason: e instanceof Error ? e.message : "unreachable" });
    }
  };

  const statusColor =
    conn.kind === "ok"
      ? t.colors.success
      : conn.kind === "fail"
        ? t.colors.danger
        : t.colors.inkMuted;
  const statusText =
    conn.kind === "idle"
      ? "not checked yet"
      : conn.kind === "checking"
        ? "checking…"
        : conn.kind === "ok"
          ? `connected · ${conn.ms} ms`
          : `unreachable · ${conn.reason}`;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SafeAreaView>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: t.colors.border,
            gap: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="arrow-back" size={18} color={t.colors.accent} />
            <Text variant="label" color={t.colors.accent}>
              Back
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text variant="h3">Settings</Text>
          <View style={{ flex: 1 }} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: t.space.lg,
          gap: t.space.xl,
          maxWidth: 600,
          alignSelf: "center",
          width: "100%",
        }}
      >
        <View style={{ gap: t.space.md }}>
          <Text variant="label" muted>
            backend
          </Text>
          <BackendUrlEditor alwaysExpanded />

          <View
            style={{
              backgroundColor: t.colors.surface,
              borderColor: t.colors.border,
              borderWidth: 1,
              borderRadius: t.radius.md,
              padding: t.space.md,
              gap: t.space.sm,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text variant="label" muted>
                connection
              </Text>
              <Text variant="mono" color={statusColor} style={{ fontSize: 12 }}>
                {statusText}
              </Text>
            </View>
            <Button
              label="Reload connection"
              variant="secondary"
              loading={conn.kind === "checking"}
              onPress={reloadConnection}
            />
          </View>
        </View>

        <View style={{ gap: t.space.md }}>
          <Text variant="label" muted>
            session
          </Text>
          <Button
            label="Sign out"
            variant="secondary"
            onPress={async () => {
              await authStore.getState().clear();
              router.replace("/");
            }}
          />
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ alignItems: "center", paddingTop: t.space.xl }}>
          <Text variant="caption" muted>
            © 2026 FERRITEWORKS S.R.L.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
