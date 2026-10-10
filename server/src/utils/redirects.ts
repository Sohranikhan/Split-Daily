import { ENV } from "../config/env";

export function allowedWebOrigins(): string[] {
  const origins = new Set(ENV.webOrigins);
  try {
    origins.add(new URL(ENV.publicUrl).origin);
  } catch {
    // ignore malformed API_PUBLIC_URL; env validation reports it
  }
  return [...origins];
}

/**
 * Only send login tickets back to places we trust: the configured web app origins,
 * the app's own deep-link scheme, and (in development) Expo Go.
 */
export function isAllowedReturnTo(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  if (scheme === "http" || scheme === "https") return allowedWebOrigins().includes(url.origin);
  if (ENV.appSchemes.map((s) => s.toLowerCase()).includes(scheme)) return true;
  if ((scheme === "exp" || scheme === "exps") && ENV.allowExpoGo) return true;
  return false;
}

export function withParams(returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
