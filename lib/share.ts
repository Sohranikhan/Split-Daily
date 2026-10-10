import { Platform, Share } from "react-native";
import * as Linking from "expo-linking";

/** Deep link that opens the join screen (splitdaily app on phones, the web app on web). */
export function inviteUrl(code: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/join/${code}`;
  return Linking.createURL(`join/${code}`);
}

export function inviteMessage(code: string, groupName: string) {
  return `Join “${groupName}” on Split Daily so we can split expenses.\n\nInvite code: ${code}\nOpen: ${inviteUrl(code)}\n\nNew to Split Daily? Sign in with Google, tap Groups → Join with code, and enter the code above.`;
}

/** Opens the share sheet. Returns false when sharing isn't available (some desktop browsers). */
export async function shareText(message: string, title = "Split Daily invite"): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> }) : undefined;
      if (nav?.share) {
        await nav.share({ title, text: message });
        return true;
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(message);
        return true;
      }
      return false;
    }
    await Share.share({ message, title });
    return true;
  } catch {
    return false;
  }
}
