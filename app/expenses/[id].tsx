import { ActivityIndicator, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Avatar, Divider, ErrorBanner, FormScreen, MAX_CONTENT_WIDTH, Row, SecondaryButton } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { confirm } from "@/lib/confirm";
import { fitFontSize, formatMoney } from "@/lib/formatters/currency";
import { back, go } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import { splitMethodLabels } from "@/shared/domain";

export default function ExpenseDetailScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { isAuthenticated } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const query = trpc.expenses.get.useQuery({ id: String(id) }, { enabled: isAuthenticated && Boolean(id) });
  const remove = trpc.expenses.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.dashboard.summary.invalidate(), utils.expenses.list.invalidate(), utils.groups.invalidate()]);
      back("/(tabs)/expenses");
    },
  });

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-xl font-black text-foreground">Sign in to see this expense.</Text>
          <View className="mt-5"><PrimaryButton label="Sign in" onPress={() => go(`/(auth)/login?next=${encodeURIComponent(`/expenses/${String(id)}`)}`)} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }
  if (query.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.tint} /></ScreenContainer>;
  const expense = query.data;
  if (!expense) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-xl font-black text-foreground">Expense not found</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">{query.error?.message ?? "It may have been deleted."}</Text>
          <View className="mt-5"><PrimaryButton label="Go back" onPress={() => back()} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }

  const net = expense.myNetMinor;
  const myLine = net > 0 ? `You lent ${formatMoney(net, expense.currency)}` : net < 0 ? `You borrowed ${formatMoney(-net, expense.currency)}` : expense.participants.some((p) => p.isMe) ? "You're settled on this one" : "You're not involved";
  const onDelete = async () => {
    const ok = await confirm("Delete this expense?", `“${expense.description}” will be removed for everyone and balances will update.`, { confirmLabel: "Delete", destructive: true });
    if (ok) remove.mutate({ id: expense.id });
  };

  return (
    <FormScreen
      title={expense.description}
      subtitle={`${expense.category} · ${new Date(expense.occurredAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`}
    >
      <ErrorBanner message={remove.error?.message} />
      <LedgerCard className="border-hero bg-hero">
        <Text className="text-sm font-semibold text-on-hero-muted">Total</Text>
        <Text className="mt-1 font-black text-hero-accent" numberOfLines={1} maxFontSizeMultiplier={1} style={{ fontSize: fitFontSize(formatMoney(expense.amountMinor, expense.currency), Math.min(width, MAX_CONTENT_WIDTH) - 82, 36, 22) }}>{formatMoney(expense.amountMinor, expense.currency)}</Text>
        <Text className="mt-3 text-base font-bold text-on-hero">{myLine}</Text>
        {expense.group ? (
          <Text className="mt-1 text-sm text-on-hero-muted" onPress={() => go(`/groups/${expense.group!.publicId}`)}>in {expense.group.name} ›</Text>
        ) : null}
      </LedgerCard>

      <LedgerCard className="mt-4">
        <Text className="mb-1 text-sm font-bold uppercase tracking-[1px] text-muted">Paid by</Text>
        {expense.payers.map((p) => (
          <Row key={p.userId} title={p.isMe ? "You" : p.name} left={<Avatar name={p.name} url={p.avatarUrl} size={36} />} right={<Text className="text-base font-black text-foreground">{formatMoney(p.amountMinor, expense.currency)}</Text>} />
        ))}
        <Divider />
        <Text className="mb-1 mt-3 text-sm font-bold uppercase tracking-[1px] text-muted">Split {splitMethodLabels[expense.splitMethod].toLowerCase()}</Text>
        {expense.participants.map((p) => (
          <Row
            key={p.userId}
            title={p.isMe ? "You" : p.name}
            subtitle={expense.splitMethod === "percentage" ? `${expense.values[p.userId] ?? 0}%` : expense.splitMethod === "shares" ? `${expense.values[p.userId] ?? 0} share(s)` : undefined}
            left={<Avatar name={p.name} url={p.avatarUrl} size={36} />}
            right={<Text className="text-base font-bold text-foreground">owes {formatMoney(p.amountMinor, expense.currency)}</Text>}
          />
        ))}
      </LedgerCard>

      {expense.note ? (
        <LedgerCard className="mt-4">
          <Text className="text-sm font-bold uppercase tracking-[1px] text-muted">Note</Text>
          <Text className="mt-2 text-base leading-6 text-foreground">{expense.note}</Text>
        </LedgerCard>
      ) : null}

      <Text className="mt-4 text-xs leading-5 text-muted">
        Added by {expense.createdBy.isMe ? "you" : expense.createdBy.name} on {new Date(expense.createdAt).toLocaleString()}
        {expense.updatedAt !== expense.createdAt ? ` · last edited ${new Date(expense.updatedAt).toLocaleString()}` : ""}
      </Text>

      {expense.canEdit ? (
        <View className="mt-5 gap-3">
          <PrimaryButton label="Edit expense" onPress={() => go(`/expenses/edit/${expense.id}`)} />
          <SecondaryButton label="Delete expense" destructive loading={remove.isPending} icon={<IconSymbol name="trash" size={18} color={colors.error} />} onPress={onDelete} />
        </View>
      ) : (
        <View className="mt-5 flex-row items-start gap-2 rounded-2xl bg-primary-soft p-4">
          <IconSymbol name="lock" size={18} color={colors.foreground} />
          <Text className="flex-1 text-sm leading-5 text-foreground">Only {expense.createdBy.name}, who added this expense, can edit or delete it.</Text>
        </View>
      )}
    </FormScreen>
  );
}
