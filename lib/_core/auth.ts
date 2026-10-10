import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/config";

/** The user object returned by the API (`/api/auth/me`, `/api/auth/exchange`). */
export type User = {
  id: number;
  publicId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  /** ISO currency code picked in Settings (older servers may not send it). */
  defaultCurrency?: string;
  lastSignedIn: string;
};

// Web keeps the token in localStorage so the app works whether or not it is hosted on the
// same domain as the API. Native uses the OS keychain / keystore via SecureStore.
async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function removeItem(key: string) {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // nothing to remove
  }
}

export const getSessionToken = () => getItem(SESSION_TOKEN_KEY);
export const setSessionToken = (token: string) => setItem(SESSION_TOKEN_KEY, token);
export const removeSessionToken = () => removeItem(SESSION_TOKEN_KEY);

export async function getCachedUser(): Promise<User | null> {
  const raw = await getItem(USER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}
export const setCachedUser = (user: User) => setItem(USER_INFO_KEY, JSON.stringify(user));
export const clearCachedUser = () => removeItem(USER_INFO_KEY);
