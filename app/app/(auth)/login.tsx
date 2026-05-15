import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { configStore, getDefaultApiBase } from "@/lib/config";
import { useTheme } from "@/theme";

export default function LoginScreen() {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { apiBase, override } = configStore();
  const [showApi, setShowApi] = useState(false);
  const [apiInput, setApiInput] = useState("");

  useEffect(() => {
    setApiInput(override ?? apiBase);
  }, [override, apiBase]);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = await api.auth.login({ email: email.trim().toLowerCase(), password });
      await authStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      router.replace("/(app)/map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const saveApi = async () => {
    await configStore.getState().setOverride(apiInput);
    setShowApi(false);
  };
  const resetApi = async () => {
    await configStore.getState().setOverride(null);
    setApiInput(getDefaultApiBase());
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: t.space.xl,
            justifyContent: "center",
            gap: t.space.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: t.space.xs }}>
            <Text variant="h1">Welcome back</Text>
            <Text variant="subtext" muted>
              sign in to submit a sighting
            </Text>
          </View>

          <View style={{ gap: t.space.md }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />
            {error && (
              <Text variant="subtext" color={t.colors.danger}>
                {error}
              </Text>
            )}
          </View>

          <View style={{ gap: t.space.md }}>
            <Button label="Sign in" onPress={submit} loading={loading} fullWidth />
            <Link href="/(auth)/register" asChild>
              <Pressable style={{ alignSelf: "center" }}>
                <Text variant="subtext" muted>
                  no account yet? <Text variant="subtext" color={t.colors.accent}>create one</Text>
                </Text>
              </Pressable>
            </Link>
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: t.colors.border,
              paddingTop: t.space.md,
              gap: t.space.sm,
            }}
          >
            <Pressable onPress={() => setShowApi((s) => !s)}>
              <Text variant="label" muted>
                backend {override ? "(custom)" : "(auto)"} {showApi ? "▾" : "▸"}
              </Text>
              <Text variant="mono" muted style={{ fontSize: 11 }} numberOfLines={1}>
                {apiBase}
              </Text>
            </Pressable>

            {showApi && (
              <View style={{ gap: t.space.sm }}>
                <Input
                  label="Backend URL"
                  value={apiInput}
                  onChangeText={setApiInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="http://192.168.x.x:8000"
                  hint={`default: ${getDefaultApiBase()}`}
                />
                <View style={{ flexDirection: "row", gap: t.space.sm }}>
                  <Button label="Save" onPress={saveApi} />
                  <Button label="Reset" variant="secondary" onPress={resetApi} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
