import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { MAX_CONTENT_WIDTH, SectionTitle } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { QueryError } from "@/components/ui/query-error";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { confirm } from "@/lib/confirm";
import { formatMoney } from "@/lib/formatters/currency";
import { go } from "@/lib/nav";
import { trpc } from "@/lib/trpc";

function timeAgo(iso: string | Date) {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function ActivityScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated });
  const settlementsQuery = trpc.settlements.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const statusMutation = trpc.settlements.updateStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.settlements.list.invalidate(), utils.dashboard.summary.invalidate(), utils.groups.invalidate()]);
    },
  });
  const readMutation = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });
  const readAll = trpc.notifications.markAllRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });

  if (!isAuthenticated) return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-2xl font-black text-foreground">Activity that tells the story.</Text><Text className="mt-2 text-base leading-6 text-muted">Sign in to see group updates, payments and changes to your expenses.</Text><View className="mt-5"><PrimaryButton label="Sign in" onPress={() => router.push("/(auth)/login")} /></View></LedgerCard></ScreenContainer>;

  const refresh = () => {
    void notificationsQuery.refetch();
    void settlementsQuery.refetch();
  };
  const unread = (notificationsQuery.data ?? []).filter((n) => !n.readAt).length;
  const payments = (settlementsQuery.data ?? []).slice(0, 15);

  const cancelPayment = async (publicId: string) => {
    if (await confirm("Cancel this payment?", "Balances will go back to how they were before it was recorded.", { confirmLabel: "Cancel payment", destructive: true })) {
      statusMutation.mutate({ publicId, status: "cancelled" });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={notificationsQuery.isRefetching || settlementsQuery.isRefetching} onRefresh={refresh} tintColor={colors.tint} colors={[colors.tint]} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      >
        <Text className="text-4xl font-black text-foreground" maxFontSizeMultiplier={1.3}>Activity</Text>
        <Text className="mt-1 text-base text-muted">What’s changed in your shared money.</Text>
        {notificationsQuery.isError || settlementsQuery.isError ? <View className="mt-4"><QueryError onRetry={refresh} message="Your activity could not be loaded." /></View> : null}
        {statusMutation.error ? <Text className="mt-3 text-sm font-semibold text-error">{statusMutation.error.message}</Text> : null}

        <SectionTitle action={unread ? { label: "Mark all read", onPress: () => readAll.mutate() } : undefined}>
          {unread ? `Notifications · ${unread} new` : "Notifications"}
        </SectionTitle>
        {notificationsQuery.isLoading ? <ActivityIndicator color={colors.tint} /> : notificationsQuery.data?.length ? (
          <LedgerCard className="py-1">
            {notificationsQuery.data.map((item, index) => {
              const target = item.relatedEntityType === "expense" && item.relatedEntityId && !item.type.endsWith("deleted")
                ? `/expenses/${item.relatedEntityId}`
                : item.relatedEntityType === "group" && item.relatedEntityId && !item.type.endsWith("deleted") && !item.type.endsWith("removed")
                  ? `/groups/${item.relatedEntityId}`
                  : null;
              return (
                <Pressable
                  key={item.publicId}
                  accessibilityRole="button"
                  onPress={() => {
                    if (!item.readAt) readMutation.mutate({ publicId: item.publicId });
                    if (target) go(target);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <View className={`flex-row items-start gap-3 py-3 ${index ? "border-t border-border" : ""}`}>
                    <View className="mt-1.5 h-2.5 w-2.5 rounded-full" accessibilityLabel={item.readAt ? "Read" : "Unread"} style={{ backgroundColor: item.readAt ? "transparent" : colors.success }} />
                    <View className="flex-1">
                      <Text className={`text-base text-foreground ${item.readAt ? "font-semibold" : "font-black"}`}>{item.title}</Text>
                      <Text className="mt-0.5 text-sm leading-5 text-muted">{item.message}</Text>
                      <Text className="mt-1 text-xs text-muted">{timeAgo(item.createdAt)}</Text>
                    </View>
                    {target ? <IconSymbol name="chevron.right" size={18} color={colors.muted} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </LedgerCard>
        ) : (
          <LedgerCard><Text className="text-base font-bold text-foreground">Nothing new yet</Text><Text className="mt-1 text-sm leading-5 text-muted">When someone adds or edits an expense with you, it shows up here.</Text></LedgerCard>
        )}

        <SectionTitle action={{ label: "Settle up", onPress: () => router.push("/settlements/new") }}>Payments</SectionTitle>
        {settlementsQuery.isLoading ? <ActivityIndicator color={colors.tint} /> : payments.length ? (
          <LedgerCard className="py-1">
            {payments.map((s, index) => (
              <View key={s.publicId} className={`py-3 ${index ? "border-t border-border" : ""}`}>
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-base font-bold text-foreground" style={{ textDecorationLine: s.status === "cancelled" ? "line-through" : "none" }}>{s.payerName} paid {s.receiverName}</Text>
                    <Text className="mt-0.5 text-sm text-muted">
                      {s.paymentMethod}{s.groupName ? ` · ${s.groupName}` : ""} · {timeAgo(s.createdAt)} · {s.status === "paid" ? "awaiting confirmation" : s.status}
                    </Text>
                  </View>
                  <Text className="text-base font-black" style={{ color: s.status === "cancelled" ? colors.muted : s.iAmPayer ? colors.foreground : colors.success }}>{formatMoney(s.amountMinor, s.currency)}</Text>
                </View>
                {s.canConfirm || s.canCancel ? (
                  <View className="mt-2 flex-row gap-2">
                    {s.canConfirm ? (
                      <Pressable accessibilityRole="button" onPress={() => statusMutation.mutate({ publicId: s.publicId, status: "confirmed" })} className="rounded-xl bg-primary px-3 py-2"><Text className="text-xs font-black text-on-primary">Confirm received</Text></Pressable>
                    ) : null}
                    {s.canCancel ? (
                      <Pressable accessibilityRole="button" onPress={() => void cancelPayment(s.publicId)} className="rounded-xl border border-input px-3 py-2"><Text className="text-xs font-bold text-muted">Cancel</Text></Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </LedgerCard>
        ) : (
          <LedgerCard><Text className="text-base font-bold text-foreground">No payments yet</Text><Text className="mt-1 text-sm leading-5 text-muted">When someone pays back, record it with Settle up and balances update instantly.</Text></LedgerCard>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
