// Fallback for using MaterialIcons on Android and web.
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Partial<Record<Extract<SymbolViewProps["name"], string>, ComponentProps<typeof MaterialIcons>["name"]>>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "person.2.fill": "groups",
  "receipt.fill": "receipt-long",
  "chart.bar.fill": "bar-chart",
  "person.crop.circle.fill": "account-circle",
  "plus": "add",
  "bell.fill": "notifications-none",
  "gearshape.fill": "settings",
  "arrow.up.right": "north-east",
  "arrow.down.left": "south-west",
  "creditcard.fill": "payments",
  "magnifyingglass": "search",
  "arrow.triangle.2.circlepath": "sync",
  "checkmark": "check",
  "xmark": "close",
  "chevron.left": "arrow-back",
  "chevron.down": "expand-more",
  "pencil": "edit",
  "trash": "delete-outline",
  "person.badge.plus": "person-add-alt",
  "person.badge.minus": "person-remove",
  "square.and.arrow.up": "ios-share",
  "link": "link",
  "envelope": "mail-outline",
  "rectangle.portrait.and.arrow.right": "logout",
  "globe": "public",
  "moon.fill": "dark-mode",
  "sun.max.fill": "light-mode",
  "iphone": "phone-android",
  "info.circle": "info-outline",
  "lock": "lock-outline",
  "checkmark.circle.fill": "check-circle",
  "calendar": "event",
  "tag": "sell",
  "ellipsis": "more-horiz",
  "dollarsign.circle": "currency-exchange",
  "doc.on.doc": "content-copy",
  "person.3.fill": "group-add",
  "questionmark.circle": "help-outline",
} satisfies IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
