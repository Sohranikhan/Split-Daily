// The web app uses the server redirect flow (see lib/auth-context.tsx); the native SDK is iOS/Android only.
export type NativeGoogleResult = { type: "success"; idToken: string } | { type: "cancelled" };

export function isNativeGoogleAvailable() {
  return false;
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  throw new Error("Native Google sign-in is not available on the web.");
}

export async function nativeGoogleSignOut() {}
