import { z } from "zod";
const currencyCodes = [
  "USD",
  "EUR",
  "GBP",
  "PKR",
  "INR",
  "AED",
  "SAR",
  "QAR",
  "KWD",
  "OMR",
  "BHD",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "HKD",
  "SGD",
  "MYR",
  "IDR",
  "THB",
  "PHP",
  "KRW",
  "BDT",
  "LKR",
  "NPR",
  "TRY",
  "EGP",
  "NGN",
  "KES",
  "ZAR",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "BRL",
  "MXN"
];
const currencyInfo = {
  USD: { name: "US Dollar", symbol: "$", flag: "\u{1F1FA}\u{1F1F8}" },
  EUR: { name: "Euro", symbol: "\u20AC", flag: "\u{1F1EA}\u{1F1FA}" },
  GBP: { name: "British Pound", symbol: "\xA3", flag: "\u{1F1EC}\u{1F1E7}" },
  PKR: { name: "Pakistani Rupee", symbol: "Rs", flag: "\u{1F1F5}\u{1F1F0}" },
  INR: { name: "Indian Rupee", symbol: "\u20B9", flag: "\u{1F1EE}\u{1F1F3}" },
  AED: { name: "UAE Dirham", symbol: "AED", flag: "\u{1F1E6}\u{1F1EA}" },
  SAR: { name: "Saudi Riyal", symbol: "SAR", flag: "\u{1F1F8}\u{1F1E6}" },
  QAR: { name: "Qatari Riyal", symbol: "QAR", flag: "\u{1F1F6}\u{1F1E6}" },
  KWD: { name: "Kuwaiti Dinar", symbol: "KWD", flag: "\u{1F1F0}\u{1F1FC}" },
  OMR: { name: "Omani Rial", symbol: "OMR", flag: "\u{1F1F4}\u{1F1F2}" },
  BHD: { name: "Bahraini Dinar", symbol: "BHD", flag: "\u{1F1E7}\u{1F1ED}" },
  CAD: { name: "Canadian Dollar", symbol: "CA$", flag: "\u{1F1E8}\u{1F1E6}" },
  AUD: { name: "Australian Dollar", symbol: "A$", flag: "\u{1F1E6}\u{1F1FA}" },
  NZD: { name: "New Zealand Dollar", symbol: "NZ$", flag: "\u{1F1F3}\u{1F1FF}" },
  JPY: { name: "Japanese Yen", symbol: "\xA5", flag: "\u{1F1EF}\u{1F1F5}" },
  CNY: { name: "Chinese Yuan", symbol: "CN\xA5", flag: "\u{1F1E8}\u{1F1F3}" },
  HKD: { name: "Hong Kong Dollar", symbol: "HK$", flag: "\u{1F1ED}\u{1F1F0}" },
  SGD: { name: "Singapore Dollar", symbol: "S$", flag: "\u{1F1F8}\u{1F1EC}" },
  MYR: { name: "Malaysian Ringgit", symbol: "RM", flag: "\u{1F1F2}\u{1F1FE}" },
  IDR: { name: "Indonesian Rupiah", symbol: "Rp", flag: "\u{1F1EE}\u{1F1E9}" },
  THB: { name: "Thai Baht", symbol: "\u0E3F", flag: "\u{1F1F9}\u{1F1ED}" },
  PHP: { name: "Philippine Peso", symbol: "\u20B1", flag: "\u{1F1F5}\u{1F1ED}" },
  KRW: { name: "South Korean Won", symbol: "\u20A9", flag: "\u{1F1F0}\u{1F1F7}" },
  BDT: { name: "Bangladeshi Taka", symbol: "\u09F3", flag: "\u{1F1E7}\u{1F1E9}" },
  LKR: { name: "Sri Lankan Rupee", symbol: "Rs", flag: "\u{1F1F1}\u{1F1F0}" },
  NPR: { name: "Nepalese Rupee", symbol: "Rs", flag: "\u{1F1F3}\u{1F1F5}" },
  TRY: { name: "Turkish Lira", symbol: "\u20BA", flag: "\u{1F1F9}\u{1F1F7}" },
  EGP: { name: "Egyptian Pound", symbol: "E\xA3", flag: "\u{1F1EA}\u{1F1EC}" },
  NGN: { name: "Nigerian Naira", symbol: "\u20A6", flag: "\u{1F1F3}\u{1F1EC}" },
  KES: { name: "Kenyan Shilling", symbol: "KSh", flag: "\u{1F1F0}\u{1F1EA}" },
  ZAR: { name: "South African Rand", symbol: "R", flag: "\u{1F1FF}\u{1F1E6}" },
  CHF: { name: "Swiss Franc", symbol: "CHF", flag: "\u{1F1E8}\u{1F1ED}" },
  SEK: { name: "Swedish Krona", symbol: "kr", flag: "\u{1F1F8}\u{1F1EA}" },
  NOK: { name: "Norwegian Krone", symbol: "kr", flag: "\u{1F1F3}\u{1F1F4}" },
  DKK: { name: "Danish Krone", symbol: "kr", flag: "\u{1F1E9}\u{1F1F0}" },
  PLN: { name: "Polish Z\u0142oty", symbol: "z\u0142", flag: "\u{1F1F5}\u{1F1F1}" },
  BRL: { name: "Brazilian Real", symbol: "R$", flag: "\u{1F1E7}\u{1F1F7}" },
  MXN: { name: "Mexican Peso", symbol: "MX$", flag: "\u{1F1F2}\u{1F1FD}" }
};
const splitMethodLabels = {
  equal: "Equally",
  exact: "Exact amounts",
  percentage: "Percentages",
  shares: "Shares"
};
const expenseCategories = [
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
  "Other"
];
const groupCategories = ["Trip", "Home", "Couple", "Friends", "Work", "Event", "Other"];
const paymentMethods = ["Cash", "Bank Transfer", "Easypaisa", "JazzCash", "PayPal", "Card", "Other"];
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
  note: z.string().max(1e3).optional(),
  category: z.string().trim().min(1).max(64).optional(),
  /** ISO date/time the expense happened. Defaults to now. */
  occurredAt: z.string().datetime({ offset: true }).optional()
};
const createExpenseInputSchema = z.object(expenseFields);
const updateExpenseInputSchema = z.object({ id: z.string().min(1), ...expenseFields });
const createGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(1).max(64).default("Other"),
  currency: currencySchema.default("USD")
});
const updateGroupInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(1).max(64).optional(),
  currency: currencySchema.optional()
});
const addGroupMembersInputSchema = z.object({
  groupId: z.string().min(1),
  /** People who may not have an account yet. Existing users are added directly; others get an invite. */
  emails: z.array(z.string().trim().toLowerCase().email("Enter a valid email address")).max(50).default([]),
  /** Public IDs of people you already share a group with. */
  userIds: z.array(z.string().min(1)).max(50).default([])
});
const createSettlementInputSchema = z.object({
  payerId: z.string().min(1),
  receiverId: z.string().min(1),
  amountMinor: z.number().int().positive(),
  currency: currencySchema,
  groupId: z.string().min(1).optional(),
  paymentMethod: z.string().trim().min(1).max(64).default("Other"),
  note: z.string().trim().max(500).optional()
});
const updateSettlementStatusInputSchema = z.object({
  publicId: z.string().min(1),
  status: z.enum(["paid", "confirmed", "cancelled"])
});
const updateProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty").max(160).optional(),
  defaultCurrency: currencySchema.optional()
});
const notificationPreferenceKeys = [
  "pushEnabled",
  "emailEnabled",
  "inAppEnabled",
  "expenseAlerts",
  "groupAlerts",
  "settlementAlerts",
  "reminderAlerts"
];
const updateNotificationPreferencesInputSchema = z.object(
  Object.fromEntries(notificationPreferenceKeys.map((key) => [key, z.boolean().optional()]))
);
function isCurrencyCode(value) {
  return currencyCodes.includes(value);
}
function toCurrencyCode(value, fallback = "USD") {
  return value && isCurrencyCode(value) ? value : fallback;
}
function groupAccent(category) {
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
export {
  addGroupMembersInputSchema,
  createExpenseInputSchema,
  createGroupInputSchema,
  createSettlementInputSchema,
  currencyCodes,
  currencyInfo,
  expenseCategories,
  groupAccent,
  groupCategories,
  isCurrencyCode,
  notificationPreferenceKeys,
  paymentMethods,
  splitMethodLabels,
  toCurrencyCode,
  updateExpenseInputSchema,
  updateGroupInputSchema,
  updateNotificationPreferencesInputSchema,
  updateProfileInputSchema,
  updateSettlementStatusInputSchema
};
