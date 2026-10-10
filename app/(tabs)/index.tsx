import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AppLogo } from "@/components/ui/app-logo";
import { Avatar, Divider, MAX_CONTENT_WIDTH, Row, SectionTitle } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { QueryError } from "@/components/ui/query-error";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { fitFontSize, formatAmounts, formatMoney } from "@/lib/formatters/currency";
import { go } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import { toCurrencyCode } from "@/shared/domain";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function HomeScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { user, isAuthenticated } = useAuth();
  const dashboardQuery = trpc.dashboard.summary.useQuery(undefined, { enabled: isAuthenticated });
  const data = dashboardQuery.data;
  const currency = data?.balance.currency ?? toCurrencyCode(user?.defaultCurrency);
  const otherBalances = (data?.balances ?? []).filter((b) => b.currency !== currency);

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={dashboardQuery.isRefetching} onRefresh={() => void dashboardQuery.refetch()} tintColor={colors.tint} colors={[colors.tint]} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-6 flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-sm font-semibold uppercase tracking-[2px] text-muted">Split Daily</Text>
            <Text className="mt-1 text-3xl font-black text-foreground" numberOfLines={2} maxFontSizeMultiplier={1.3}>{greeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</Text>
          </View>
          <AppLogo size={44} />
        </View>

        {!isAuthenticated ? (
          <LedgerCard className="mb-6 overflow-hidden border-hero bg-hero">
            <Text className="text-sm font-bold uppercase tracking-[1.5px] text-hero-accent">Shared money, made clear</Text>
            <Text className="mt-3 text-3xl font-black leading-9 text-on-hero">Split bills with friends, without the awkward maths.</Text>
            <Text className="mt-3 text-base leading-6 text-on-hero-muted">Sign in with Google to create groups, add expenses and settle up.</Text>
            <View className="mt-5"><PrimaryButton label="Sign in with Google" onPress={() => router.push("/(auth)/login")} /></View>
          </LedgerCard>
        ) : (
          <>
            {dashboardQuery.isError ? <View className="mb-4"><QueryError onRetry={() => void dashboardQuery.refetch()} message="Your balances could not be loaded." /></View> : null}
            <LedgerCard className="mb-4 border-hero bg-hero">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-on-hero-muted">Overall balance</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Change default currency" onPress={() => router.push("/settings")} className="flex-row items-center gap-1" hitSlop={10}>
                  <Text className="text-sm font-semibold text-on-hero-muted">{currency}</Text>
                  <IconSymbol name="chevron.right" size={16} color={colors.heroAccent} />
                </Pressable>
              </View>
              <Text className={`mt-3 font-black tracking-tight ${(data?.balance.netMinor ?? 0) < 0 ? "text-on-hero" : "text-hero-accent"}`} numberOfLines={1} maxFontSizeMultiplier={1} style={{ fontSize: fitFontSize(formatMoney(Math.abs(data?.balance.netMinor ?? 0), currency), Math.min(width, MAX_CONTENT_WIDTH) - 82, 48, 26) }}>
                {formatMoney(Math.abs(data?.balance.netMinor ?? 0), currency)}
              </Text>
              <Text className="mt-1 text-sm text-on-hero-muted">{(data?.balance.netMinor ?? 0) > 0 ? "in total, you are owed" : (data?.balance.netMinor ?? 0) < 0 ? "in total, you owe" : "you're all settled up"}</Text>
              <View className="mt-4 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-hero-tile p-3"><Text className="text-xs font-semibold text-on-hero-muted">You owe</Text><Text className="mt-1 text-lg font-black text-on-hero" numberOfLines={1} adjustsFontSizeToFit>{formatMoney(data?.balance.youOweMinor ?? 0, currency)}</Text></View>
                <View className="flex-1 rounded-2xl bg-hero-tile p-3"><Text className="text-xs font-semibold text-on-hero-muted">You are owed</Text><Text className="mt-1 text-lg font-black text-hero-accent" numberOfLines={1} adjustsFontSizeToFit>{formatMoney(data?.balance.owedToYouMinor ?? 0, currency)}</Text></View>
              </View>
              {otherBalances.length ? (
                <View className="mt-3 gap-1">
                  {otherBalances.map((b) => (
                    <Text key={b.currency} className="text-sm text-on-hero-muted">Also: {b.netMinor >= 0 ? "owed" : "you owe"} <Text className="font-black text-on-hero">{formatMoney(Math.abs(b.netMinor), b.currency)}</Text></Text>
                  ))}
                </View>
              ) : null}
            </LedgerCard>
            <View className="mb-2 flex-row gap-3">
              <View className="flex-1"><PrimaryButton label="Add expense" onPress={() => router.push("/expenses/new")} /></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Settle up" onPress={() => router.push("/settlements/new")} style={({ pressed }) => ({ paddingHorizontal: 18, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.input, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1, flexDirection: "row", gap: 6 })}>
                <IconSymbol name="arrow.up.right" size={20} color={colors.foreground} />
                <Text className="text-base font-bold text-foreground">Settle up</Text>
              </Pressable>
            </View>

            {data?.people.length ? (
              <>
                <SectionTitle>Balances with people</SectionTitle>
                <LedgerCard className="py-1">
                  {data.people.slice(0, 8).map((person, index) => {
                    const owesYou = person.balances.filter((b) => b.amountMinor > 0);
                    const youOwe = person.balances.filter((b) => b.amountMinor < 0);
                    const main = person.balances[0]!;
                    return (
                      <View key={person.userId}>
                        {index ? <Divider /> : null}
                        <Row
                          title={person.name}
                          subtitle={[owesYou.length ? `owes you ${formatAmounts(owesYou)}` : null, youOwe.length ? `you owe ${formatAmounts(youOwe)}` : null].filter(Boolean).join(" · ")}
                          left={<Avatar name={person.name} url={person.avatarUrl} size={38} />}
                          right={<Text className="text-xs font-black text-muted underline">Settle</Text>}
                          onPress={() => go(`/settlements/new?from=${main.amountMinor > 0 ? person.userId : user?.publicId}&to=${main.amountMinor > 0 ? user?.publicId : person.userId}&amount=${Math.abs(main.amountMinor)}&currency=${main.currency}`)}
                        />
                      </View>
                    );
                  })}
                </LedgerCard>
              </>
            ) : null}
          </>
        )}

        <SectionTitle action={isAuthenticated ? { label: "See all", onPress: () => router.push("/(tabs)/groups") } : undefined}>Your groups</SectionTitle>
        {dashboardQuery.isLoading && isAuthenticated ? <ActivityIndicator color={colors.tint} /> : data?.groups.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
            <View className="flex-row gap-3 px-1">
              {data.groups.map((group) => (
                <Pressable key={group.id} accessibilityRole="button" onPress={() => go(`/groups/${group.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <LedgerCard className="w-44">
                    <View className="mb-5 h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: group.accent }}><IconSymbol name="person.2.fill" size={18} color="#14200F" /></View>
                    <Text className="text-base font-black text-foreground" numberOfLines={1}>{group.name}</Text>
                    <Text className="mt-1 text-sm text-muted">{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</Text>
                    <Text className="mt-3 text-sm font-bold" numberOfLines={1} style={{ color: group.balanceMinor > 0 ? colors.success : group.balanceMinor < 0 ? colors.error : colors.muted }}>
                      {group.balanceMinor === 0 ? "settled up" : `${group.balanceMinor > 0 ? "owed " : "owe "}${formatMoney(Math.abs(group.balanceMinor), group.currency)}`}
                    </Text>
                  </LedgerCard>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <LedgerCard>
            <Text className="text-base font-bold text-foreground">No groups yet</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Create a group, add friends by email or invite code, and start splitting.</Text>
            {isAuthenticated ? <View className="mt-4"><PrimaryButton label="Create a group" onPress={() => router.push("/groups/new")} /></View> : null}
          </LedgerCard>
        )}

        <SectionTitle>Recent activity</SectionTitle>
        {dashboardQuery.isLoading && isAuthenticated ? <ActivityIndicator color={colors.tint} /> : data?.activity.length ? (
          <LedgerCard className="py-1">
            {data.activity.slice(0, 10).map((item, index) => {
              const target = item.relatedType === "expense" && item.relatedId ? `/expenses/${item.relatedId}` : item.relatedType === "group" && item.relatedId ? `/groups/${item.relatedId}` : null;
              return (
                <View key={item.id}>
                  {index ? <Divider /> : null}
                  <Row
                    title={item.title}
                    subtitle={item.subtitle}
                    left={<View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft"><IconSymbol name={item.kind === "settlement" ? "creditcard.fill" : item.kind === "group" ? "person.2.fill" : "receipt.fill"} size={19} color={colors.foreground} /></View>}
                    right={item.amountMinor !== undefined ? <Text className="text-sm font-black text-foreground">{formatMoney(item.amountMinor, item.currency)}</Text> : undefined}
                    onPress={target ? () => go(target) : undefined}
                  />
                </View>
              );
            })}
          </LedgerCard>
        ) : (
          <LedgerCard><Text className="text-base font-bold text-foreground">Your feed is quiet</Text><Text className="mt-1 text-sm leading-5 text-muted">Expenses, payments and group changes will appear here.</Text></LedgerCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
