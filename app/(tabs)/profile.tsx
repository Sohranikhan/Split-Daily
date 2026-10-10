import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Avatar, Divider, MAX_CONTENT_WIDTH, Row } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { confirm } from "@/lib/confirm";
import { formatMoney } from "@/lib/formatters/currency";
import { trpc } from "@/lib/trpc";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const dashboard = trpc.dashboard.summary.useQuery(undefined, { enabled: isAuthenticated });
  if (loading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.tint} /></ScreenContainer>;
  if (!isAuthenticated) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-2xl font-black text-foreground">Make Split Daily yours.</Text>
          <Text className="mt-2 text-base leading-6 text-muted">Sign in to manage your profile, currency and notification settings.</Text>
          <View className="mt-5"><PrimaryButton label="Sign in with Google" onPress={() => router.push("/(auth)/login")} /></View>
          <View className="mt-3"><Row title="Appearance" subtitle="Light, dark or follow your phone" onPress={() => router.push("/settings")} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }
  const name = user?.name ?? user?.email ?? "Split Daily member";
  const balances = dashboard.data?.balances ?? [];
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
        <Text className="text-4xl font-black text-foreground" maxFontSizeMultiplier={1.3}>Profile</Text>
        <LedgerCard className="mt-5">
          <View className="flex-row items-center gap-4">
            <Avatar name={name} url={user?.avatarUrl} size={60} />
            <View className="flex-1">
              <Text className="text-xl font-black text-foreground" numberOfLines={1}>{name}</Text>
              <Text className="mt-0.5 text-sm text-muted" numberOfLines={1}>{user?.email ?? "Signed in"}</Text>
              <Text className="mt-0.5 text-xs font-semibold text-muted">Default currency · {user?.defaultCurrency ?? "USD"}</Text>
            </View>
          </View>
          {balances.length ? (
            <View className="mt-4 gap-1 rounded-2xl bg-primary-soft p-3">
              {balances.map((b) => (
                <Text key={b.currency} className="text-sm font-bold text-foreground">
                  {b.netMinor >= 0 ? "You are owed " : "You owe "}{formatMoney(Math.abs(b.netMinor), b.currency)} overall
                </Text>
              ))}
            </View>
          ) : null}
        </LedgerCard>

        <LedgerCard className="mt-4 py-1">
          <Row title="Settings" subtitle="Name, currency, appearance, notifications" left={<IconSymbol name="gearshape.fill" size={22} color={colors.foreground} />} onPress={() => router.push("/settings")} />
          <Divider />
          <Row title="Join a group with a code" left={<IconSymbol name="person.badge.plus" size={22} color={colors.foreground} />} onPress={() => router.push("/groups/join")} />
          <Divider />
          <Row title="Settle up" subtitle="Record a payment" left={<IconSymbol name="creditcard.fill" size={22} color={colors.foreground} />} onPress={() => router.push("/settlements/new")} />
          <Divider />
          <Row title="Sign out" left={<IconSymbol name="rectangle.portrait.and.arrow.right" size={22} color={colors.error} />} destructive onPress={async () => { if (await confirm("Sign out?", "You can sign back in with Google any time.", { confirmLabel: "Sign out" })) await logout(); }} />
        </LedgerCard>
      </ScrollView>
    </ScreenContainer>
  );
}
