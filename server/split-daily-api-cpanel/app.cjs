// cPanel "Application startup file". Starts the Split Daily API (src/index.js).
import("./src/index.js").catch((error) => {
  console.error("[api] failed to load:", error);
  process.exit(1);
});
