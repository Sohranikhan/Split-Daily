import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { MAX_CONTENT_WIDTH, FormScreen, Avatar, Chip, CurrencyPicker, ErrorBanner, Field, Label, PickerSheet, Row, Segmented, Divider } from "@/components/ui/form";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { replace } from "@/lib/nav";
import { calculateSplit, SplitValidationError } from "@/lib/finance/split-engine";
import { amountToInput, fitFontSize, formatMoney, parseAmount } from "@/lib/formatters/currency";
import { currencyInfo, expenseCategories, splitMethodLabels, toCurrencyCode, type CurrencyCode, type SplitMethod } from "@/shared/domain";

type Person = { id: string; name: string; avatarUrl: string | null; isMe: boolean; avatarName?: string };

export type ExpenseInitial = {
  id: string;
  description: string;
  amountMinor: number;
  currency: CurrencyCode;
  category: string;
  splitMethod: SplitMethod;
  note: string | null;
  occurredAt: string;
  group: { publicId: string; name: string } | null;
  payers: { userId: string; amountMinor: number }[];
  participants: { userId: string; name: string; avatarUrl: string | null; isMe: boolean; amountMinor: number }[];
  values: Record<string, number>;
};

const methods: SplitMethod[] = ["equal", "exact", "percentage", "shares"];

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0); // midday avoids timezone edge cases when only the date matters
  return d;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function ExpenseForm({ initial, presetGroupId }: { initial?: ExpenseInitial; presetGroupId?: string }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const editing = Boolean(initial);
  const myId = user?.publicId ?? "";

  const [amountText, setAmountText] = useState(initial ? amountToInput(initial.amountMinor) : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Other");
  const [groupId, setGroupId] = useState<string | null>(initial ? initial.group?.publicId ?? null : presetGroupId ?? null);
  // null = use the default (group currency, else your default currency) until you pick one.
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(initial?.currency ?? null);
  // null = everyone in the group (or just you) until you change the selection.
  const [participantOverride, setParticipantOverride] = useState<string[] | null>(initial ? initial.participants.map((p) => p.userId) : null);
  const [payerChoice, setPayerChoice] = useState<string | null>(initial?.payers[0]?.userId ?? null);
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initial?.splitMethod ?? "equal");
  const [valueText, setValueText] = useState<Record<string, string>>(() => {
    if (!initial || initial.splitMethod === "equal") return {};
    return Object.fromEntries(Object.entries(initial.values).map(([id, v]) => [id, initial.splitMethod === "exact" ? amountToInput(v) : String(v)]));
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(() => startOfDay(initial ? new Date(initial.occurredAt) : new Date()));
  const [showNote, setShowNote] = useState(Boolean(initial?.note));
  const [pickGroup, setPickGroup] = useState(false);
  const [pickPayer, setPickPayer] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const descriptionRef = useRef<TextInput>(null);

  const groupsQuery = trpc.groups.list.useQuery();
  const groupQuery = trpc.groups.get.useQuery({ id: groupId ?? "" }, { enabled: Boolean(groupId) });
  const contactsQuery = trpc.groups.contacts.useQuery(undefined, { enabled: !groupId });

  // People you can split with: the group's members, or (no group) everyone you share a group with.
  const people: Person[] = useMemo(() => {
    const me: Person = { id: myId, name: "You", avatarUrl: user?.avatarUrl ?? null, isMe: true, avatarName: user?.name ?? "You" };
    const list: Person[] = groupId
      ? (groupQuery.data?.members ?? []).map((m) => ({ id: m.publicId, name: m.isMe ? "You" : m.name, avatarUrl: m.avatarUrl, isMe: m.isMe, avatarName: m.name }))
      : [me, ...(contactsQuery.data ?? []).map((c) => ({ id: c.publicId, name: c.name, avatarUrl: c.avatarUrl, isMe: false }))];
    // Keep people already on an expense being edited, even if they have left the group.
    for (const p of initial?.participants ?? []) if (!list.some((x) => x.id === p.userId)) list.push({ id: p.userId, name: p.isMe ? "You" : p.name, avatarUrl: p.avatarUrl, isMe: p.isMe });
    if (!list.some((p) => p.isMe) && myId) list.unshift(me);
    return list;
  }, [groupId, groupQuery.data, contactsQuery.data, initial, myId, user?.avatarUrl]);

  const currency: CurrencyCode = currencyOverride ?? (groupId && groupQuery.data ? groupQuery.data.currency : toCurrencyCode(user?.defaultCurrency));
  const participantIds: string[] = participantOverride ?? (groupId ? (groupQuery.data?.members ?? []).map((m) => m.publicId) : myId ? [myId] : []);
  const setParticipantIds = (update: string[] | ((ids: string[]) => string[])) => setParticipantOverride(typeof update === "function" ? update(participantIds) : update);
  const payerId = payerChoice ?? myId;
  const setPayerId = setPayerChoice;
  const chooseGroup = (next: string | null) => {
    if (next === groupId) return;
    setGroupId(next);
    // A different group means different people: start again from "everyone in the group".
    setParticipantOverride(null);
    setPayerChoice(null);
  };

  const amountMinor = parseAmount(amountText);
  const validAmount = Number.isFinite(amountMinor) && amountMinor > 0;
  const selected = people.filter((p) => participantIds.includes(p.id));

  const numericValues = useMemo(() => {
    const values: Record<string, number> = {};
    for (const id of participantIds) {
      const raw = valueText[id] ?? "";
      if (splitMethod === "exact") {
        const minor = parseAmount(raw);
        values[id] = Number.isFinite(minor) ? minor : 0;
      } else {
        const n = Number.parseFloat(raw.replace(",", "."));
        values[id] = Number.isFinite(n) ? n : 0;
      }
    }
    return values;
  }, [participantIds, valueText, splitMethod]);

  let split: ReturnType<typeof calculateSplit> | null = null;
  let splitError: string | null = null;
  if (validAmount && participantIds.length) {
    try {
      split = calculateSplit(amountMinor, participantIds, splitMethod, numericValues);
    } catch (cause) {
      if (!(cause instanceof SplitValidationError)) throw cause;
      splitError = cause.message;
    }
  }
  const shareOf = (id: string) => split?.find((line) => line.participantId === id)?.amountMinor;

  // Live "how much is left" helper for exact / percentage splits.
  const assigned = participantIds.reduce((sum, id) => sum + (numericValues[id] ?? 0), 0);
  let remainderText: string | null = null;
  let remainderOk = false;
  if (splitMethod === "exact" && validAmount) {
    const left = amountMinor - assigned;
    remainderOk = left === 0;
    remainderText = left === 0 ? "Adds up to the total" : left > 0 ? `${formatMoney(left, currency)} left to assign` : `${formatMoney(-left, currency)} more than the total`;
  } else if (splitMethod === "percentage") {
    const left = Math.round((100 - assigned) * 100) / 100;
    remainderOk = Math.abs(left) < 0.0001;
    remainderText = remainderOk ? "Adds up to 100%" : left > 0 ? `${left}% left to assign` : `${-left}% over 100%`;
  } else if (splitMethod === "shares") {
    remainderOk = assigned > 0;
    remainderText = assigned > 0 ? `${assigned} share${assigned === 1 ? "" : "s"} in total` : "Give at least one person a share";
  }

  const problems: string[] = [];
  if (!validAmount) problems.push(amountText ? "Enter a valid amount" : "Enter the amount");
  if (!description.trim()) problems.push("Add a description");
  if (!participantIds.length) problems.push("Choose who to split with");
  if (!payerId) problems.push("Choose who paid");
  else if (myId && payerId !== myId && !participantIds.includes(myId)) problems.push("You need to be the payer or part of the split");
  if (validAmount && participantIds.length && !split) problems.push(splitMethod === "percentage" ? "Percentages must add up to 100%" : splitMethod === "exact" ? "Amounts must add up to the total" : splitError ?? "Check the split");
  const canSave = problems.length === 0;

  const onSaved = async (id: string) => {
    await Promise.all([utils.dashboard.summary.invalidate(), utils.expenses.list.invalidate(), utils.groups.invalidate(), utils.expenses.get.invalidate({ id })]);
    replace(`/expenses/${id}`);
  };
  const create = trpc.expenses.create.useMutation({ onSuccess: (data) => onSaved(data.publicId) });
  const update = trpc.expenses.update.useMutation({ onSuccess: (data) => onSaved(data.publicId) });
  const mutation = editing ? update : create;

  const save = () => {
    setSubmitted(true);
    if (!canSave || !split) return;
    const values: Record<string, number> = splitMethod === "equal" ? {} : Object.fromEntries(participantIds.map((id) => [id, numericValues[id] ?? 0]));
    const payload = {
      description: description.trim(),
      amountMinor,
      currency,
      splitMethod,
      payerIds: [payerId],
      payerAmounts: { [payerId]: amountMinor },
      participantIds,
      values,
      groupId: groupId ?? undefined,
      category,
      note: note.trim() || undefined,
      occurredAt: date.toISOString(),
    };
    if (initial) update.mutate({ id: initial.id, ...payload });
    else create.mutate(payload);
  };

  const toggle = (id: string) => setParticipantIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const groupName = groupId ? groupQuery.data?.name ?? (groupsQuery.data ?? []).find((g) => g.id === groupId)?.name ?? "Group" : "No group";
  const payer = people.find((p) => p.id === payerId);

  // Big amount text shrinks as it gets longer and on narrow phones.
  // Big amount text shrinks to fit the card on any phone width.
  const cardInner = Math.min(width, MAX_CONTENT_WIDTH) - 40 - 42;
  const symbolWidth = currencyInfo[currency].symbol.length * 20 + 10;
  const amountFont = fitFontSize(amountText || "0", cardInner - symbolWidth - 8, width < 360 ? 46 : 56, 22);
  const today = startOfDay(new Date());
  const yesterday = new Date(today.getTime() - 86400000);
  const shiftDate = (days: number) => setDate((d) => {
    const next = new Date(d.getTime() + days * 86400000);
    return next > today ? today : next;
  });

  return (
    <FormScreen
      title={editing ? "Edit expense" : "Add expense"}
      subtitle={editing ? "Changes update everyone's balances." : undefined}
      footer={
        <View>
          {submitted && !canSave ? <Text accessibilityRole="alert" className="mb-2 text-center text-sm font-semibold text-error">{problems[0]}</Text> : null}
          <PrimaryButton label={editing ? "Save changes" : "Save expense"} loading={mutation.isPending} onPress={save} />
        </View>
      }
    >
      <ErrorBanner message={mutation.error?.message} />

      {/* Amount + currency */}
      <LedgerCard>
        <View className="mb-2 flex-row items-center justify-between gap-3">
          <Text className="text-sm font-bold text-foreground">Amount</Text>
          <CurrencyPicker compact value={currency} onChange={setCurrencyOverride} />
        </View>
        <View className="flex-row items-center">
          <Text style={{ fontSize: Math.min(32, amountFont * 0.6), color: colors.muted, fontWeight: "800", marginRight: 6 }} maxFontSizeMultiplier={1}>{currencyInfo[currency].symbol}</Text>
          <TextInput
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.,\s]/g, ""))}
            placeholder="0"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
            autoFocus={!editing}
            accessibilityLabel="Amount"
            maxFontSizeMultiplier={1}
            style={{ flex: 1, fontSize: amountFont, fontWeight: "900", color: colors.foreground, paddingVertical: 4, minWidth: 0 }}
          />
        </View>
        {submitted && !validAmount ? <Text className="mt-1 text-xs font-semibold text-error">{amountText ? "That doesn't look like a number." : "Enter how much it cost."}</Text> : null}

        <Field
          ref={descriptionRef}
          containerClassName="mt-4 mb-0"
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Dinner at Monal"
          maxLength={160}
          returnKeyType="done"
          error={submitted && !description.trim() ? "Add a short description" : null}
        />
      </LedgerCard>

      {/* Group + date */}
      <LedgerCard className="mt-4">
        <Row
          title={groupName}
          subtitle={groupId ? "Split with members of this group" : "Split with anyone you share a group with"}
          left={<View className="h-10 w-10 items-center justify-center rounded-xl bg-primary"><IconSymbol name="person.2.fill" size={20} color={colors.onPrimary} /></View>}
          onPress={() => setPickGroup(true)}
        />
        <Divider />
        <View className="mt-3">
          <Label>Date</Label>
          <View className="flex-row flex-wrap items-center gap-2">
            <Chip label="Today" selected={sameDay(date, today)} onPress={() => setDate(today)} />
            <Chip label="Yesterday" selected={sameDay(date, yesterday)} onPress={() => setDate(yesterday)} />
            <View className="flex-row items-center gap-1 rounded-full border border-input px-1">
              <Pressable accessibilityRole="button" accessibilityLabel="Previous day" onPress={() => shiftDate(-1)} hitSlop={8} className="p-2"><IconSymbol name="chevron.left" size={18} color={colors.foreground} /></Pressable>
              <Text className="text-sm font-bold text-foreground">{date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" })}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next day" disabled={sameDay(date, today)} onPress={() => shiftDate(1)} hitSlop={8} className="p-2" style={{ opacity: sameDay(date, today) ? 0.3 : 1 }}><IconSymbol name="chevron.right" size={18} color={colors.foreground} /></Pressable>
            </View>
          </View>
        </View>
      </LedgerCard>

      {/* Paid by + split */}
      <LedgerCard className="mt-4">
        <Row
          title={`Paid by ${payer?.name ?? "…"}`}
          subtitle={validAmount ? `${formatMoney(amountMinor, currency)} in full` : "Who paid the bill?"}
          left={<Avatar name={payer?.avatarName ?? payer?.name ?? "?"} url={payer?.avatarUrl} size={40} />}
          onPress={() => setPickPayer(true)}
        />
        <Divider />
        <View className="mt-3">
          <Label hint={`${participantIds.length} selected`}>Split between</Label>
          {groupId && groupQuery.isLoading ? <ActivityIndicator color={colors.tint} /> : null}
          {!groupId && !contactsQuery.isLoading && (contactsQuery.data ?? []).length === 0 ? (
            <Text className="mb-2 text-sm leading-5 text-muted">Only you so far. Create a group and add people to split with them.</Text>
          ) : null}
          <View className="flex-row flex-wrap gap-2">
            {people.map((person) => (
              <Chip key={person.id} label={person.name} selected={participantIds.includes(person.id)} onPress={() => toggle(person.id)} icon={<Avatar name={person.avatarName ?? person.name} url={person.avatarUrl} size={20} />} />
            ))}
          </View>
          {people.length > 2 ? (
            <View className="mt-2 flex-row gap-4">
              <Pressable accessibilityRole="button" onPress={() => setParticipantIds(people.map((p) => p.id))} hitSlop={8}><Text className="text-sm font-bold text-muted underline">Select all</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setParticipantIds(myId ? [myId] : [])} hitSlop={8}><Text className="text-sm font-bold text-muted underline">Just me</Text></Pressable>
            </View>
          ) : null}
        </View>

        <View className="mt-5">
          <Label>How to split</Label>
          <Segmented
            value={splitMethod}
            onChange={(m) => { setSplitMethod(m); setValueText({}); }}
            options={methods.map((m) => ({ value: m, label: m === "equal" ? "Equal" : m === "exact" ? "Exact" : m === "percentage" ? "%" : "Shares" }))}
          />
          <Text className="mt-2 text-xs text-muted">{splitMethodLabels[splitMethod]}{splitMethod === "shares" ? " — e.g. 2 shares pays twice as much as 1" : ""}</Text>
        </View>

        <View className="mt-3">
          {selected.map((person) => {
            const share = shareOf(person.id);
            return (
              <View key={person.id} className="flex-row items-center gap-3 border-b border-border py-2.5">
                <Avatar name={person.avatarName ?? person.name} url={person.avatarUrl} size={32} />
                <Text className="flex-1 text-base font-semibold text-foreground" numberOfLines={1}>{person.name}</Text>
                {splitMethod !== "equal" ? (
                  <View className="flex-row items-center gap-1">
                    {splitMethod === "exact" ? <Text className="text-sm text-muted">{currencyInfo[currency].symbol}</Text> : null}
                    <TextInput
                      value={valueText[person.id] ?? ""}
                      onChangeText={(t) => setValueText((v) => ({ ...v, [person.id]: t.replace(/[^0-9.,]/g, "") }))}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`${person.name} ${splitMethod === "percentage" ? "percent" : splitMethod === "shares" ? "shares" : "amount"}`}
                      maxFontSizeMultiplier={1.3}
                      className="rounded-xl border border-input bg-background px-3 py-2 text-right text-base font-bold text-foreground"
                      style={{ width: splitMethod === "exact" ? 104 : 72 }}
                    />
                    {splitMethod === "percentage" ? <Text className="text-sm text-muted">%</Text> : null}
                  </View>
                ) : null}
                <Text className="text-right text-sm font-black text-foreground" style={{ minWidth: 76 }} numberOfLines={1} adjustsFontSizeToFit>
                  {share !== undefined ? formatMoney(share, currency) : "—"}
                </Text>
              </View>
            );
          })}
          {splitMethod === "equal" && split && selected.length ? (
            <Text className="mt-2 text-sm font-semibold text-muted">{formatMoney(split[0]!.amountMinor, currency)} each</Text>
          ) : null}
          {remainderText ? (
            <View className="mt-3 flex-row items-center gap-2">
              <IconSymbol name={remainderOk ? "checkmark.circle.fill" : "info.circle"} size={18} color={remainderOk ? colors.success : colors.warning} />
              <Text className="text-sm font-bold" style={{ color: remainderOk ? colors.success : colors.warning }}>{remainderText}</Text>
            </View>
          ) : null}
        </View>
      </LedgerCard>

      {/* Category + note */}
      <LedgerCard className="mt-4">
        <Label>Category</Label>
        <View className="flex-row flex-wrap gap-2">
          {expenseCategories.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
        </View>
        {showNote ? (
          <Field containerClassName="mt-4 mb-0" label="Note" value={note} onChangeText={setNote} placeholder="Anything worth remembering" multiline maxLength={1000} style={{ minHeight: 80, textAlignVertical: "top" }} />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setShowNote(true)} className="mt-4 self-start" hitSlop={8}><Text className="text-sm font-bold text-muted underline">+ Add a note</Text></Pressable>
        )}
      </LedgerCard>

      <PickerSheet
        visible={pickGroup}
        title="Choose a group"
        items={[{ id: "", name: "No group", memberCount: 0 }, ...(groupsQuery.data ?? []).map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))]}
        keyOf={(g) => g.id || "none"}
        labelOf={(g) => g.name}
        sublabelOf={(g) => (g.id ? `${g.memberCount} members` : "Split with people you already know")}
        selectedKey={groupId ?? "none"}
        onSelect={(g) => chooseGroup(g.id || null)}
        onClose={() => setPickGroup(false)}
      />
      <PickerSheet
        visible={pickPayer}
        title="Who paid?"
        items={people}
        keyOf={(p) => p.id}
        labelOf={(p) => p.name}
        leftOf={(p) => <Avatar name={p.avatarName ?? p.name} url={p.avatarUrl} size={36} />}
        selectedKey={payerId}
        onSelect={(p) => setPayerId(p.id)}
        onClose={() => setPickPayer(false)}
      />
    </FormScreen>
  );
}
