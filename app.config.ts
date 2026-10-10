import type { ExpoConfig } from "expo/config";
const bundleId = process.env.APP_BUNDLE_ID ?? "com.amir.splitdaily";
const scheme = "splitdaily";
const rawIosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "").trim();
const googleIosClientId = rawIosClientId.endsWith(".apps.googleusercontent.com") ? rawIosClientId : "";
const googleSignInPlugins: [string, { iosUrlScheme: string }][] = googleIosClientId
  ? [["@react-native-google-signin/google-signin", { iosUrlScheme: `com.googleusercontent.apps.${googleIosClientId.replace(".apps.googleusercontent.com", "")}` }]]
  : [];

const allowCleartextHttp = process.env.ALLOW_CLEARTEXT_HTTP === "1";

const config: ExpoConfig = {
  name: "Split Daily",
  slug: "splitwise",
  version: "1.0.0",
  owner: "aamir1121",
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
    eas: { projectId: "7e851d9a-5787-4c71-bee9-129a6128a794" },
  },
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme,
  userInterfaceStyle: "automatic",
  ios: { supportsTablet: true, bundleIdentifier: bundleId, infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: {
    adaptiveIcon: {
      backgroundColor: "#20392A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    package: bundleId,
    permissions: ["POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
    ],
    intentFilters: [{ action: "VIEW", data: [{ scheme }], category: ["BROWSABLE", "DEFAULT"] }],
  },
  web: { bundler: "metro", output: "single", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-asset",
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    ...googleSignInPlugins,
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: "#F7F8F5", dark: { backgroundColor: "#111713" } }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24, usesCleartextTraffic: allowCleartextHttp } }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
