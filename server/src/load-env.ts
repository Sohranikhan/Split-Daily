// Loads server/.env when present (Node 20.12+). Real environment variables always win,
// so hosts that inject env vars (Render, Railway, Docker…) need no .env file.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file — fine in production
}
