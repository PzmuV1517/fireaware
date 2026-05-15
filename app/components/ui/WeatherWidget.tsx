import * as Location from "expo-location";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { api, type Weather } from "@/lib/api";
import { useTheme } from "@/theme";

import { Text } from "./Text";

type Status = "idle" | "loading" | "ready" | "error";

export function WeatherWidget() {
  const t = useTheme();
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<Weather | null>(null);

  const fetch = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") throw new Error("denied");
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const weather = await api.weather.get(pos.coords.latitude, pos.coords.longitude);
      setData(weather);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  const onPress = () => {
    if (status === "loading") return;
    fetch();
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: t.colors.surface,
        borderColor: t.colors.border,
        borderWidth: 1,
        borderRadius: t.radius.lg,
        paddingVertical: t.space.sm,
        paddingHorizontal: t.space.md,
        minWidth: 80,
        opacity: pressed ? 0.85 : 1,
        gap: 2,
      })}
    >
      {status === "idle" && (
        <Text variant="label" muted>
          weather
        </Text>
      )}

      {status === "loading" && (
        <View style={{ alignItems: "center", paddingVertical: 2 }}>
          <ActivityIndicator size="small" color={t.colors.inkMuted} />
        </View>
      )}

      {status === "ready" && data && (
        <>
          <Text variant="mono" style={{ fontSize: 14 }}>
            {data.temperature.toFixed(0)}°C
          </Text>
          <Text variant="mono" muted>
            {data.wind_direction} · {data.wind_speed.toFixed(0)} km/h
          </Text>
        </>
      )}

      {status === "error" && (
        <Text variant="label" muted>
          unavailable
        </Text>
      )}
    </Pressable>
  );
}
