import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AppLogo } from "@/components/ui/app-logo";
import { GoogleButton } from "@/components/ui/google-button";
import { useAuth } from "@/hooks/use-auth";
import { describeAuthError } from "@/lib/auth-context";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string; next?: string }>();
  // Where to go after signing in (e.g. back to an invite link). Only in-app paths are allowed.
  const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("//") ? params.next : "/(tabs)";
  const { signInWithGoogle, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.error ? describeAuthError(params.error) : null);

  useEffect(() => {
    if (isAuthenticated) router.replace(next as Href);
  }, [isAuthenticated, router, next]);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (result.ok === true) router.replace(next as Href);
      else if (result.ok === false && !result.cancelled) setError(result.error);
      if (result.ok !== "redirecting") setLoading(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in is not available right now.");
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="justify-between p-6" edges={["top", "bottom", "left", "right"]}>
      <View className="pt-12">
        <View className="mb-8">
          <AppLogo size={64} />
        </View>
        <Text className="text-5xl font-black tracking-tight text-foreground">Money,{"\n"}together.</Text>
        <Text className="mt-4 max-w-sm text-lg leading-7 text-muted">
          Split Daily keeps shared expenses clear, calm and easy to settle.
        </Text>
      </View>
      <View className="gap-4 pb-4">
        {error ? (
          <View accessibilityRole="alert" className="rounded-2xl border border-error bg-surface p-4">
            <Text className="text-sm font-semibold leading-5 text-error">{error}</Text>
          </View>
        ) : null}
        <GoogleButton loading={loading} onPress={handleGoogle} />
        <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)")} className="items-center py-3">
          <Text className="text-sm font-semibold text-muted underline">Not now, just look around</Text>
        </Pressable>
        <Text className="text-center text-xs leading-5 text-muted">
          We only receive your name, email and profile photo from Google. No passwords are stored in Split Daily.
        </Text>
      </View>
    </ScreenContainer>
  );
}
