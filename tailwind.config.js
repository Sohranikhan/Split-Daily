const { themeColors, toKebab } = require("./theme.config");
const plugin = require("tailwindcss/plugin");

// Each token becomes e.g. `bg-on-primary` / `text-on-primary`, backed by a CSS variable that
// ThemeProvider sets for the active scheme (web: on :root, native: via NativeWind `vars`).
const tailwindColors = Object.fromEntries(
  Object.entries(themeColors).map(([name, swatch]) => [
    toKebab(name),
    {
      DEFAULT: `var(--color-${toKebab(name)})`,
      light: swatch.light,
      dark: swatch.dark,
    },
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,tsx}", "./components/**/*.{js,ts,tsx}", "./lib/**/*.{js,ts,tsx}", "./hooks/**/*.{js,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: tailwindColors,
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("light", ':root:not([data-theme="dark"]) &');
      addVariant("dark", ':root[data-theme="dark"] &');
    }),
  ],
};
