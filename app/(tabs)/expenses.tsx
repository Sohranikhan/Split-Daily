import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ExpenseRow } from "@/components/expense-row";
import { Chip, MAX_CONTENT_WIDTH } from "@/components/ui/form";
import { LedgerCard } from "@/components/ui/ledger-card";
import { QueryError } from "@/components/ui/query-error";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type Filter = "all" | "lent" | "borrowed" | "mine";

export default function ExpensesScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const query = trpc.expenses.list.useQuery(undefined, { enabled: isAuthenticated });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter((item) => {
      if (filter === "lent" && item.myNetMinor <= 0) return false;
      if (filter === "borrowed" && item.myNetMinor >= 0) return false;
      if (filter === "mine" && !item.createdByMe) return false;
      if (!q) return true;
      return `${item.description} ${item.category} ${item.groupName ?? ""} ${item.paidByName}`.toLowerCase().includes(q);
    });
  }, [query.data, search, filter]);

  if (!isAuthenticated) return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-2xl font-black text-foreground">Expenses, without the guesswork.</Text><Text className="mt-2 text-base leading-6 text-muted">Sign in to keep every shared bill and split in one place.</Text><View className="mt-5"><PrimaryButton label="Sign in" onPress={() => router.push("/(auth)/login")} /></View></LedgerCard></ScreenContainer>;

  return (
    <ScreenContainer>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.tint} colors={[colors.tint]} />}
        ListHeaderComponent={
          <View className="mb-3">
            <Text className="text-4xl font-black text-foreground" maxFontSizeMultiplier={1.3}>Expenses</Text>
            <Text className="mt-1 text-base text-muted">Every shared bill, newest first.</Text>
            <View className="mt-5"><PrimaryButton label="Add an expense" onPress={() => router.push("/expenses/new")} /></View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search expenses" placeholderTextColor={colors.muted} autoCorrect={false} clearButtonMode="while-editing" className="mt-4 rounded-2xl border border-input bg-surface px-4 py-3 text-base text-foreground" />
            <View className="mt-3 flex-row flex-wrap gap-2">
              <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
              <Chip label="You lent" selected={filter === "lent"} onPress={() => setFilter("lent")} />
              <Chip label="You borrowed" selected={filter === "borrowed"} onPress={() => setFilter("borrowed")} />
              <Chip label="Added by you" selected={filter === "mine"} onPress={() => setFilter("mine")} />
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? <ActivityIndicator color={colors.tint} /> : query.isError ? <QueryError onRetry={() => void query.refetch()} message="Your expenses could not be loaded." /> : (
            <LedgerCard>
              <Text className="text-lg font-bold text-foreground">{search || filter !== "all" ? "Nothing matches" : "No expenses yet"}</Text>
              <Text className="mt-2 text-sm leading-5 text-muted">{search || filter !== "all" ? "Try a different search or filter." : "Add one and it will show up here with everyone's share."}</Text>
            </LedgerCard>
          )
        }
        renderItem={({ item }) => <ExpenseRow item={item} showGroup />}
      />
    </ScreenContainer>
  );
}
