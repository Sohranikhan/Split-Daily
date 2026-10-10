import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useQueryClient } from "@tanstack/react-query";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { isNativeGoogleAvailable, nativeGoogleSignIn, nativeGoogleSignOut } from "@/lib/google-native";

const CALLBACK_PATH = "oauth/callback";

/** Human-readable messages for the `error` codes the server puts on the redirect URL. */
export function describeAuthError(code: string | null | undefined): string {
  switch (code) {
    case "access_denied":
      return "Sign-in was cancelled.";
    case "google_not_configured":
      return "Google sign-in isn't set up on the server yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env.";
    case "email_not_verified":
      return "Your Google account email isn't verified, so it can't be used to sign in.";
    case "state_mismatch":
    case "missing_code":
      return "Your sign-in session expired. Please try again.";
    case "google_error":
      return "Google couldn't complete the sign-in. Please try again.";
    case "server_error":
      return "Something went wrong on our side while signing you in. Please try again.";
    default:
      return code ? `Sign-in failed (${code}).` : "Sign-in failed. Please try again.";
  }
}

type SignInResult = { ok: true } | { ok: false; cancelled?: boolean; error: string } | { ok: "redirecting" };

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  /**
   * Opens Google sign-in.
   * iOS/Android builds: Google's native account sheet inside the app (no browser).
   * Web, and Expo Go as a fallback: the server redirect flow.
   */
  signInWithGoogle: () => Promise<SignInResult>;
  /** Completes sign-in from the `ticket` on the callback URL. Safe to call more than once per ticket. */
  completeSignIn: (ticket: string) => Promise<Auth.User>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function callbackUrl() {
  if (Platform.OS === "web") return `${window.location.origin}/${CALLBACK_PATH}`;
  // ledgerly://oauth/callback in builds, exp://<ip>:8081/--/oauth/callback in Expo Go
  return Linking.createURL(CALLBACK_PATH);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const pendingTickets = useRef(new Map<string, Promise<Auth.User>>());

  const clearLocal = useCallback(async () => {
    await Auth.removeSessionToken();
    await Auth.clearCachedUser();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const token = await Auth.getSessionToken();
    setError(null);
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Paint instantly with the cached profile, then confirm with the server.
    const cached = await Auth.getCachedUser();
    if (cached) setUser(cached);
    try {
      const me = await Api.getMe();
      if (me) {
        setUser(me);
        await Auth.setCachedUser(me);
      } else {
        await clearLocal(); // token expired or revoked
      }
    } catch (cause) {
      // Offline or server down: keep the cached session, surface the error.
      setError(cause instanceof Error ? cause : new Error("Could not reach the server"));
    } finally {
      setLoading(false);
    }
  }, [clearLocal]);

  // Restore the saved session once on startup (state is only set after async storage/network calls).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const completeSignIn = useCallback(
    (ticket: string) => {
      const existing = pendingTickets.current.get(ticket);
      if (existing) return existing;
      const promise = (async () => {
        const result = await Api.exchangeLoginTicket(ticket);
        await Auth.setSessionToken(result.token);
        await Auth.setCachedUser(result.user);
        setUser(result.user);
        setError(null);
        setLoading(false);
        await queryClient.invalidateQueries();
        return result.user;
      })();
      pendingTickets.current.set(ticket, promise);
      promise.catch(() => pendingTickets.current.delete(ticket));
      return promise;
    },
    [queryClient],
  );

  const applySession = useCallback(
    async (result: { token: string; user: Auth.User }) => {
      await Auth.setSessionToken(result.token);
      await Auth.setCachedUser(result.user);
      setUser(result.user);
      setError(null);
      setLoading(false);
      await queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    // 1. In-app native sheet (development / release builds).
    if (isNativeGoogleAvailable()) {
      try {
        const google = await nativeGoogleSignIn();
        if (google.type === "cancelled") return { ok: false, cancelled: true, error: "Sign-in was cancelled." };
        await applySession(await Api.signInWithGoogleIdToken(google.idToken));
        return { ok: true };
      } catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : "Could not complete sign-in." };
      }
    }

    // 2. Browser redirect flow (web, Expo Go).
    const returnTo = callbackUrl();
    let startUrl: string;
    try {
      startUrl = Api.googleStartUrl(returnTo);
    } catch (cause) {
      return { ok: false, error: cause instanceof Error ? cause.message : "Sign-in is not configured." };
    }

    if (Platform.OS === "web") {
      window.location.assign(startUrl);
      return { ok: "redirecting" };
    }

    const result = await WebBrowser.openAuthSessionAsync(startUrl, returnTo);
    if (result.type !== "success") {
      return { ok: false, cancelled: true, error: "Sign-in was cancelled." };
    }
    const { queryParams } = Linking.parse(result.url);
    const ticket = typeof queryParams?.ticket === "string" ? queryParams.ticket : null;
    const errorCode = typeof queryParams?.error === "string" ? queryParams.error : null;
    if (!ticket) return { ok: false, error: describeAuthError(errorCode) };
    try {
      await completeSignIn(ticket);
      return { ok: true };
    } catch (cause) {
      return { ok: false, error: cause instanceof Error ? cause.message : "Could not complete sign-in." };
    }
  }, [completeSignIn, applySession]);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      // Still sign out locally when offline.
    } finally {
      await nativeGoogleSignOut();
      await clearLocal();
      setError(null);
    }
  }, [clearLocal]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, isAuthenticated: Boolean(user), signInWithGoogle, completeSignIn, refresh, logout }),
    [user, loading, error, signInWithGoogle, completeSignIn, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
