import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { create } from "zustand";

const KEY = "fireaware.apiBase";

function defaultApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv;
  if (Platform.OS === "android") return "http://10.0.2.2:8000";
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host) return `http://${host}:8000`;
  return "http://localhost:8000";
}

interface ConfigState {
  apiBase: string;
  override: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setOverride: (url: string | null) => Promise<void>;
}

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export const configStore = create<ConfigState>((set, get) => ({
  apiBase: defaultApiBase(),
  override: null,
  hydrated: false,
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(KEY);
    set({
      override: stored,
      apiBase: stored ? normalize(stored) : defaultApiBase(),
      hydrated: true,
    });
  },
  setOverride: async (url) => {
    if (url && url.trim()) {
      const v = normalize(url);
      await AsyncStorage.setItem(KEY, v);
      set({ override: v, apiBase: v });
    } else {
      await AsyncStorage.removeItem(KEY);
      set({ override: null, apiBase: defaultApiBase() });
    }
  },
}));

export function getApiBase(): string {
  return configStore.getState().apiBase;
}

export function getDefaultApiBase(): string {
  return defaultApiBase();
}
