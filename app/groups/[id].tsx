import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ExpenseRow } from "@/components/expense-row";
import { Avatar, Divider, ErrorBanner, MAX_CONTENT_WIDTH, PickerSheet, Row, SecondaryButton, SectionTitle } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { confirm } from "@/lib/confirm";
import { fitFontSize, formatAmounts, formatMoney } from "@/lib/formatters/currency";
import { back, go, replace } from "@/lib/nav";
import { trpc } from "@/lib/trpc";

type Action = "edit" | "add" | "leave" | "delete";

export default function GroupDetailScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);
  const utils = trpc.useUtils();
  const query = trpc.groups.get.useQuery({ id: groupId }, { enabled: isAuthenticated && Boolean(id) });
  const [menu, setMenu] = useState(false);
  const { width } = useWindowDimensions();
  const heroWidth = Math.min(width, MAX_CONTENT_WIDTH) - 82;
  const [showAll, setShowAll] = useState(false);

  const after = async () => Promise.all([utils.groups.invalidate(), utils.dashboard.summary.invalidate(), utils.expenses.list.invalidate()]);
  const removeMember = trpc.groups.removeMember.useMutation({ onSuccess: after });
  const leave = trpc.groups.leave.useMutation({ onSuccess: async () => { await after(); replace("/(tabs)/groups"); } });
  const del = trpc.groups.delete.useMutation({ onSuccess: async () => { await after(); replace("/(tabs)/groups"); } });

  if (!isAuthenticated) return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-xl font-black text-foreground">Sign in to view this group.</Text></LedgerCard></ScreenContainer>;
  if (query.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.tint} /></ScreenContainer>;
  const group = query.data;
  if (!group) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-xl font-black text-foreground">This group is unavailable.</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">It may have been deleted, or you’re no longer a member.</Text>
          <View className="mt-5"><PrimaryButton label="Go back" onPress={() => back("/(tabs)/groups")} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }

  const myBalance = group.myBalances;
  const owed = myBalance.filter((b) => b.amountMinor > 0);
  const owe = myBalance.filter((b) => b.amountMinor < 0);
  const myDebts = group.debts.filter((d) => d.involvesMe);
  const otherDebts = group.debts.filter((d) => !d.involvesMe);
  const expenses = showAll ? group.expenses : group.expenses.slice(0, 15);
  const actionError = removeMember.error?.message ?? leave.error?.message ?? del.error?.message;

  const onAction = async (action: Action) => {
    if (action === "edit") go(`/groups/edit?id=${group.id}`);
    if (action === "add") go(`/groups/add-members?id=${group.id}`);
    if (action === "leave" && (await confirm(`Leave ${group.name}?`, "You'll lose access to this group. You can only leave once your balance here is settled.", { confirmLabel: "Leave", destructive: true }))) leave.mutate({ id: group.id });
    if (action === "delete" && (await confirm(`Delete ${group.name}?`, "The group will be removed for everyone. Everyone must be settled up first.", { confirmLabel: "Delete", destructive: true }))) del.mutate({ id: group.id });
  };
  const onRemove = async (member: { publicId: string; name: string }) => {
    if (await confirm(`Remove ${member.name}?`, "They'll lose access to this group. People can only be removed once their balance is settled.", { confirmLabel: "Remove", destructive: true })) {
      removeMember.mutate({ groupId: group.id, userId: member.publicId });
    }
  };

  const actions: Array<{ key: Action; label: string; sub: string }> = [
    { key: "add", label: "Add people", sub: "Email, invite code or people you know" },
    { key: "edit", label: "Edit group", sub: "Name, type and currency" },
    { key: "leave", label: "Leave group", sub: "Only when you're settled up" },
    ...(group.myRole === "owner" ? [{ key: "delete" as const, label: "Delete group", sub: "Removes it for everyone" }] : []),
  ];

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.tint} colors={[colors.tint]} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}
      >
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" onPress={() => back("/(tabs)/groups")} hitSlop={12} className="flex-row items-center gap-1 py-2 pr-3">
            <IconSymbol name="chevron.left" size={20} color={colors.muted} />
            <Text className="text-sm font-bold text-muted">Groups</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Group options" onPress={() => setMenu(true)} hitSlop={12} className="rounded-full border border-input p-2">
            <IconSymbol name="ellipsis" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View className="mt-2 flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: group.accent }}><IconSymbol name="person.2.fill" size={24} color="#14200F" /></View>
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-3xl font-black text-foreground" numberOfLines={2} maxFontSizeMultiplier={1.3}>{group.name}</Text>
            <Text className="text-sm text-muted">{group.category} · {group.currency} · {group.members.length} {group.members.length === 1 ? "member" : "members"}</Text>
          </View>
        </View>
        {group.description ? <Text className="mt-3 text-base leading-6 text-muted">{group.description}</Text> : null}

        <ErrorBanner message={actionError} />

        <LedgerCard className="mt-5 border-hero bg-hero">
          <Text className="text-sm font-semibold text-on-hero-muted">Your balance in this group</Text>
          {!myBalance.length ? (
            <Text className="mt-2 text-2xl font-black text-hero-accent">You’re all settled up</Text>
          ) : (
            <>
              {owed.length ? <View className="mt-2"><Text className="text-sm font-semibold text-on-hero-muted">You are owed</Text><Text className="font-black text-hero-accent" numberOfLines={1} maxFontSizeMultiplier={1} style={{ fontSize: fitFontSize(formatAmounts(owed), heroWidth, 30, 18) }}>{formatAmounts(owed)}</Text></View> : null}
              {owe.length ? <View className="mt-2"><Text className="text-sm font-semibold text-on-hero-muted">You owe</Text><Text className="font-black text-on-hero" numberOfLines={1} maxFontSizeMultiplier={1} style={{ fontSize: fitFontSize(formatAmounts(owe), heroWidth, 30, 18) }}>{formatAmounts(owe)}</Text></View> : null}
            </>
          )}
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1"><PrimaryButton label="Add expense" onPress={() => go(`/expenses/new?groupId=${group.id}`)} /></View>
            <Pressable accessibilityRole="button" onPress={() => go(`/settlements/new?groupId=${group.id}`)} className="items-center justify-center rounded-[18px] bg-hero-tile px-4">
              <Text className="text-base font-bold text-on-hero">Settle up</Text>
            </Pressable>
          </View>
        </LedgerCard>

        {group.members.length < 2 ? (
          <LedgerCard className="mt-4">
            <Text className="text-lg font-black text-foreground">It’s just you so far</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Add friends by email or share an invite code so you can split expenses with them.</Text>
            <View className="mt-4"><PrimaryButton label="Add people" onPress={() => go(`/groups/add-members?id=${group.id}`)} /></View>
          </LedgerCard>
        ) : null}

        {group.debts.length ? (
          <>
            <SectionTitle>Who owes whom</SectionTitle>
            <LedgerCard className="py-1">
              {[...myDebts, ...otherDebts].map((debt, index) => (
                <View key={`${debt.fromId}-${debt.toId}-${debt.currency}`} className={`flex-row items-center gap-3 py-3 ${index ? "border-t border-border" : ""}`}>
                  <Text className="flex-1 text-base text-foreground">
                    <Text className="font-bold">{debt.fromName}</Text> {debt.fromName === "You" ? "owe" : "owes"} <Text className="font-bold">{debt.toName}</Text>
                  </Text>
                  <Text className="text-base font-black" style={{ color: debt.fromName === "You" ? colors.error : debt.toName === "You" ? colors.success : colors.foreground }}>{formatMoney(debt.amountMinor, debt.currency)}</Text>
                  {debt.involvesMe ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Record this payment"
                      onPress={() => go(`/settlements/new?groupId=${group.id}&from=${debt.fromId}&to=${debt.toId}&amount=${debt.amountMinor}&currency=${debt.currency}`)}
                      className="rounded-xl bg-primary px-3 py-2"
                    >
                      <Text className="text-xs font-black text-on-primary">Settle</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </LedgerCard>
          </>
        ) : null}

        <SectionTitle action={{ label: "Add people", onPress: () => go(`/groups/add-members?id=${group.id}`) }}>Members</SectionTitle>
        <LedgerCard className="py-1">
          {group.members.map((member, index) => {
            const positive = member.balances.filter((b) => b.amountMinor > 0);
            const negative = member.balances.filter((b) => b.amountMinor < 0);
            const status = !member.balances.length ? "settled up" : positive.length ? `gets back ${formatAmounts(positive)}` : `owes ${formatAmounts(negative)}`;
            const canRemove = group.canManage && !member.isMe && member.role !== "owner";
            return (
              <View key={member.publicId}>
                {index ? <Divider /> : null}
                <Row
                  title={member.isMe ? `${member.name} (you)` : member.name}
                  subtitle={`${member.role === "member" ? "" : `${member.role} · `}${status}`}
                  left={<Avatar name={member.name} url={member.avatarUrl} size={38} />}
                  right={canRemove ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${member.name}`} onPress={() => void onRemove(member)} hitSlop={10} className="p-1">
                      <IconSymbol name="person.badge.minus" size={20} color={colors.muted} />
                    </Pressable>
                  ) : <View />}
                />
              </View>
            );
          })}
          {group.pendingInvites.map((invite) => (
            <View key={invite.id}>
              <Divider />
              <Row title={invite.email} subtitle="Invited · joins when they sign in" left={<View className="h-[38px] w-[38px] items-center justify-center rounded-full border border-dashed border-input"><IconSymbol name="envelope" size={18} color={colors.muted} /></View>} />
            </View>
          ))}
        </LedgerCard>

        <SectionTitle>Expenses</SectionTitle>
        {group.expenses.length ? (
          <LedgerCard className="py-1">
            {expenses.map((expense) => <ExpenseRow key={expense.id} item={expense} />)}
            {group.expenses.length > expenses.length ? (
              <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} className="items-center py-3"><Text className="text-sm font-bold text-muted underline">Show all {group.expenses.length}</Text></Pressable>
            ) : null}
          </LedgerCard>
        ) : (
          <LedgerCard>
            <Text className="text-base font-bold text-foreground">No expenses yet</Text>
            <Text className="mt-1 text-sm leading-5 text-muted">Add the first one and everyone’s share is worked out automatically.</Text>
          </LedgerCard>
        )}

        <View className="mt-6 gap-3">
          <SecondaryButton label="Group options" icon={<IconSymbol name="ellipsis" size={18} color={colors.foreground} />} onPress={() => setMenu(true)} />
        </View>
      </ScrollView>

      <PickerSheet
        visible={menu}
        title="Group options"
        items={actions}
        keyOf={(a) => a.key}
        labelOf={(a) => a.label}
        sublabelOf={(a) => a.sub}
        leftOf={(a) => <IconSymbol name={a.key === "add" ? "person.badge.plus" : a.key === "edit" ? "pencil" : a.key === "leave" ? "rectangle.portrait.and.arrow.right" : "trash"} size={22} color={a.key === "delete" || a.key === "leave" ? colors.error : colors.foreground} />}
        onSelect={(a) => setTimeout(() => void onAction(a.key), 350)}
        onClose={() => setMenu(false)}
      />
    </ScreenContainer>
  );
}
