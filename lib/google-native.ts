import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type * as GoogleSignInModule from "@react-native-google-signin/google-signin";

/**
 * In-app Google Sign-In for iOS / Android using Google's native SDK (Credential Manager
 * account sheet on Android, Google's sign-in sheet on iOS). No browser, no redirect URL.
 *
 * Requires a development or release build (`npx expo run:android`, `eas build`). Expo Go
 * does not contain this native module, so the app falls back to the browser flow there.
 */
// Only real *.apps.googleusercontent.com IDs count; placeholder text in .env is treated as unset.
const asClientId = (value: string | undefined) => {
  const id = (value ?? "").trim();
  return id.endsWith(".apps.googleusercontent.com") ? id : "";
};
const WEB_CLIENT_ID = asClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
const IOS_CLIENT_ID = asClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

export type NativeGoogleResult = { type: "success"; idToken: string } | { type: "cancelled" };

let cachedModule: typeof GoogleSignInModule | null = null;
let configured = false;

function isExpoGo() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** True when the native Google sheet can be used on this device/build. */
export function isNativeGoogleAvailable() {
  if (Platform.OS === "web" || isExpoGo() || !WEB_CLIENT_ID) return false;
  if (Platform.OS === "ios" && !IOS_CLIENT_ID) return false;
  return Boolean(load());
}

function load(): typeof GoogleSignInModule | null {
  if (cachedModule) return cachedModule;
  try {
    // Loaded lazily: importing it at the top level crashes Expo Go, which lacks the native code.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require("@react-native-google-signin/google-signin") as typeof GoogleSignInModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

function configure(mod: typeof GoogleSignInModule) {
  if (configured) return;
  mod.GoogleSignin.configure({
    // The Web client ID makes Google issue an ID token our server can verify.
    webClientId: WEB_CLIENT_ID,
    ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
    scopes: ["profile", "email"],
  });
  configured = true;
}

function friendlyError(mod: typeof GoogleSignInModule, error: unknown): Error {
  if (mod.isErrorWithCode(error)) {
    switch (error.code) {
      case mod.statusCodes.IN_PROGRESS:
        return new Error("Google sign-in is already open.");
      case mod.statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return new Error("Google Play Services is missing or out of date on this device.");
      case "DEVELOPER_ERROR":
      case "10":
        return new Error(
          "Google sign-in is misconfigured for this build. Check the Android OAuth client (package name + SHA-1) and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.",
        );
    }
    return new Error(error.message || `Google sign-in failed (${error.code}).`);
  }
  return error instanceof Error ? error : new Error("Google sign-in failed.");
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  const mod = load();
  if (!mod) throw new Error("Native Google sign-in is not available in this build.");
  configure(mod);
  try {
    if (Platform.OS === "android") await mod.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await mod.GoogleSignin.signIn();
    if (!mod.isSuccessResponse(response)) return { type: "cancelled" };
    const idToken = response.data.idToken;
    if (!idToken) throw new Error("Google didn't return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
    return { type: "success", idToken };
  } catch (error) {
    if (mod.isErrorWithCode(error) && error.code === mod.statusCodes.SIGN_IN_CANCELLED) return { type: "cancelled" };
    throw friendlyError(mod, error);
  }
}

/** Forget the Google account on the device so the account picker shows again next time. */
export async function nativeGoogleSignOut() {
  const mod = isNativeGoogleAvailable() ? load() : null;
  if (!mod) return;
  try {
    configure(mod);
    await mod.GoogleSignin.signOut();
  } catch {
    // not signed in with Google on this device
  }
}
