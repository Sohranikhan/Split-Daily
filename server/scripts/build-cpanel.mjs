/**
 * Builds the API for cPanel "Setup Node.js App" (Passenger / LiteSpeed):
 *
 *   npm run build:cpanel   →  server/deploy-cpanel/   and   server/split-daily-api-cpanel.zip
 *
 * Output keeps the same MVC folders as server/src — each .ts file becomes one readable .js file
 * (nothing is bundled). Dependencies are installed on the host with cPanel's "Run NPM Install".
 *
 *   deploy-cpanel/
 *     app.cjs         ← "Application startup file" in cPanel
 *     package.json    ← production dependencies only
 *     .env.example
 *     drizzle/        ← database migrations
 *     src/            ← config/ controllers/ database/ middleware/ models/ routes/ services/ utils/ views/
 *     shared/         ← code shared with the mobile app (validation, split maths)
 */
import { transform } from "esbuild";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharedDir = path.resolve(serverDir, "..", "shared");
const out = path.join(serverDir, "deploy-cpanel");

// Source folder → output folder. Imports between them are re-pointed to the new layout.
const roots = [
  { from: path.join(serverDir, "src"), to: path.join(out, "src") },
  { from: sharedDir, to: path.join(out, "shared"), skip: (file) => file.endsWith("types.ts") /* type-only, app-side */ },
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full);
    return /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !name.endsWith(".test.ts") ? [full] : [];
  });
}

/** Where a source .ts file ends up as .js. */
function outputPathFor(sourceFile) {
  const root = roots.find((r) => sourceFile.startsWith(r.from + path.sep));
  if (!root) return null;
  return path.join(root.to, path.relative(root.from, sourceFile)).replace(/\.tsx?$/, ".js");
}

/** Resolves "./x", "../models" etc. the way TypeScript does (x.ts, x/index.ts). */
function resolveSource(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Node's ES modules need explicit file names: "./app" → "./app.js", "./routes" → "./routes/index.js". */
function rewriteImports(code, sourceFile, outputFile) {
  return code.replace(/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g, (match, lead, quote, specifier) => {
    const target = resolveSource(sourceFile, specifier);
    if (!target) throw new Error(`Cannot resolve "${specifier}" imported from ${path.relative(serverDir, sourceFile)}`);
    const targetOut = outputPathFor(target);
    if (!targetOut) throw new Error(`"${specifier}" in ${path.relative(serverDir, sourceFile)} points outside the deployable code`);
    let relative = path.relative(path.dirname(outputFile), targetOut).split(path.sep).join("/");
    if (!relative.startsWith(".")) relative = `./${relative}`;
    return `${lead}${quote}${relative}${quote}`;
  });
}

rmSync(out, { recursive: true, force: true });
let count = 0;
for (const root of roots) {
  for (const file of walk(root.from)) {
    if (root.skip?.(file)) continue;
    const outputFile = outputPathFor(file);
    const { code } = await transform(readFileSync(file, "utf8"), {
      loader: file.endsWith(".tsx") ? "tsx" : "ts",
      format: "esm",
      target: "node20",
      sourcefile: path.relative(serverDir, file),
    });
    mkdirSync(path.dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, rewriteImports(code, file, outputFile));
    count += 1;
  }
}

cpSync(path.join(serverDir, "drizzle"), path.join(out, "drizzle"), { recursive: true });

// Passenger/LiteSpeed load the startup file with require(), so it must be CommonJS (.cjs).
// It simply starts the real (ES module) server.
writeFileSync(
  path.join(out, "app.cjs"),
  `// cPanel "Application startup file". Starts the Split Daily API (src/index.js).
import("./src/index.js").catch((error) => {
  console.error("[api] failed to load:", error);
  process.exit(1);
});
`,
);

// Production dependencies with the exact versions tested locally.
const serverPkg = JSON.parse(readFileSync(path.join(serverDir, "package.json"), "utf8"));
const dependencies = {};
for (const name of Object.keys(serverPkg.dependencies ?? {})) {
  const spec = serverPkg.dependencies[name];
  if (spec.startsWith("file:")) continue;
  const installed = path.join(serverDir, "node_modules", name, "package.json");
  dependencies[name] = existsSync(installed) ? JSON.parse(readFileSync(installed, "utf8")).version : spec;
}
writeFileSync(
  path.join(out, "package.json"),
  JSON.stringify(
    {
      name: "split-daily-api",
      version: serverPkg.version ?? "1.0.0",
      private: true,
      type: "module",
      main: "app.cjs",
      engines: { node: ">=20.12" },
      scripts: { start: "node app.cjs" },
      dependencies,
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  path.join(out, ".env.example"),
  `# Enter these in cPanel → Setup Node.js App → Environment variables
# (or copy this file to ".env" in the same folder).
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=verify-full
# 32+ random characters: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=
# Public https address of this API (no trailing slash)
API_PUBLIC_URL=https://api.yourdomain.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_SCHEMES=ledgerly
ADMIN_EMAILS=
TRUST_PROXY=true
RUN_MIGRATIONS=true
# Web app address(es) allowed to call the API, comma-separated (only for the web version)
WEB_APP_ORIGINS=
`,
);

const zip = path.join(serverDir, "split-daily-api-cpanel.zip");
rmSync(zip, { force: true });
let zipped = false;
try {
  execSync(`cd "${out}" && zip -qr "${zip}" app.cjs package.json .env.example drizzle src shared`);
  zipped = true;
} catch {
  // zip not installed — the folder is still usable
}
console.log(`✔ Compiled ${count} files into ${path.relative(process.cwd(), out)}/${zipped ? ` and ${path.relative(process.cwd(), zip)}` : ""}`);
