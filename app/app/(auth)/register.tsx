import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { useTheme } from "@/theme";

export default function RegisterScreen() {
  const t = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const tokens = await api.auth.register({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName.trim(),
      });
      await authStore
        .getState()
        .setTokens(tokens.access_token, tokens.refresh_token, tokens.role as "civilian" | "fireman");
      router.replace("/(app)/map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, padding: t.space.xl, justifyContent: "center", gap: t.space.xl }}
      >
        <View style={{ gap: t.space.xs }}>
          <Text variant="h1">Create account</Text>
          <Text variant="subtext" muted>
            join the network of fire-spotters
          </Text>
        </View>

        <View style={{ gap: t.space.md }}>
          <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
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
            hint="at least 8 characters"
          />
          {error && (
            <Text variant="subtext" color={t.colors.danger}>
              {error}
            </Text>
          )}
        </View>

        <View style={{ gap: t.space.md }}>
          <Button label="Create account" onPress={submit} loading={loading} fullWidth />
          <Link href="/(auth)/login" asChild>
            <Pressable style={{ alignSelf: "center" }}>
              <Text variant="subtext" muted>
                already a member? <Text variant="subtext" color={t.colors.accent}>sign in</Text>
              </Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
