import { apiUrl } from "@/constants/config";
import * as Auth from "./auth";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await Auth.getSessionToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(apiUrl(endpoint), { ...options, headers });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || data?.message || `Request failed (${response.status})`);
  }
  return data as T;
}

/** Swap the one-time login ticket from the Google redirect for a session token. */
export function exchangeLoginTicket(ticket: string) {
  return apiCall<{ token: string; expiresAt: string; user: Auth.User }>("/api/auth/exchange", {
    method: "POST",
    body: JSON.stringify({ ticket }),
  });
}

/** Returns the signed-in user, null when signed out; throws on network/server errors. */
export async function getMe(): Promise<Auth.User | null> {
  try {
    const result = await apiCall<{ user: Auth.User | null }>("/api/auth/me");
    return result.user ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Native in-app sign-in: send the Google ID token from the device, get a session token back. */
export function signInWithGoogleIdToken(idToken: string) {
  return apiCall<{ token: string; expiresAt: string; user: Auth.User }>("/api/auth/google/native", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export async function logout(): Promise<void> {
  await apiCall("/api/auth/logout", { method: "POST" });
}

export function googleStartUrl(returnTo: string) {
  return apiUrl(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
}
