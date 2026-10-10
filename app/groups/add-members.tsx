import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Avatar, Chip, ErrorBanner, Field, FormScreen, Label, Row, SecondaryButton } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useColors } from "@/hooks/use-colors";
import { showMessage } from "@/lib/confirm";
import { replace } from "@/lib/nav";
import { inviteMessage, shareText } from "@/lib/share";
import { trpc } from "@/lib/trpc";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddMembersScreen() {
  const colors = useColors();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const groupId = String(id);
  const utils = trpc.useUtils();
  const groupQuery = trpc.groups.get.useQuery({ id: groupId }, { enabled: Boolean(id) });
  const contactsQuery = trpc.groups.contacts.useQuery();
  const [emailText, setEmailText] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const inviteLink = trpc.groups.inviteLink.useMutation();
  const add = trpc.groups.addMembers.useMutation({
    onSuccess: async (data) => {
      await Promise.all([utils.groups.invalidate(), utils.dashboard.summary.invalidate()]);
      const parts: string[] = [];
      if (data.added.length) parts.push(`Added ${data.added.join(", ")}.`);
      if (data.invited.length) parts.push(`Invited ${data.invited.join(", ")} — they'll join automatically when they sign in with that email. Share the invite code with them too.`);
      if (data.alreadyMembers.length) parts.push(`${data.alreadyMembers.join(", ")} ${data.alreadyMembers.length === 1 ? "is" : "are"} already in the group.`);
      setResult(parts.join(" "));
      setEmails([]);
      setPicked([]);
    },
  });

  const memberIds = useMemo(() => new Set((groupQuery.data?.members ?? []).map((m) => m.publicId)), [groupQuery.data]);
  const suggestions = (contactsQuery.data ?? []).filter((c) => !memberIds.has(c.publicId));

  const addEmail = () => {
    const parts = emailText.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    const bad = parts.filter((e) => !EMAIL.test(e));
    if (bad.length) {
      setEmailError(`“${bad[0]}” isn't a valid email address.`);
      return;
    }
    setEmailError(null);
    setEmails((list) => [...new Set([...list, ...parts])]);
    setEmailText("");
  };

  const share = async () => {
    const link = await inviteLink.mutateAsync({ id: groupId });
    const ok = await shareText(inviteMessage(link.code, link.groupName));
    if (!ok) showMessage("Invite code", `Share this code: ${link.code}`);
  };

  const pending = emails.length + picked.length;
  const group = groupQuery.data;

  return (
    <FormScreen
      title="Add people"
      subtitle={group ? `to ${group.name}` : undefined}
      backLabel={fresh ? "Skip" : "Back"}
      onBack={() => replace(`/groups/${groupId}`)}
      footer={
        pending ? (
          <PrimaryButton label={`Add ${pending} ${pending === 1 ? "person" : "people"}`} loading={add.isPending} onPress={() => add.mutate({ groupId, emails, userIds: picked })} />
        ) : (
          <PrimaryButton label={fresh ? "Done — open group" : "Done"} onPress={() => replace(`/groups/${groupId}`)} />
        )
      }
    >
      <ErrorBanner message={add.error?.message ?? inviteLink.error?.message} />
      {result ? (
        <View className="mb-4 flex-row items-start gap-2 rounded-2xl bg-primary-soft p-4">
          <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
          <Text className="flex-1 text-sm leading-5 text-foreground">{result}</Text>
        </View>
      ) : null}

      <LedgerCard>
        <Text className="text-lg font-black text-foreground">Share an invite</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">Send a code on WhatsApp or anywhere. Anyone with it can join after signing in with Google.</Text>
        <View className="mt-4">
          <SecondaryButton label="Share invite code" loading={inviteLink.isPending} icon={<IconSymbol name="square.and.arrow.up" size={18} color={colors.foreground} />} onPress={() => void share()} />
        </View>
        {inviteLink.data ? (
          <View className="mt-3 items-center rounded-2xl border border-dashed border-input p-3">
            <Text className="text-xs font-bold uppercase tracking-[1px] text-muted">Invite code</Text>
            <Text selectable className="mt-1 text-2xl font-black tracking-[4px] text-foreground">{inviteLink.data.code}</Text>
          </View>
        ) : null}
      </LedgerCard>

      <LedgerCard className="mt-4">
        <Text className="text-lg font-black text-foreground">Add by email</Text>
        <Text className="mt-1 text-sm leading-5 text-muted">If they already use Split Daily they’re added right away. If not, they join automatically when they sign in with that Google email.</Text>
        <View className="mt-4 flex-row items-start gap-2">
          <Field
            containerClassName="mb-0 flex-1"
            value={emailText}
            onChangeText={(t) => { setEmailText(t); setEmailError(null); }}
            placeholder="friend@gmail.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={addEmail}
            error={emailError}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Add email" onPress={addEmail} className="items-center justify-center rounded-2xl bg-primary" style={{ width: 50, height: 50 }}>
            <IconSymbol name="plus" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
        {emails.length ? (
          <View className="mt-3 flex-row flex-wrap gap-2">
            {emails.map((e) => <Chip key={e} label={`${e}  ✕`} selected onPress={() => setEmails((list) => list.filter((x) => x !== e))} />)}
          </View>
        ) : null}
      </LedgerCard>

      <LedgerCard className="mt-4">
        <Label hint="From your other groups">People you know</Label>
        {contactsQuery.isLoading ? <ActivityIndicator color={colors.tint} /> : suggestions.length ? (
          suggestions.map((person) => {
            const on = picked.includes(person.publicId);
            return (
              <Row
                key={person.publicId}
                title={person.name}
                subtitle={person.email}
                left={<Avatar name={person.name} url={person.avatarUrl} size={38} />}
                right={<IconSymbol name={on ? "checkmark.circle.fill" : "plus"} size={22} color={on ? colors.success : colors.muted} />}
                onPress={() => setPicked((list) => (on ? list.filter((x) => x !== person.publicId) : [...list, person.publicId]))}
              />
            );
          })
        ) : (
          <Text className="text-sm leading-5 text-muted">People from your other groups will show up here for one-tap adding.</Text>
        )}
      </LedgerCard>

      {group?.pendingInvites.length ? (
        <LedgerCard className="mt-4">
          <Label>Waiting to join</Label>
          {group.pendingInvites.map((invite) => (
            <Row key={invite.id} title={invite.email} subtitle={`Code ${invite.code}`} left={<IconSymbol name="envelope" size={22} color={colors.muted} />} />
          ))}
        </LedgerCard>
      ) : null}
    </FormScreen>
  );
}
