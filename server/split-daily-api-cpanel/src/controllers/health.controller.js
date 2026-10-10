import { getPool } from "../database/client.js";
import { ENV } from "../config/env.js";
async function health(_req, res) {
  let database = "not configured";
  if (ENV.databaseUrl) {
    try {
      await getPool().query("select 1");
      database = "ok";
    } catch (error) {
      database = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  res.status(database === "ok" ? 200 : 503).json({ ok: database === "ok", server: "ok", database, timestamp: Date.now() });
}
export {
  health
};
