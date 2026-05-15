import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

const ACCESS_KEY = "fireaware.access";
const REFRESH_KEY = "fireaware.refresh";

const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTokens: (access: string, refresh: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const authStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  hydrated: false,
  hydrate: async () => {
    const [a, r] = await Promise.all([storage.get(ACCESS_KEY), storage.get(REFRESH_KEY)]);
    set({ accessToken: a, refreshToken: r, hydrated: true });
  },
  setTokens: async (access, refresh) => {
    await Promise.all([storage.set(ACCESS_KEY, access), storage.set(REFRESH_KEY, refresh)]);
    set({ accessToken: access, refreshToken: refresh });
  },
  clear: async () => {
    await Promise.all([storage.del(ACCESS_KEY), storage.del(REFRESH_KEY)]);
    set({ accessToken: null, refreshToken: null });
  },
}));

export function useAuth() {
  return authStore();
}

export function useIsSignedIn() {
  return authStore((s) => Boolean(s.accessToken));
}
