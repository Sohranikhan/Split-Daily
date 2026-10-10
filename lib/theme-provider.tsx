import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";
import { toKebab } from "@/theme.config";

export type ThemePreference = "system" | ColorScheme;
const STORAGE_KEY = "splitdaily_theme";

type ThemeContextValue = {
  /** The scheme actually in use. */
  colorScheme: ColorScheme;
  /** What the user picked in Settings ("system" follows the phone). */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Kept for existing callers: picks light or dark explicitly. */
  setColorScheme: (scheme: ColorScheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme: ColorScheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const colorScheme: ColorScheme = preference === "system" ? systemScheme : preference;

  // Restore the saved choice once.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") setPreferenceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const applyScheme = useCallback((scheme: ColorScheme, pref: ThemePreference) => {
    nativewindColorScheme.set(scheme);
    // Let the OS chrome follow the app; "system" hands control back to the device setting.
    Appearance.setColorScheme?.(pref === "system" ? "unspecified" : scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      root.style.colorScheme = scheme;
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${toKebab(token)}`, value);
      });
    }
  }, []);

  useEffect(() => {
    applyScheme(colorScheme, preference);
  }, [applyScheme, colorScheme, preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => setPreference(scheme), [setPreference]);

  const themeVariables = useMemo(
    () =>
      vars(
        Object.fromEntries(
          Object.entries(SchemeColors[colorScheme]).map(([token, value]) => [`color-${toKebab(token)}`, value]),
        ),
      ),
    [colorScheme],
  );

  const value = useMemo(() => ({ colorScheme, preference, setPreference, setColorScheme }), [colorScheme, preference, setPreference, setColorScheme]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
