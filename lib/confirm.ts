import { Alert, Platform } from "react-native";

/** Yes/no question that works on iOS, Android and web (Alert buttons are a no-op on web). */
export function confirm(title: string, message: string, options: { confirmLabel?: string; destructive?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n\n${message}`) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: options.confirmLabel ?? "OK", style: options.destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/** Simple message box that also works on web. */
export function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
