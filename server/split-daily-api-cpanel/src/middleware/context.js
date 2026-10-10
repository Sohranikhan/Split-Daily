import { authenticateRequest } from "../services/auth/session.service.js";
async function createContext(opts) {
  let auth = null;
  try {
    auth = await authenticateRequest(opts.req);
  } catch (error) {
    console.error("[auth] context authentication failed:", error instanceof Error ? error.message : error);
  }
  return { req: opts.req, res: opts.res, user: auth?.user ?? null, sessionId: auth?.sessionId ?? null };
}
export {
  createContext
};
