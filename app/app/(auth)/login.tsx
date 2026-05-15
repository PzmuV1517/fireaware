import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackendUrlEditor } from "@/components/BackendUrlEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function LoginScreen() {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


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

          <BackendUrlEditor />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
