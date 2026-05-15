import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

export const ROMANIA_CENTER = { lat: 45.9432, lon: 24.9668 };
export const ROMANIA_ZOOM = 6;

export interface MapCenter {
  center: { lat: number; lon: number };
  zoom: number;
}

/**
 * Web → Romania immediately.
 * Native → user's current location if location permission is already granted,
 * otherwise Romania. Never prompts for permission — that's owned by the report
 * flow.
 */
export function useInitialMapCenter(): MapCenter | null {
  const [resolved, setResolved] = useState<MapCenter | null>(
    Platform.OS === "web" ? { center: ROMANIA_CENTER, zoom: ROMANIA_ZOOM } : null,
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    let alive = true;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status === "granted") {
          const last = await Location.getLastKnownPositionAsync();
          if (last && alive) {
            setResolved({
              center: { lat: last.coords.latitude, lon: last.coords.longitude },
              zoom: 11,
            });
            return;
          }
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (alive) {
            setResolved({
              center: { lat: pos.coords.latitude, lon: pos.coords.longitude },
              zoom: 11,
            });
            return;
          }
        }
      } catch {
        // fall through to Romania
      }
      if (alive) setResolved({ center: ROMANIA_CENTER, zoom: ROMANIA_ZOOM });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return resolved;
}
