import { useAuthContext } from "@/lib/auth-context";

/**
 * Signed-in state shared across the whole app (provided by <AuthProvider> in app/_layout.tsx).
 * Returns { user, loading, error, isAuthenticated, signInWithGoogle, completeSignIn, refresh, logout }.
 */
export function useAuth() {
  return useAuthContext();
}
