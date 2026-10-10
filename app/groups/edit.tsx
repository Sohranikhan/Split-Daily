import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { GroupForm } from "@/components/group-form";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useColors } from "@/hooks/use-colors";
import { back } from "@/lib/nav";
import { trpc } from "@/lib/trpc";

export default function EditGroupScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = trpc.groups.get.useQuery({ id: String(id) }, { enabled: Boolean(id) });
  if (query.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.tint} /></ScreenContainer>;
  if (!query.data) return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-xl font-black text-foreground">Group not found</Text><View className="mt-5"><PrimaryButton label="Go back" onPress={() => back()} /></View></LedgerCard></ScreenContainer>;
  const g = query.data;
  return <GroupForm initial={{ id: g.id, name: g.name, description: g.description, category: g.category, currency: g.currency }} />;
}
