import { z } from "zod";

/**
 * Supported currencies. Amounts are always stored as integer hundredths ("minor units") of the
 * currency, including zero-decimal currencies like JPY, so the math is identical everywhere.
 */
export const currencyCodes = [
  "USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "QAR", "KWD", "OMR", "BHD", "CAD", "AUD", "NZD",
  "JPY", "CNY", "HKD", "SGD", "MYR", "IDR", "THB", "PHP", "KRW", "BDT", "LKR", "NPR", "TRY", "EGP",
  "NGN", "KES", "ZAR", "CHF", "SEK", "NOK", "DKK", "PLN", "BRL", "MXN",
] as const;

export type CurrencyCode = (typeof currencyCodes)[number];

export const currencyInfo: Record<CurrencyCode, { name: string; symbol: string; flag: string }> = {
  USD: { name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  EUR: { name: "Euro", symbol: "€", flag: "🇪🇺" },
  GBP: { name: "British Pound", symbol: "£", flag: "🇬🇧" },
  PKR: { name: "Pakistani Rupee", symbol: "Rs", flag: "🇵🇰" },
  INR: { name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  AED: { name: "UAE Dirham", symbol: "AED", flag: "🇦🇪" },
  SAR: { name: "Saudi Riyal", symbol: "SAR", flag: "🇸🇦" },
  QAR: { name: "Qatari Riyal", symbol: "QAR", flag: "🇶🇦" },
  KWD: { name: "Kuwaiti Dinar", symbol: "KWD", flag: "🇰🇼" },
  OMR: { name: "Omani Rial", symbol: "OMR", flag: "🇴🇲" },
  BHD: { name: "Bahraini Dinar", symbol: "BHD", flag: "🇧🇭" },
  CAD: { name: "Canadian Dollar", symbol: "CA$", flag: "🇨🇦" },
  AUD: { name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  NZD: { name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  JPY: { name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  CNY: { name: "Chinese Yuan", symbol: "CN¥", flag: "🇨🇳" },
  HKD: { name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  SGD: { name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  MYR: { name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  IDR: { name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  THB: { name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  PHP: { name: "Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  KRW: { name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  BDT: { name: "Bangladeshi Taka", symbol: "৳", flag: "🇧🇩" },
  LKR: { name: "Sri Lankan Rupee", symbol: "Rs", flag: "🇱🇰" },
  NPR: { name: "Nepalese Rupee", symbol: "Rs", flag: "🇳🇵" },
  TRY: { name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  EGP: { name: "Egyptian Pound", symbol: "E£", flag: "🇪🇬" },
  NGN: { name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  KES: { name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
  ZAR: { name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  CHF: { name: "Swiss Franc", symbol: "CHF", flag: "🇨🇭" },
  SEK: { name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  NOK: { name: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
  DKK: { name: "Danish Krone", symbol: "kr", flag: "🇩🇰" },
  PLN: { name: "Polish Złoty", symbol: "zł", flag: "🇵🇱" },
  BRL: { name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  MXN: { name: "Mexican Peso", symbol: "MX$", flag: "🇲🇽" },
};

export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export const splitMethodLabels: Record<SplitMethod, string> = {
  equal: "Equally",
  exact: "Exact amounts",
  percentage: "Percentages",
  shares: "Shares",
};

export const expenseCategories = [
  "Food",
  "Restaurants",
  "Groceries",
  "Transport",
  "Fuel",
  "Travel",
  "Hotel",
  "Shopping",
  "Entertainment",
  "Bills",
  "Rent",
  "Utilities",
  "Health",
  "Education",
  "Gifts",
  "Work",
  "Other",
] as const;

export const groupCategories = ["Trip", "Home", "Couple", "Friends", "Work", "Event", "Other"] as const;

export const paymentMethods = ["Cash", "Bank Transfer", "Easypaisa", "JazzCash", "PayPal", "Card", "Other"] as const;

const currencySchema = z.enum(currencyCodes);

const expenseFields = {
  description: z.string().trim().min(1, "Add a description").max(160),
  amountMinor: z.number().int().positive(),
  currency: currencySchema,
  splitMethod: z.enum(["equal", "exact", "percentage", "shares"]),
  payerIds: z.array(z.string().min(1)).min(1),
  payerAmounts: z.record(z.string(), z.number().int().nonnegative()).default({}),
  participantIds: z.array(z.string().min(1)).min(1),
  values: z.record(z.string(), z.number().nonnegative()),
  groupId: z.string().min(1).optional(),
  note: z.string().max(1000).optional(),
  category: z.string().trim().min(1).max(64).optional(),
  /** ISO date/time the expense happened. Defaults to now. */
  occurredAt: z.string().datetime({ offset: true }).optional(),
};

export const createExpenseInputSchema = z.object(expenseFields);
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = z.object({ id: z.string().min(1), ...expenseFields });
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

export const createGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(64).default("Other"),
  currency: currencySchema.default("USD"),
});
export type CreateGroupInput = z.infer<typeof createGroupInputSchema>;

export const updateGroupInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(64).optional(),
  currency: currencySchema.optional(),
});
export type UpdateGroupInput = z.infer<typeof updateGroupInputSchema>;

export const addGroupMembersInputSchema = z.object({
  groupId: z.string().min(1),
  /** People who may not have an account yet. Existing users are added directly; others get an invite. */
  emails: z.array(z.string().trim().toLowerCase().email("Enter a valid email address")).max(50).default([]),
  /** Public IDs of people you already share a group with. */
  userIds: z.array(z.string().min(1)).max(50).default([]),
});
export type AddGroupMembersInput = z.infer<typeof addGroupMembersInputSchema>;

export const createSettlementInputSchema = z.object({
  payerId: z.string().min(1),
  receiverId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: currencySchema,
  groupId: z.string().min(1).optional(),
  paymentMethod: z.string().trim().min(1).max(64).default("Other"),
  note: z.string().trim().max(500).optional(),
});
export type CreateSettlementInput = z.infer<typeof createSettlementInputSchema>;

export const updateSettlementStatusInputSchema = z.object({
  publicId: z.string().min(1),
  status: z.enum(["paid", "confirmed", "cancelled"]),
});
export type UpdateSettlementStatusInput = z.infer<typeof updateSettlementStatusInputSchema>;

export const updateProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty").max(160).optional(),
  defaultCurrency: currencySchema.optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const notificationPreferenceKeys = [
  "pushEnabled",
  "emailEnabled",
  "inAppEnabled",
  "expenseAlerts",
  "groupAlerts",
  "settlementAlerts",
  "reminderAlerts",
] as const;
export type NotificationPreferenceKey = (typeof notificationPreferenceKeys)[number];
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;
export const updateNotificationPreferencesInputSchema = z.object(
  Object.fromEntries(notificationPreferenceKeys.map((key) => [key, z.boolean().optional()])) as Record<NotificationPreferenceKey, z.ZodOptional<z.ZodBoolean>>,
);

export type SplitLine = {
  participantId: string;
  value: number;
  amountMinor: number;
};

export type Debt = {
  fromId: string;
  toId: string;
  amountMinor: number;
  currency: CurrencyCode;
};

export type CurrencyAmount = { currency: CurrencyCode; amountMinor: number };

export type BalanceSummary = {
  owedToYouMinor: number;
  youOweMinor: number;
  netMinor: number;
  currency: CurrencyCode;
};

/** Your net balance with one person, across all groups (positive = they owe you). */
export type PersonBalance = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  balances: CurrencyAmount[];
};

export type LedgerActivity = {
  id: string;
  kind: "expense" | "settlement" | "group" | "friend";
  title: string;
  subtitle: string;
  amountMinor?: number;
  currency?: CurrencyCode;
  createdAt: string;
  /** Public ID of the related expense/group/settlement, when there is one. */
  relatedId?: string | null;
  relatedType?: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  category: string;
  memberCount: number;
  /** Your balance in the group's main currency (positive = you are owed). */
  balanceMinor: number;
  currency: CurrencyCode;
  /** All non-zero balances in the group, one per currency. */
  balances: CurrencyAmount[];
  accent: string;
};

export type DashboardData = {
  /** Totals in your default currency. */
  balance: BalanceSummary;
  /** Totals for every currency you have balances in. */
  balances: BalanceSummary[];
  people: PersonBalance[];
  groups: GroupSummary[];
  activity: LedgerActivity[];
};

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (currencyCodes as readonly string[]).includes(value);
}

export function toCurrencyCode(value: string | null | undefined, fallback: CurrencyCode = "USD"): CurrencyCode {
  return value && isCurrencyCode(value) ? value : fallback;
}

export function groupAccent(category: string) {
  switch (category) {
    case "Trip":
      return "#C8F169";
    case "Home":
      return "#F2A39D";
    case "Couple":
      return "#F7C8E0";
    case "Friends":
      return "#FFD98A";
    case "Work":
      return "#B9E4D4";
    case "Event":
      return "#D9C8FF";
    default:
      return "#BFD4FF";
  }
}
