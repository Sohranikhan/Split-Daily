import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ExpenseForm } from "@/components/expense-form";
import { useAuth } from "@/hooks/use-auth";

export default function NewExpenseScreen() {
  const { user, isAuthenticated } = useAuth();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  if (!isAuthenticated || !user) {
    return (
      <ScreenContainer className="justify-center p-6">
        <LedgerCard>
          <Text className="text-xl font-black text-foreground">Sign in to add an expense.</Text>
          <View className="mt-5"><PrimaryButton label="Sign in" onPress={() => router.push("/(auth)/login")} /></View>
        </LedgerCard>
      </ScreenContainer>
    );
  }
  return <ExpenseForm presetGroupId={typeof groupId === "string" && groupId ? groupId : undefined} />;
}
