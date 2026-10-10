import { useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Avatar, CurrencyPicker, Divider, ErrorBanner, Field, FormScreen, Label, Row, SecondaryButton, Segmented, SwitchRow } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { confirm, showMessage } from "@/lib/confirm";
import { shareText } from "@/lib/share";
import { useThemeContext, type ThemePreference } from "@/lib/theme-provider";
import { trpc } from "@/lib/trpc";
import { apiUrl } from "@/constants/config";
import * as Linking from "expo-linking";

/** Opens a public page on the API server (privacy policy etc.) in the browser. */
function openPage(path: string) {
  try {
    void Linking.openURL(apiUrl(path));
  } catch {
    showMessage("Not available", "The server address isn't configured in this build.");
  }
}
import type { NotificationPreferenceKey } from "@/shared/domain";

const alertRows: Array<{ key: NotificationPreferenceKey; title: string; subtitle: string }> = [
  { key: "expenseAlerts", title: "Expenses", subtitle: "When someone adds, edits or deletes an expense with you" },
  { key: "groupAlerts", title: "Groups", subtitle: "When you're added to a group or someone joins" },
  { key: "settlementAlerts", title: "Payments", subtitle: "When someone pays you or confirms your payment" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-2 px-1 text-xs font-bold uppercase tracking-[1.5px] text-muted">{title}</Text>
      <LedgerCard className="py-2">{children}</LedgerCard>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const { preference, setPreference } = useThemeContext();
  const { user, isAuthenticated, refresh, logout } = useAuth();
  const utils = trpc.useUtils();
  const settings = trpc.account.settings.useQuery(undefined, { enabled: isAuthenticated });
  const [nameDraft, setName] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const afterProfile = async (note: string) => {
    await Promise.all([utils.account.settings.invalidate(), utils.dashboard.summary.invalidate(), refresh()]);
    setSavedNote(note);
    setTimeout(() => setSavedNote(null), 2500);
  };
  const updateProfile = trpc.account.updateProfile.useMutation();
  const updateNotifications = trpc.account.updateNotifications.useMutation({
    onMutate: async (patch) => {
      await utils.account.settings.cancel();
      const previous = utils.account.settings.getData();
      if (previous) utils.account.settings.setData(undefined, { ...previous, notifications: { ...previous.notifications, ...patch } as typeof previous.notifications });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) utils.account.settings.setData(undefined, context.previous);
    },
    onSettled: () => utils.account.settings.invalidate(),
  });
  const deleteAccount = trpc.account.delete.useMutation({
    onSuccess: async () => {
      await logout();
      router.replace("/(auth)/login");
    },
  });

  const themeOptions: Array<{ value: ThemePreference; label: string }> = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  if (!isAuthenticated) {
    return (
      <FormScreen title="Settings">
        <Section title="Appearance">
          <View className="py-2"><Segmented options={themeOptions} value={preference} onChange={setPreference} /></View>
        </Section>
        <View className="mt-6"><PrimaryButton label="Sign in for more settings" onPress={() => router.push("/(auth)/login")} /></View>
      </FormScreen>
    );
  }
  if (settings.isLoading) return <ScreenContainer className="items-center justify-center"><ActivityIndicator color={colors.tint} /></ScreenContainer>;
  const data = settings.data;
  const prefs = data?.notifications;
  const name = nameDraft ?? data?.name ?? "";
  const nameChanged = name.trim() && name.trim() !== (data?.name ?? "");
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const onDelete = async () => {
    const first = await confirm("Delete your account?", "Your name, email and photo are erased and you leave all groups. Expenses you were part of stay (shown as “Deleted user”) so your friends' balances remain correct. This can't be undone.", { confirmLabel: "Continue", destructive: true });
    if (!first) return;
    const second = await confirm("Are you absolutely sure?", "Make sure you've settled up with everyone first.", { confirmLabel: "Delete my account", destructive: true });
    if (second) deleteAccount.mutate({ confirm: "DELETE" });
  };

  return (
    <FormScreen title="Settings" subtitle="Make Split Daily work the way you share money.">
      <ErrorBanner message={settings.error?.message ?? updateProfile.error?.message ?? updateNotifications.error?.message ?? deleteAccount.error?.message} />
      {savedNote ? (
        <View className="mb-2 flex-row items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3">
          <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
          <Text className="text-sm font-bold text-foreground">{savedNote}</Text>
        </View>
      ) : null}

      <Section title="Profile">
        <View className="flex-row items-center gap-4 py-2">
          <Avatar name={data?.name ?? user?.email ?? "?"} url={data?.avatarUrl} size={56} />
          <View className="flex-1">
            <Text className="text-lg font-black text-foreground" numberOfLines={1}>{data?.name ?? "Your name"}</Text>
            <Text className="text-sm text-muted" numberOfLines={1}>{data?.email ?? "No email"}</Text>
            <Text className="mt-0.5 text-xs text-muted">Signed in with Google</Text>
          </View>
        </View>
        <Divider />
        <View className="pt-3">
          <Field label="Display name" hint="What friends see" value={name} onChangeText={setName} placeholder="Your name" maxLength={160} returnKeyType="done" />
          {nameChanged ? (
            <View className="mb-3">
              <PrimaryButton label="Save name" loading={updateProfile.isPending} onPress={() => updateProfile.mutate({ name: name.trim() }, { onSuccess: () => { setName(null); void afterProfile("Name saved"); } })} />
            </View>
          ) : null}
        </View>
      </Section>

      <Section title="Currency">
        <View className="py-2">
          <Label hint="Used for your home balance and new expenses">Default currency</Label>
          {data ? (
            <CurrencyPicker value={data.defaultCurrency} onChange={(c) => updateProfile.mutate({ defaultCurrency: c }, { onSuccess: () => void afterProfile(`Default currency set to ${c}`) })} />
          ) : null}
          <Text className="mt-2 text-xs leading-5 text-muted">Each expense keeps the currency it was added in, and balances are shown per currency — nothing is converted behind your back.</Text>
        </View>
      </Section>

      <Section title="Appearance">
        <View className="py-2">
          <Segmented options={themeOptions} value={preference} onChange={setPreference} />
          <Text className="mt-2 text-xs text-muted">System follows your phone’s light or dark mode.</Text>
        </View>
      </Section>

      <Section title="Notifications">
        {prefs ? (
          <>
            <SwitchRow title="In-app notifications" subtitle="Show updates in the Activity tab" value={prefs.inAppEnabled} onChange={(v) => updateNotifications.mutate({ inAppEnabled: v })} />
            {alertRows.map((row) => (
              <View key={row.key}>
                <Divider />
                <SwitchRow title={row.title} subtitle={row.subtitle} value={prefs[row.key]} disabled={!prefs.inAppEnabled} onChange={(v) => updateNotifications.mutate({ [row.key]: v })} />
              </View>
            ))}
          </>
        ) : null}
      </Section>

      <Section title="Share">
        <Row
          title="Invite friends to Split Daily"
          subtitle="Send a message with how to get started"
          left={<IconSymbol name="square.and.arrow.up" size={22} color={colors.foreground} />}
          onPress={async () => {
            const ok = await shareText("I'm using Split Daily to split bills and trips. Sign in with Google and join my group — I'll send you the invite code!");
            if (!ok) showMessage("Sharing isn't available", "Copy the app link from your browser instead.");
          }}
        />
        <Divider />
        <Row title="Join a group with a code" left={<IconSymbol name="person.badge.plus" size={22} color={colors.foreground} />} onPress={() => router.push("/groups/join")} />
      </Section>

      <Section title="About">
        <Row title="Version" right={<Text className="text-sm font-semibold text-muted">{version}{Platform.OS !== "web" ? ` · ${Platform.OS}` : ""}</Text>} left={<IconSymbol name="info.circle" size={22} color={colors.foreground} />} />
        <Divider />
        <Row title="Privacy policy" subtitle="We only receive your name, email and photo from Google. We never see your Google password." left={<IconSymbol name="lock" size={22} color={colors.foreground} />} onPress={() => openPage("/privacy")} />
        {data?.memberSince ? (
          <>
            <Divider />
            <Row title="Member since" right={<Text className="text-sm font-semibold text-muted">{new Date(data.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</Text>} left={<IconSymbol name="calendar" size={22} color={colors.foreground} />} />
          </>
        ) : null}
      </Section>

      <View className="mt-8 gap-3">
        <SecondaryButton label="Sign out" icon={<IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={colors.foreground} />} onPress={async () => { if (await confirm("Sign out?", "You can sign back in with Google any time.", { confirmLabel: "Sign out" })) { await logout(); router.replace("/(tabs)"); } }} />
        <SecondaryButton label="Delete account" destructive loading={deleteAccount.isPending} icon={<IconSymbol name="trash" size={18} color={colors.error} />} onPress={() => void onDelete()} />
      </View>
    </FormScreen>
  );
}
