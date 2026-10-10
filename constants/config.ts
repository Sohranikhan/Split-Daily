import Constants from "expo-constants";
import { Platform } from "react-native";

/** Deep-link scheme registered in app.config.ts (splitdaily://...). */
export const APP_SCHEME = "splitdaily";

export const SESSION_TOKEN_KEY = "ledgerly_session_token";
export const USER_INFO_KEY = "ledgerly_user";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

function strip(url: string) {
  return url.replace(/\/+$/, "");
}

/**
 * Where the API server lives.
 * 1. EXPO_PUBLIC_API_BASE_URL (recommended for builds), e.g. https://api.example.com
 * 2. Web dev: same host as the page on port 3000 (Metro is on 8081).
 * 3. Web prod: same origin (the API server can also serve the web build).
 * 4. Native dev (Expo Go / dev client): the Metro host's LAN IP on port 3000.
 */
export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL || extra.apiBaseUrl;
  if (configured) return strip(configured);

  if (Platform.OS === "web") {
    if (typeof window === "undefined" || !window.location) return "";
    const { protocol, hostname, port } = window.location;
    if (port === "8081") return `${protocol}//${hostname}:3000`;
    return "";
  }

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  if (hostUri) return `http://${hostUri.split(":")[0]}:3000`;
  return "";
}

export function apiUrl(path: string) {
  const base = getApiBaseUrl();
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!base && Platform.OS !== "web") {
    throw new Error("API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in .env and restart Expo.");
  }
  return `${base}${clean}`;
}
