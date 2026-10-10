import { View, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

export function LedgerCard({ className, children, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={cn("rounded-[26px] border border-border bg-surface p-5", className)}
      {...props}
    >
      {children}
    </View>
  );
}
