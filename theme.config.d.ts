type Swatch = { light: string; dark: string };

export declare const themeColors: {
  primary: Swatch;
  onPrimary: Swatch;
  primarySoft: Swatch;
  background: Swatch;
  surface: Swatch;
  foreground: Swatch;
  muted: Swatch;
  border: Swatch;
  input: Swatch;
  success: Swatch;
  warning: Swatch;
  error: Swatch;
  hero: Swatch;
  onHero: Swatch;
  onHeroMuted: Swatch;
  heroAccent: Swatch;
  heroTile: Swatch;
  coral: Swatch;
  sky: Swatch;
};

export declare function toKebab(name: string): string;

declare const themeConfig: {
  themeColors: typeof themeColors;
  toKebab: typeof toKebab;
};

export default themeConfig;
