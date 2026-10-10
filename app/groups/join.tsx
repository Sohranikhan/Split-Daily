import { useState } from "react";
import { Text } from "react-native";
import { Field, FormScreen } from "@/components/ui/form";
import { LedgerCard } from "@/components/ui/ledger-card";
import { PrimaryButton } from "@/components/ui/primary-button";
import { go } from "@/lib/nav";

export default function JoinWithCodeScreen() {
  const [code, setCode] = useState("");
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (
    <FormScreen title="Join with code" subtitle="Ask a friend in the group to share their invite code." footer={<PrimaryButton label="Continue" disabled={cleaned.length < 4} onPress={() => go(`/join/${cleaned}`)} />}>
      <LedgerCard>
        <Field label="Invite code" value={code} onChangeText={setCode} placeholder="e.g. K7M2QX9P" autoCapitalize="characters" autoCorrect={false} autoFocus maxLength={20} returnKeyType="go" onSubmitEditing={() => cleaned.length >= 4 && go(`/join/${cleaned}`)} style={{ fontSize: 22, letterSpacing: 4, fontWeight: "800" }} />
        <Text className="text-xs leading-5 text-muted">Got an invite link instead? Just open it — the app will bring you here.</Text>
      </LedgerCard>
    </FormScreen>
  );
}
