import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { BackendUrlEditor } from "@/components/BackendUrlEditor";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { authStore } from "@/lib/auth";
import { useTheme } from "@/theme";

type Role = "civilian" | "fireman";
type Mode = "closed" | "login" | "register";

// Same easing curve and duration as the mobile (Reanimated CurvedTransition)
// version. On web we drive the morph with plain CSS transitions because
// react-native-web passes these style props straight through to the DOM — the
// browser compositor handles the interpolation, which is far smoother than
// Reanimated 4's web shim for layout animations.
const DURATION = "320ms";
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const FAST = "180ms";

const morph = {
  transitionProperty: "width, box-shadow, padding, transform",
  transitionDuration: DURATION,
  transitionTimingFunction: EASING,
} as object;

const fade = {
  transitionProperty: "opacity, color",
  transitionDuration: FAST,
  transitionTimingFunction: EASING,
} as object;

/**
 * Web variant of the LoginIsland. Mobile uses Reanimated layout animations
 * (see LoginIsland.tsx); this version uses CSS transitions for the same
 * visual result. Mobile is untouched.
 */
export function LoginIsland() {
  const t = useTheme();

  const [mode, setMode] = useState<Mode>("closed");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = mode !== "closed";
  const isRegister = mode === "register";

  const close = () => {
    setMode("closed");
    setError(null);
    setTimeout(() => {
      setEmail("");
      setPassword("");
      setDisplayName("");
    }, 320);
  };

  const switchMode = (next: "login" | "register") => {
    if (mode === next) return;
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    if (loading) return;
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    if (isRegister && !displayName.trim()) {
      setError("Display name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tokens = isRegister
        ? await api.auth.register({
            email: email.trim().toLowerCase(),
            password,
            display_name: displayName.trim(),
          })
        : await api.auth.login({
            email: email.trim().toLowerCase(),
            password,
          });
      await authStore
        .getState()
        .setTokens(tokens.access_token, tokens.refresh_token, tokens.role as Role);
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radius.lg,
          padding: t.space.lg,
          alignSelf: "flex-start",
          width: open ? 340 : 280,
          maxWidth: 380,
          shadowColor: "#000",
          shadowOpacity: open ? 0.18 : 0.06,
          shadowOffset: { width: 0, height: open ? 8 : 2 },
          shadowRadius: open ? 18 : 6,
          elevation: open ? 8 : 2,
        },
        morph,
      ]}
    >
      {!open ? (
        <Pressable onPress={() => switchMode("login")} accessibilityLabel="Sign in">
          <Text variant="h2">FireAware</Text>
          <Text variant="subtext" muted>
            community-sighted fires, triangulated and mapped
          </Text>
          <View
            style={{ marginTop: t.space.sm, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Text variant="label" color={t.colors.accent}>
              Sign in
            </Text>
            <Ionicons name="arrow-forward" size={14} color={t.colors.accent} />
          </View>
        </Pressable>
      ) : (
        <View style={{ gap: t.space.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", gap: t.space.md }}>
              <Pressable onPress={() => switchMode("login")} hitSlop={4}>
                <Text
                  variant="h3"
                  color={mode === "login" ? t.colors.ink : t.colors.inkMuted}
                  style={fade}
                >
                  Sign in
                </Text>
              </Pressable>
              <Pressable onPress={() => switchMode("register")} hitSlop={4}>
                <Text
                  variant="h3"
                  color={mode === "register" ? t.colors.ink : t.colors.inkMuted}
                  style={fade}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={close}
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
            >
              <Ionicons name="close" size={20} color={t.colors.inkMuted} />
            </Pressable>
          </View>

          {isRegister && (
            <Input label="Display name" value={displayName} onChangeText={setDisplayName} />
          )}

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isRegister ? "new-password" : "password"}
            returnKeyType="go"
            onSubmitEditing={submit}
            hint={isRegister ? "at least 8 characters" : undefined}
          />

          {error && (
            <Text variant="subtext" color={t.colors.danger}>
              {error}
            </Text>
          )}

          <Button
            label={isRegister ? "Create account" : "Sign in"}
            onPress={submit}
            loading={loading}
            fullWidth
          />

          <BackendUrlEditor />
        </View>
      )}
    </View>
  );
}
