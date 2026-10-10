import { useThemeContext } from "@/lib/theme-provider";

// Web uses the same app-controlled color scheme as native (Settings → Appearance).
// (Implemented here rather than re-exported: on web "./use-color-scheme" resolves to this file.)
export function useColorScheme() {
  return useThemeContext().colorScheme;
}
