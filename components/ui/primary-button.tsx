import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function PrimaryButton({ label, loading, ...props }: PressableProps & { label: string; loading?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(loading || props.disabled), busy: Boolean(loading) }}
      disabled={loading || props.disabled}
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 20,
        backgroundColor: colors.primary,
        opacity: props.disabled ? 0.55 : pressed || loading ? 0.85 : 1,
      })}
      {...props}
    >
      {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text className="text-base font-bold text-on-primary">{label}</Text>}
    </Pressable>
  );
}
