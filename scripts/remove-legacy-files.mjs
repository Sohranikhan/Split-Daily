#!/usr/bin/env node
/**
 * One-time cleanup: deletes the old Manus-generated files that the new structure replaced.
 * Run from the project root:  node scripts/remove-legacy-files.mjs
 * Safe to run more than once.
 */
import fs from "node:fs";
import path from "node:path";

const legacy = [
  ".manus-starter-init.json",
  "pnpm-lock.yaml",
  "drizzle.config.ts",
  "drizzle",
  "tests",
  "scripts/load-env.js",
  "constants/oauth.ts",
  "constants/const.ts",
  "lib/_core/manus-runtime.ts",
  "shared/_core",
  "server/_core",
  "server/services",
  "server/db.ts",
  "server/routers.ts",
  "server/storage.ts",
];

const root = process.cwd();
if (!fs.existsSync(path.join(root, "app.config.ts")) || !fs.existsSync(path.join(root, "server", "src"))) {
  console.error("Run this from the project root (the folder that contains app.config.ts and server/src).");
  process.exit(1);
}

for (const relative of legacy) {
  const target = path.join(root, relative);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`removed ${relative}`);
  }
}
console.log("Legacy Manus files cleaned up. You can delete scripts/remove-legacy-files.mjs now.");
