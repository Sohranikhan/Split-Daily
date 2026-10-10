import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ErrorBanner, FormScreen } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { go, replace } from "@/lib/nav";
import { trpc } from "@/lib/trpc";

/** Opened from an invite link (ledgerly://join/CODE or https://<web>/join/CODE) or the "Join with code" screen. */
export default function JoinGroupScreen() {
  const colors = useColors();
  const { isAuthenticated, loading } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const cleaned = String(code ?? "").trim().toUpperCase();
  const utils = trpc.useUtils();
  const preview = trpc.groups.previewInvite.useQuery({ code: cleaned }, { enabled: isAuthenticated && cleaned.length >= 4, retry: false });
  const join = trpc.groups.join.useMutation({
    onSuccess: async (data) => {
      await Promise.all([utils.groups.invalidate(), utils.dashboard.summary.invalidate()]);
      replace(`/groups/${data.groupId}`);
    },
  });

  if (loading) return <FormScreen title="Join group"><ActivityIndicator color={colors.tint} /></FormScreen>;
  if (!isAuthenticated) {
    return (
      <FormScreen title="Join group" subtitle={`Invite code ${cleaned}`}>
        <LedgerCard>
          <Text className="text-lg font-black text-foreground">Sign in first</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">Sign in with Google, then you’ll come straight back here to join.</Text>
          <View className="mt-4"><PrimaryButton label="Sign in with Google" onPress={() => go(`/(auth)/login?next=${encodeURIComponent(`/join/${cleaned}`)}`)} /></View>
        </LedgerCard>
      </FormScreen>
    );
  }

  const data = preview.data;
  return (
    <FormScreen title="Join group" subtitle={`Invite code ${cleaned}`}>
      <ErrorBanner message={join.error?.message} />
      {preview.isLoading ? <ActivityIndicator color={colors.tint} /> : !data ? (
        <LedgerCard>
          <Text className="text-lg font-black text-foreground">Invite not found</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">{preview.error?.message ?? "Check the code and try again."}</Text>
          <View className="mt-4"><PrimaryButton label="Enter a different code" onPress={() => replace("/groups/join")} /></View>
        </LedgerCard>
      ) : (
        <LedgerCard>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-primary"><IconSymbol name="person.2.fill" size={24} color={colors.onPrimary} /></View>
          <Text className="mt-4 text-2xl font-black text-foreground">{data.name}</Text>
          <Text className="mt-1 text-sm text-muted">{data.category} · {data.memberCount} {data.memberCount === 1 ? "member" : "members"} · invited by {data.inviterName}</Text>
          <View className="mt-5">
            {data.alreadyMember ? (
              <PrimaryButton label="You're already in — open group" onPress={() => replace(`/groups/${data.groupId}`)} />
            ) : (
              <PrimaryButton label="Join group" loading={join.isPending} onPress={() => join.mutate({ code: cleaned })} />
            )}
          </View>
        </LedgerCard>
      )}
    </FormScreen>
  );
}
