/**
 * Ledgerly color tokens. Every text/background pairing used in the app is checked to meet
 * WCAG AA (4.5:1 for text, 3:1 for input borders and icons) in both light and dark mode.
 *
 * Rules of thumb:
 *  - Text on `primary` (lime) uses `onPrimary` — never `foreground` (white-on-lime in dark mode was ~1:1).
 *  - The dark balance card uses `hero` + `onHero` / `onHeroMuted` / `heroAccent` / `heroTile`.
 *  - Tinted panels use `primarySoft` instead of an opacity modifier (opacity on CSS variables is unreliable in NativeWind).
 *
 * Keys are camelCase in JS (useColors().onPrimary) and kebab-case in Tailwind (text-on-primary).
 *
 * @type {const}
 */
const themeColors = {
  primary: { light: "#C8F169", dark: "#D7FF76" },
  onPrimary: { light: "#14200F", dark: "#111713" },
  primarySoft: { light: "#EEF9D2", dark: "#2B3A1E" },
  background: { light: "#F7F8F5", dark: "#111713" },
  surface: { light: "#FFFFFF", dark: "#18201A" },
  foreground: { light: "#17231B", dark: "#F0F6EE" },
  muted: { light: "#56635A", dark: "#A9B6AB" },
  border: { light: "#E1E7DF", dark: "#2A382C" },
  input: { light: "#7E8A81", dark: "#61766A" },
  success: { light: "#22704A", dark: "#6CDA91" },
  warning: { light: "#985E14", dark: "#F3BB5C" },
  error: { light: "#B23B36", dark: "#F58F8A" },
  hero: { light: "#20392A", dark: "#1E3426" },
  onHero: { light: "#F7F8F5", dark: "#F0F6EE" },
  onHeroMuted: { light: "#C3D1C6", dark: "#B7C7BB" },
  heroAccent: { light: "#C8F169", dark: "#D7FF76" },
  heroTile: { light: "#2C4A37", dark: "#2A4433" },
  coral: { light: "#F2A39D", dark: "#F2A39D" },
  sky: { light: "#BFD4FF", dark: "#BFD4FF" },
};

/** "onPrimary" -> "on-primary" */
const toKebab = (name) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

module.exports = { themeColors, toKebab };
