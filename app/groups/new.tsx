import { Text, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { GroupForm } from "@/components/group-form";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";

export default function NewGroupScreen() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-xl font-black text-foreground">Sign in to create a group.</Text><View className="mt-5"><PrimaryButton label="Sign in" onPress={() => router.push("/(auth)/login")} /></View></LedgerCard></ScreenContainer>;
  return <GroupForm />;
}
