/**
 * All server configuration comes from environment variables (see server/.env.example).
 * Nothing here is tied to a hosting vendor: any Node 20+ host works.
 */
function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripSlash(value: string) {
  return value.replace(/\/+$/, "");
}

const isProduction = process.env.NODE_ENV === "production";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

export const ENV = {
  isProduction,
  port,
  databaseUrl: process.env.DATABASE_URL ?? "",
  /** Secret used to sign session tokens. Must be long and random in production. */
  jwtSecret: process.env.JWT_SECRET ?? (isProduction ? "" : "dev-only-insecure-secret-change-me-please"),
  /** Public URL of this API, e.g. https://api.example.com. Used to build the Google redirect URI. */
  publicUrl: stripSlash(process.env.API_PUBLIC_URL ?? `http://localhost:${port}`),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  /** Optional native client IDs (Google Cloud → Credentials → iOS / Android). Tokens issued to these are accepted too. */
  googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? "",
  /** Web origins allowed to call the API and to receive the login redirect, e.g. https://app.example.com */
  webOrigins: list(process.env.WEB_APP_ORIGINS ?? "http://localhost:8081").map(stripSlash),
  /** Native deep-link schemes allowed to receive the login redirect (without "://"). */
  appSchemes: list(process.env.APP_SCHEMES ?? "ledgerly"),
  /** Allow Expo Go (exp:// / exps://) redirects. Defaults to on in development only. */
  allowExpoGo: (process.env.ALLOW_EXPO_GO_REDIRECTS ?? (isProduction ? "false" : "true")) === "true",
  sessionTtlDays: Number.parseInt(process.env.SESSION_TTL_DAYS ?? "30", 10),
  adminEmails: list(process.env.ADMIN_EMAILS).map((email) => email.toLowerCase()),
  /** Contact address shown on the privacy policy and account-deletion pages (defaults to the first ADMIN_EMAILS entry). */
  supportEmail: process.env.SUPPORT_EMAIL ?? list(process.env.ADMIN_EMAILS)[0] ?? "",
  /** Optional: absolute or relative path to an `expo export --platform web` build to serve from this server. */
  webDistDir: process.env.WEB_DIST_DIR ?? "",
  /** Set to "true" behind a reverse proxy / load balancer (Render, Railway, Nginx, Heroku...). */
  trustProxy: process.env.TRUST_PROXY === "true",
  runMigrationsOnStart: process.env.RUN_MIGRATIONS === "true",
};

export function googleRedirectUri() {
  return `${ENV.publicUrl}/api/auth/google/callback`;
}

export function assertProductionConfig() {
  const missing: string[] = [];
  if (!ENV.databaseUrl) missing.push("DATABASE_URL");
  if (!ENV.googleClientId) missing.push("GOOGLE_CLIENT_ID");
  if (!ENV.googleClientSecret) missing.push("GOOGLE_CLIENT_SECRET");
  if (ENV.isProduction) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push("JWT_SECRET (32+ chars)");
    if (!process.env.API_PUBLIC_URL) missing.push("API_PUBLIC_URL");
  }
  return missing;
}
