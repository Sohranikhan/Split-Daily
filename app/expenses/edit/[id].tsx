import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ExpenseForm } from "@/components/expense-form";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { back, go } from "@/lib/nav";

export default function EditExpenseScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = trpc.expenses.get.useQuery({ id: String(id) }, { enabled: isAuthenticated && Boolean(id) });

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-xl font-black text-foreground">Sign in to edit expenses.</Text>
          <View className="mt-5"><PrimaryButton label="Sign in" onPress={() => go("/(auth)/login")} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }
  if (query.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.tint} /></ScreenContainer>;
  const expense = query.data;
  if (!expense || !expense.canEdit) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-xl font-black text-foreground">{expense ? "You can't edit this expense" : "Expense not found"}</Text>
          <Text className="mt-2 text-sm leading-5 text-muted">
            {expense ? `Only ${expense.createdBy.name}, who added it, can change or delete it. Ask them to fix it, or add a correcting expense.` : query.error?.message ?? "It may have been deleted."}
          </Text>
          <View className="mt-5"><PrimaryButton label="Go back" onPress={() => back()} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }
  return (
    <ExpenseForm
      initial={{
        id: expense.id,
        description: expense.description,
        amountMinor: expense.amountMinor,
        currency: expense.currency,
        category: expense.category,
        splitMethod: expense.splitMethod,
        note: expense.note,
        occurredAt: expense.occurredAt,
        group: expense.group,
        payers: expense.payers.map((p) => ({ userId: p.userId, amountMinor: p.amountMinor })),
        participants: expense.participants.map((p) => ({ userId: p.userId, name: p.name, avatarUrl: p.avatarUrl, isMe: p.isMe, amountMinor: p.amountMinor })),
        values: expense.values,
      }}
    />
  );
}
