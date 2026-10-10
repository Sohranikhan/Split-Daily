import { ENV } from "../config/env.js";
function allowedWebOrigins() {
  const origins = new Set(ENV.webOrigins);
  try {
    origins.add(new URL(ENV.publicUrl).origin);
  } catch {
  }
  return [...origins];
}
function isAllowedReturnTo(raw) {
  if (typeof raw !== "string" || raw.length > 2048) return false;
  let url;
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
function withParams(returnTo, params) {
  const url = new URL(returnTo);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
export {
  allowedWebOrigins,
  isAllowedReturnTo,
  withParams
};
