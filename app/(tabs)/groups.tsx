import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MAX_CONTENT_WIDTH, SecondaryButton } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { QueryError } from "@/components/ui/query-error";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { formatAmounts } from "@/lib/formatters/currency";
import { go } from "@/lib/nav";
import { trpc } from "@/lib/trpc";

export default function GroupsScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const groupsQuery = trpc.groups.list.useQuery(undefined, { enabled: isAuthenticated });

  if (!isAuthenticated) {
    return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-2xl font-black text-foreground">Your groups live here.</Text><Text className="mt-2 text-base leading-6 text-muted">Sign in to see trips, homes and shared plans.</Text><View className="mt-5"><PrimaryButton label="Sign in" onPress={() => router.push("/(auth)/login")} /></View></LedgerCard></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <FlatList
        data={groupsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        refreshControl={<RefreshControl refreshing={groupsQuery.isRefetching} onRefresh={() => void groupsQuery.refetch()} tintColor={colors.tint} colors={[colors.tint]} />}
        ListHeaderComponent={
          <View className="mb-5">
            <Text className="text-4xl font-black text-foreground" maxFontSizeMultiplier={1.3}>Groups</Text>
            <Text className="mt-1 text-base text-muted">Trips, homes and everything you share.</Text>
            <View className="mt-5 flex-row gap-3">
              <View className="flex-1"><PrimaryButton label="Create a group" onPress={() => router.push("/groups/new")} /></View>
              <View className="flex-1"><SecondaryButton label="Join with code" onPress={() => router.push("/groups/join")} /></View>
            </View>
          </View>
        }
        ListEmptyComponent={groupsQuery.isLoading ? <ActivityIndicator color={colors.tint} /> : groupsQuery.isError ? <QueryError onRetry={() => void groupsQuery.refetch()} message="Your groups could not be loaded." /> : <LedgerCard><Text className="text-lg font-bold text-foreground">No groups yet</Text><Text className="mt-2 text-sm leading-5 text-muted">Create a group for a trip, your flat or an event, then add friends by email or invite code.</Text></LedgerCard>}
        renderItem={({ item }) => {
          const owed = item.balances.filter((b) => b.amountMinor > 0);
          const owe = item.balances.filter((b) => b.amountMinor < 0);
          return (
            <Pressable accessibilityRole="button" onPress={() => go(`/groups/${item.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <LedgerCard className="mb-3">
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: item.accent }}><IconSymbol name="person.2.fill" size={20} color="#14200F" /></View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-foreground" numberOfLines={1}>{item.name}</Text>
                    <Text className="mt-0.5 text-sm text-muted">{item.category} · {item.memberCount} {item.memberCount === 1 ? "member" : "members"}</Text>
                  </View>
                  <View className="items-end" style={{ maxWidth: "45%" }}>
                    {!item.balances.length ? <Text className="text-sm font-semibold text-muted">settled up</Text> : null}
                    {owed.length ? <><Text className="text-xs font-semibold text-success">you are owed</Text><Text className="text-sm font-black text-success" numberOfLines={1} adjustsFontSizeToFit>{formatAmounts(owed)}</Text></> : null}
                    {owe.length ? <><Text className="text-xs font-semibold text-error">you owe</Text><Text className="text-sm font-black text-error" numberOfLines={1} adjustsFontSizeToFit>{formatAmounts(owe)}</Text></> : null}
                  </View>
                </View>
              </LedgerCard>
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}
