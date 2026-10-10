import { Pressable, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { formatMoney } from "@/lib/formatters/currency";
import { go } from "@/lib/nav";
import type { CurrencyCode } from "@/shared/domain";

export type ExpenseListItem = {
  id: string;
  description: string;
  amountMinor: number;
  currency: CurrencyCode;
  category: string;
  occurredAt: string;
  paidByName: string;
  myNetMinor: number;
  involved: boolean;
  groupName?: string | null;
};

/** One expense line: date, what, who paid, and what it means for you. */
export function ExpenseRow({ item, showGroup }: { item: ExpenseListItem; showGroup?: boolean }) {
  const colors = useColors();
  const date = new Date(item.occurredAt);
  const net = item.myNetMinor;
  const status = !item.involved ? "not involved" : net > 0 ? "you lent" : net < 0 ? "you borrowed" : "settled";
  const statusColor = !item.involved || net === 0 ? colors.muted : net > 0 ? colors.success : colors.error;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.description}, ${formatMoney(item.amountMinor, item.currency)}, ${status}`} onPress={() => go(`/expenses/${item.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View className="flex-row items-center gap-3 border-b border-border py-3">
        <View className="w-10 items-center">
          <Text className="text-xs font-bold uppercase text-muted" maxFontSizeMultiplier={1.2}>{date.toLocaleDateString(undefined, { month: "short" })}</Text>
          <Text className="text-lg font-black text-foreground" maxFontSizeMultiplier={1.2}>{date.getDate()}</Text>
        </View>
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
          <IconSymbol name="receipt.fill" size={18} color={colors.foreground} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground" numberOfLines={1}>{item.description}</Text>
          <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
            {item.paidByName} paid {formatMoney(item.amountMinor, item.currency)}{showGroup && item.groupName ? ` · ${item.groupName}` : ""}
          </Text>
        </View>
        <View className="items-end" style={{ maxWidth: "36%" }}>
          <Text className="text-xs font-semibold" style={{ color: statusColor }}>{status}</Text>
          {item.involved && net !== 0 ? (
            <Text className="text-sm font-black" style={{ color: statusColor }} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(Math.abs(net), item.currency)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
