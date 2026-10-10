import { forwardRef, useMemo, useState, type ReactNode } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";
import { currencyCodes, currencyInfo, type CurrencyCode } from "@/shared/domain";

/** Content never stretches wider than this on tablets / web. */
export const MAX_CONTENT_WIDTH = 640;

/**
 * Standard screen: safe area, back button + title, keyboard-aware scrolling, centred column.
 * `footer` stays pinned above the keyboard (for the main Save button).
 */
export function FormScreen({
  title,
  subtitle,
  children,
  footer,
  backLabel = "Back",
  onBack,
  right,
  scroll = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
  scroll?: boolean;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/(tabs)")));
  const header = (
    <View>
      <View className="flex-row items-center justify-between">
        <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} hitSlop={12} className="flex-row items-center gap-1 py-2 pr-3">
          <IconSymbol name="chevron.left" size={20} color={colors.muted} />
          <Text className="text-sm font-bold text-muted">{backLabel}</Text>
        </Pressable>
        {right}
      </View>
      <Text accessibilityRole="header" className="mt-2 text-3xl font-black text-foreground" maxFontSizeMultiplier={1.4}>{title}</Text>
      {subtitle ? <Text className="mt-1 text-base leading-6 text-muted">{subtitle}</Text> : null}
    </View>
  );
  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: footer ? 24 : 40, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
            {header}
            <View className="mt-5">{children}</View>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: 20, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
            {header}
            <View className="mt-5 flex-1">{children}</View>
          </View>
        )}
        {footer ? (
          <View className="border-t border-border bg-background" style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12) }}>
            <View style={{ width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>{footer}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View className="mb-2 flex-row items-baseline justify-between gap-2">
      <Text className="text-sm font-bold text-foreground">{children}</Text>
      {hint ? <Text className="flex-shrink text-right text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label?: string; hint?: string; error?: string | null; containerClassName?: string }>(
  function Field({ label, hint, error, containerClassName, className, ...props }, ref) {
    const colors = useColors();
    return (
      <View className={cn("mb-4", containerClassName)}>
        {label ? <Label hint={hint}>{label}</Label> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          className={cn("rounded-2xl border bg-background px-4 py-3.5 text-base text-foreground", error ? "border-error" : "border-input", className)}
          style={{ minHeight: 50 }}
          maxFontSizeMultiplier={1.6}
          {...props}
        />
        {error ? <Text accessibilityRole="alert" className="mt-1.5 text-xs font-semibold text-error">{error}</Text> : null}
      </View>
    );
  },
);

export function Chip({ label, selected, onPress, icon, disabled }: { label: string; selected?: boolean; onPress?: () => void; icon?: ReactNode; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 38,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderColor: selected ? colors.primary : colors.input,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {icon}
      <Text style={{ color: selected ? colors.onPrimary : colors.foreground }} className="text-sm font-bold" maxFontSizeMultiplier={1.4}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  const colors = useColors();
  return (
    <View className="flex-row rounded-2xl border border-border bg-background p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center justify-center rounded-xl px-2 py-2.5"
            style={{ backgroundColor: selected ? colors.primary : "transparent" }}
          >
            <Text numberOfLines={1} className="text-sm font-bold" style={{ color: selected ? colors.onPrimary : colors.foreground }} maxFontSizeMultiplier={1.3}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const palette = ["#C8F169", "#F2A39D", "#BFD4FF", "#FFD98A", "#B9E4D4", "#D9C8FF"];
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const color = palette[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palette.length];
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityLabel={name} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#14200F", fontSize: size * 0.42, fontWeight: "900" }} maxFontSizeMultiplier={1}>{initial}</Text>
    </View>
  );
}

export function Row({ title, subtitle, left, right, onPress, destructive }: { title: string; subtitle?: string | null; left?: ReactNode; right?: ReactNode; onPress?: () => void; destructive?: boolean }) {
  const colors = useColors();
  const content = (
    <View className="flex-row items-center gap-3 py-3">
      {left}
      <View className="flex-1">
        <Text className="text-base font-bold" style={{ color: destructive ? colors.error : colors.foreground }} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-muted" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <IconSymbol name="chevron.right" size={18} color={colors.muted} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{content}</Pressable>;
}

export function Divider() {
  return <View className="h-px bg-border" />;
}

export function SecondaryButton({ label, onPress, icon, destructive, disabled, loading }: { label: string; onPress: () => void; icon?: ReactNode; destructive?: boolean; disabled?: boolean; loading?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: destructive ? colors.error : colors.input,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingHorizontal: 16,
        opacity: disabled ? 0.5 : pressed || loading ? 0.7 : 1,
      })}
    >
      {icon}
      <Text className="text-base font-bold" style={{ color: destructive ? colors.error : colors.foreground }}>{loading ? "Please wait…" : label}</Text>
    </Pressable>
  );
}

/** Generic bottom sheet with a searchable list. */
export function PickerSheet<T>({
  visible,
  title,
  items,
  keyOf,
  labelOf,
  sublabelOf,
  leftOf,
  selectedKey,
  onSelect,
  onClose,
  searchPlaceholder,
}: {
  visible: boolean;
  title: string;
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  sublabelOf?: (item: T) => string | undefined;
  leftOf?: (item: T) => ReactNode;
  selectedKey?: string | null;
  onSelect: (item: T) => void;
  onClose: () => void;
  searchPlaceholder?: string;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${labelOf(item)} ${sublabelOf?.(item) ?? ""} ${keyOf(item)}`.toLowerCase().includes(q));
  }, [items, query, labelOf, sublabelOf, keyOf]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
      <View className="bg-background" style={{ maxHeight: "80%", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: Math.max(insets.bottom, 16), width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
        <View className="flex-row items-center justify-between px-5 pb-3 pt-5">
          <Text className="text-xl font-black text-foreground">{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}><IconSymbol name="xmark" size={22} color={colors.muted} /></Pressable>
        </View>
        {items.length > 6 ? (
          <View className="px-5 pb-2">
            <TextInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder ?? "Search"} placeholderTextColor={colors.muted} autoCorrect={false} className="rounded-2xl border border-input bg-surface px-4 py-3 text-base text-foreground" />
          </View>
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={keyOf}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20 }}
          ItemSeparatorComponent={Divider}
          ListEmptyComponent={<Text className="py-6 text-center text-sm text-muted">Nothing matches “{query}”.</Text>}
          renderItem={({ item }) => {
            const selected = keyOf(item) === selectedKey;
            return (
              <Row
                title={labelOf(item)}
                subtitle={sublabelOf?.(item)}
                left={leftOf?.(item)}
                right={selected ? <IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} /> : <View />}
                onPress={() => {
                  onSelect(item);
                  setQuery("");
                  onClose();
                }}
              />
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function CurrencyPicker({ value, onChange, compact }: { value: CurrencyCode; onChange: (currency: CurrencyCode) => void; compact?: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const info = currencyInfo[value];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Currency: ${info.name}. Change currency`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 12, minHeight: compact ? 40 : 50, opacity: pressed ? 0.7 : 1 })}
      >
        <Text style={{ fontSize: 18 }} maxFontSizeMultiplier={1}>{info.flag}</Text>
        <Text className="text-base font-black text-foreground" maxFontSizeMultiplier={1.3}>{value}</Text>
        {!compact ? <Text className="flex-1 text-sm text-muted" numberOfLines={1}>{info.name}</Text> : null}
        <IconSymbol name="chevron.down" size={18} color={colors.muted} />
      </Pressable>
      <PickerSheet
        visible={open}
        title="Choose currency"
        items={[...currencyCodes]}
        keyOf={(code) => code}
        labelOf={(code) => `${code} · ${currencyInfo[code].name}`}
        sublabelOf={(code) => currencyInfo[code].symbol}
        leftOf={(code) => <Text style={{ fontSize: 24 }}>{currencyInfo[code].flag}</Text>}
        selectedKey={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
        searchPlaceholder="Search currency or country"
      />
    </>
  );
}

export function SwitchRow({ title, subtitle, value, onChange, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value, disabled: Boolean(disabled) }} disabled={disabled} onPress={() => onChange(!value)} className="flex-row items-center gap-3 py-3" style={{ opacity: disabled ? 0.5 : 1 }}>
      <View className="flex-1">
        <Text className="text-base font-bold text-foreground">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm leading-5 text-muted">{subtitle}</Text> : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? colors.success : colors.border, justifyContent: "center" }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", alignSelf: value ? "flex-end" : "flex-start" }} />
      </View>
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" className="mb-4 rounded-2xl border border-error bg-surface p-4">
      <Text className="text-sm font-semibold leading-5 text-error">{message}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between">
      <Text className="text-lg font-black text-foreground">{children}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={10}>
          <Text className="text-sm font-bold text-muted underline">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
