import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { Avatar, Chip, CurrencyPicker, Divider, ErrorBanner, Field, FormScreen, Label, PickerSheet, Row, Segmented } from "@/components/ui/form";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { amountToInput, formatMoney, parseAmount } from "@/lib/formatters/currency";
import { replace } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import { currencyInfo, paymentMethods, toCurrencyCode, type CurrencyCode } from "@/shared/domain";

type Direction = "paid" | "received";
type Person = { id: string; name: string; avatarUrl: string | null };

export default function SettleUpScreen() {
  const colors = useColors();
  const { user, isAuthenticated } = useAuth();
  const params = useLocalSearchParams<{ groupId?: string; from?: string; to?: string; amount?: string; currency?: string }>();
  const myId = user?.publicId ?? "";
  const utils = trpc.useUtils();

  const [groupId, setGroupId] = useState<string | null>(params.groupId ? String(params.groupId) : null);
  const initialOther = params.from && params.to ? (params.from === myId ? params.to : params.from) : null;
  const [direction, setDirection] = useState<Direction>(params.to && params.to === myId ? "received" : "paid");
  const [otherId, setOtherId] = useState<string | null>(initialOther ? String(initialOther) : null);
  const [amountText, setAmountText] = useState(params.amount ? amountToInput(Number(params.amount)) : "");
  const [currencyChoice, setCurrency] = useState<CurrencyCode | null>(params.currency ? toCurrencyCode(String(params.currency)) : null);
  const [method, setMethod] = useState<string>("Cash");
  const [note, setNote] = useState("");
  const [pickPerson, setPickPerson] = useState(false);
  const [pickGroup, setPickGroup] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const groupsQuery = trpc.groups.list.useQuery(undefined, { enabled: isAuthenticated });
  const groupQuery = trpc.groups.get.useQuery({ id: groupId ?? "" }, { enabled: isAuthenticated && Boolean(groupId) });
  const contactsQuery = trpc.groups.contacts.useQuery(undefined, { enabled: isAuthenticated && !groupId });
  const dashboardQuery = trpc.dashboard.summary.useQuery(undefined, { enabled: isAuthenticated && !groupId });

  const currency: CurrencyCode = currencyChoice ?? (groupId && groupQuery.data ? groupQuery.data.currency : toCurrencyCode(user?.defaultCurrency));
  const people: Person[] = useMemo(() => {
    if (groupId) return (groupQuery.data?.members ?? []).filter((m) => !m.isMe).map((m) => ({ id: m.publicId, name: m.name, avatarUrl: m.avatarUrl }));
    return (contactsQuery.data ?? []).map((c) => ({ id: c.publicId, name: c.name, avatarUrl: c.avatarUrl }));
  }, [groupId, groupQuery.data, contactsQuery.data]);
  const other = people.find((p) => p.id === otherId) ?? null;

  // What you and this person owe each other right now (positive = they owe you).
  const suggestions = useMemo(() => {
    if (!otherId) return [];
    if (groupId) {
      return (groupQuery.data?.debts ?? [])
        .filter((d) => (d.fromId === myId && d.toId === otherId) || (d.toId === myId && d.fromId === otherId))
        .map((d) => ({ currency: d.currency, amountMinor: d.toId === myId ? d.amountMinor : -d.amountMinor }));
    }
    return dashboardQuery.data?.people.find((p) => p.userId === otherId)?.balances ?? [];
  }, [otherId, groupId, groupQuery.data, dashboardQuery.data, myId]);

  // What `id` and you owe each other right now (positive = they owe you), from data already loaded.
  const balancesWith = (id: string) => {
    if (groupId) {
      return (groupQuery.data?.debts ?? [])
        .filter((d) => (d.fromId === myId && d.toId === id) || (d.toId === myId && d.fromId === id))
        .map((d) => ({ currency: d.currency, amountMinor: d.toId === myId ? d.amountMinor : -d.amountMinor }));
    }
    return dashboardQuery.data?.people.find((p) => p.userId === id)?.balances ?? [];
  };
  const applySuggestion = (s: { currency: CurrencyCode; amountMinor: number }) => {
    setCurrency(s.currency);
    setDirection(s.amountMinor > 0 ? "received" : "paid");
    setAmountText(amountToInput(Math.abs(s.amountMinor)));
  };
  const choosePerson = (id: string) => {
    setOtherId(id);
    const first = balancesWith(id)[0];
    if (first) applySuggestion(first);
    else setAmountText("");
  };

  const create = trpc.settlements.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.dashboard.summary.invalidate(), utils.groups.invalidate(), utils.settlements.list.invalidate()]);
      replace(groupId ? `/groups/${groupId}` : "/(tabs)/activity");
    },
  });

  if (!isAuthenticated || !user) return <ScreenContainer className="justify-center p-6"><LedgerCard><Text className="text-xl font-black text-foreground">Sign in to settle up.</Text><View className="mt-5"><PrimaryButton label="Sign in" onPress={() => router.push("/(auth)/login")} /></View></LedgerCard></ScreenContainer>;

  const amountMinor = parseAmount(amountText);
  const validAmount = Number.isFinite(amountMinor) && amountMinor > 0;
  const problem = !other ? "Choose who you're settling with" : !validAmount ? "Enter the amount" : null;
  const save = () => {
    setSubmitted(true);
    if (problem || !other) return;
    create.mutate({
      payerId: direction === "paid" ? myId : other.id,
      receiverId: direction === "paid" ? other.id : myId,
      amountMinor,
      currency,
      groupId: groupId ?? undefined,
      paymentMethod: method,
      note: note.trim() || undefined,
    });
  };
  const groupName = groupId ? groupQuery.data?.name ?? "Group" : "No group (overall balance)";

  return (
    <FormScreen
      title="Settle up"
      subtitle="Record money that changed hands. Balances update straight away."
      footer={
        <View>
          {submitted && problem ? <Text className="mb-2 text-center text-sm font-semibold text-error">{problem}</Text> : null}
          <PrimaryButton label="Record payment" loading={create.isPending} onPress={save} />
        </View>
      }
    >
      <ErrorBanner message={create.error?.message} />
      <LedgerCard>
        <Row title={groupName} subtitle="Where this payment belongs" left={<View className="h-10 w-10 items-center justify-center rounded-xl bg-primary"><IconSymbol name="person.2.fill" size={20} color={colors.onPrimary} /></View>} onPress={() => setPickGroup(true)} />
        <Divider />
        <View className="mt-3">
          <Segmented value={direction} onChange={setDirection} options={[{ value: "paid", label: "I paid" }, { value: "received", label: "I received" }]} />
        </View>
        <Row
          title={other ? (direction === "paid" ? `You paid ${other.name}` : `${other.name} paid you`) : "Choose a person"}
          subtitle={people.length ? undefined : groupId ? "No one else is in this group yet" : "Add people to a group first"}
          left={other ? <Avatar name={other.name} url={other.avatarUrl} size={40} /> : <View className="h-10 w-10 items-center justify-center rounded-full border border-dashed border-input"><IconSymbol name="plus" size={20} color={colors.muted} /></View>}
          onPress={() => setPickPerson(true)}
        />
        {suggestions.length ? (
          <View className="mb-1 flex-row flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip
                key={s.currency}
                label={`${s.amountMinor > 0 ? "They owe you" : "You owe"} ${formatMoney(Math.abs(s.amountMinor), s.currency)}`}
                onPress={() => applySuggestion(s)}
              />
            ))}
          </View>
        ) : other ? <Text className="mb-1 text-xs text-muted">You’re settled up with {other.name}{groupId ? " in this group" : ""}.</Text> : null}
      </LedgerCard>

      <LedgerCard className="mt-4">
        <Label>Amount</Label>
        <View className="flex-row items-center gap-3">
          <CurrencyPicker compact value={currency} onChange={setCurrency} />
          <Text className="text-2xl font-black text-muted">{currencyInfo[currency].symbol}</Text>
          <TextInput
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.,\s]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            accessibilityLabel="Amount"
            maxFontSizeMultiplier={1}
            style={{ flex: 1, minWidth: 0, fontSize: amountText.length > 9 ? 26 : 34, fontWeight: "900", color: colors.foreground, paddingVertical: 4 }}
          />
        </View>
        <View className="mt-4">
          <Label>Paid with</Label>
          <View className="flex-row flex-wrap gap-2">
            {paymentMethods.map((m) => <Chip key={m} label={m} selected={method === m} onPress={() => setMethod(m)} />)}
          </View>
        </View>
        <Field containerClassName="mt-4 mb-0" label="Note" hint="Optional" value={note} onChangeText={setNote} placeholder="e.g. Sent via JazzCash" maxLength={500} />
      </LedgerCard>
      {direction === "paid" ? (
        <Text className="mt-3 text-xs leading-5 text-muted">{other?.name ?? "They"} will be asked to confirm they received it.</Text>
      ) : null}

      <PickerSheet
        visible={pickPerson}
        title={direction === "paid" ? "Who did you pay?" : "Who paid you?"}
        items={people}
        keyOf={(p) => p.id}
        labelOf={(p) => p.name}
        leftOf={(p) => <Avatar name={p.name} url={p.avatarUrl} size={36} />}
        selectedKey={otherId}
        onSelect={(p) => choosePerson(p.id)}
        onClose={() => setPickPerson(false)}
      />
      <PickerSheet
        visible={pickGroup}
        title="Which group?"
        items={[{ id: "", name: "No group (overall balance)", memberCount: 0 }, ...(groupsQuery.data ?? []).map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))]}
        keyOf={(g) => g.id || "none"}
        labelOf={(g) => g.name}
        sublabelOf={(g) => (g.id ? `${g.memberCount} members` : undefined)}
        selectedKey={groupId ?? "none"}
        onSelect={(g) => { setGroupId(g.id || null); setOtherId(null); setAmountText(""); }}
        onClose={() => setPickGroup(false)}
      />
    </FormScreen>
  );
}
