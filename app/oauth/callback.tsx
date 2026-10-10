import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { describeAuthError } from "@/lib/auth-context";

/**
 * Landing page after Google sign-in: https://<web app>/oauth/callback?ticket=... (web)
 * or ledgerly://oauth/callback?ticket=... (native, when the OS routes the deep link here).
 */
export default function OAuthCallback() {
  const router = useRouter();
  const colors = useColors();
  const { completeSignIn } = useAuth();
  const params = useLocalSearchParams<{ ticket?: string; error?: string }>();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const handled = useRef(false);

  // Problems visible in the URL itself are derived during render; only the network exchange is an effect.
  const urlError = params.error
    ? describeAuthError(params.error)
    : !params.ticket
      ? "This sign-in link is incomplete. Please try again."
      : null;
  const error = urlError ?? exchangeError;

  useEffect(() => {
    if (handled.current || !params.ticket || params.error) return;
    handled.current = true;
    completeSignIn(params.ticket)
      .then(() => router.replace("/(tabs)"))
      .catch((cause) => setExchangeError(cause instanceof Error ? cause.message : "Could not complete sign-in."));
  }, [params.ticket, params.error, completeSignIn, router]);

  return (
    <ScreenContainer className="items-center justify-center p-6" edges={["top", "bottom", "left", "right"]}>
      {error ? (
        <View className="w-full max-w-sm gap-4">
          <Text accessibilityRole="header" className="text-2xl font-black text-foreground">Sign-in didn&apos;t finish</Text>
          <Text accessibilityRole="alert" className="text-base leading-6 text-error">{error}</Text>
          <PrimaryButton label="Try again" onPress={() => router.replace("/(auth)/login")} />
        </View>
      ) : (
        <View className="items-center gap-4">
          <ActivityIndicator size="large" color={colors.tint} />
          <Text className="text-base text-foreground">Signing you in…</Text>
        </View>
      )}
    </ScreenContainer>
  );
}
