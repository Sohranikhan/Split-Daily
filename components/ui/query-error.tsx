import { Pressable, Text, View } from "react-native";

export function QueryError({ onRetry, message = "We couldn’t load this right now." }: { onRetry: () => void; message?: string }) {
  return <View accessibilityRole="alert" className="rounded-[26px] border border-error bg-surface p-5"><Text className="text-base font-bold text-foreground">Something needs another try</Text><Text className="mt-2 text-sm leading-5 text-muted">{message}</Text><Pressable accessibilityRole="button" onPress={onRetry} className="mt-4 self-start rounded-xl bg-primary px-4 py-3"><Text className="text-sm font-black text-on-primary">Try again</Text></Pressable></View>;
}
