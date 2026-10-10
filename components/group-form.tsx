import { useState } from "react";
import { Text, View } from "react-native";
import { Chip, CurrencyPicker, ErrorBanner, Field, FormScreen, Label } from "@/components/ui/form";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { useAuth } from "@/hooks/use-auth";
import { replace } from "@/lib/nav";
import { trpc } from "@/lib/trpc";
import { groupCategories, toCurrencyCode, type CurrencyCode } from "@/shared/domain";

type Initial = { id: string; name: string; description: string | null; category: string; currency: CurrencyCode };

export function GroupForm({ initial }: { initial?: Initial }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Trip");
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency ?? toCurrencyCode(user?.defaultCurrency));
  const [submitted, setSubmitted] = useState(false);

  const create = trpc.groups.create.useMutation({
    onSuccess: async (group) => {
      await Promise.all([utils.groups.list.invalidate(), utils.dashboard.summary.invalidate()]);
      replace(`/groups/add-members?id=${group.publicId}&fresh=1`);
    },
  });
  const update = trpc.groups.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.groups.invalidate(), utils.dashboard.summary.invalidate()]);
      replace(`/groups/${initial!.id}`);
    },
  });
  const mutation = initial ? update : create;

  const save = () => {
    setSubmitted(true);
    if (!name.trim()) return;
    if (initial) update.mutate({ id: initial.id, name: name.trim(), description: description.trim() || null, category, currency });
    else create.mutate({ name: name.trim(), description: description.trim() || undefined, category, currency });
  };

  return (
    <FormScreen
      title={initial ? "Edit group" : "Create a group"}
      subtitle={initial ? undefined : "A shared space for a trip, a home or any plan with friends."}
      footer={<PrimaryButton label={initial ? "Save changes" : "Create group"} loading={mutation.isPending} onPress={save} />}
    >
      <ErrorBanner message={mutation.error?.message} />
      <LedgerCard>
        <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Hunza trip" autoFocus={!initial} maxLength={160} error={submitted && !name.trim() ? "Give the group a name" : null} />
        <Field label="Description" hint="Optional" value={description} onChangeText={setDescription} placeholder="What is this group for?" multiline maxLength={500} style={{ minHeight: 80, textAlignVertical: "top" }} />
        <Label>Type</Label>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {groupCategories.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}
        </View>
        <Label hint="New expenses in this group start in this currency">Group currency</Label>
        <CurrencyPicker value={currency} onChange={setCurrency} />
        {initial ? <Text className="mt-2 text-xs leading-5 text-muted">Changing the currency doesn’t convert existing expenses — they keep the currency they were added in.</Text> : null}
      </LedgerCard>
    </FormScreen>
  );
}
