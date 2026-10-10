import { currencyInfo, isCurrencyCode, type CurrencyAmount, type CurrencyCode } from "@/shared/domain";

export function formatMoney(amountMinor: number, currency: CurrencyCode | string = "USD", options?: Intl.NumberFormatOptions) {
  const code = isCurrencyCode(currency) ? currency : "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
      ...options,
    }).format(amountMinor / 100);
  } catch {
    // Older Android JS engines may not know "narrowSymbol".
    return `${currencyInfo[code].symbol} ${(amountMinor / 100).toFixed(2)}`;
  }
}

export function formatCompactMoney(amountMinor: number, currency: CurrencyCode | string = "USD") {
  return formatMoney(amountMinor, currency, { notation: "compact", maximumFractionDigits: 1 });
}

/** "Rs 1,200 + $40" style summary for several currencies. */
export function formatAmounts(amounts: CurrencyAmount[], absolute = true) {
  if (!amounts.length) return formatMoney(0);
  return amounts.map((a) => formatMoney(absolute ? Math.abs(a.amountMinor) : a.amountMinor, a.currency)).join(" + ");
}

/**
 * Parses what someone typed into minor units. Accepts "1,250.50", "1250,5", "1 250".
 * Returns NaN for anything that isn't a number.
 */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/\s/g, "");
  if (!cleaned) return Number.NaN;
  // If both separators appear, the last one is the decimal separator.
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized = cleaned;
  if (lastDot !== -1 && lastComma !== -1) {
    normalized = lastDot > lastComma ? cleaned.replace(/,/g, "") : cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1) {
    // "1,250" (thousands) vs "12,5" (decimal): treat a trailing group of exactly 3 digits as thousands.
    normalized = /,\d{3}$/.test(cleaned) && cleaned.split(",").length > 1 ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  }
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === ".") return Number.NaN;
  return Math.round(Number.parseFloat(normalized) * 100);
}

/** Minor units → plain editable text ("1250.5" → "1250.50"). */
export function amountToInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace(/\.00$/, "");
}

/**
 * Picks a font size so `text` fits in `width` pixels on one line (heavy/black weight).
 * Works everywhere, unlike `adjustsFontSizeToFit`, which is iOS-only and ignored on web.
 */
export function fitFontSize(text: string, width: number, max: number, min = 22) {
  let em = 0;
  for (const ch of text) em += /[0-9]/.test(ch) ? 0.64 : /[.,'’\s]/.test(ch) ? 0.3 : /[-–+]/.test(ch) ? 0.45 : 0.7;
  if (em <= 0) return max;
  return Math.max(min, Math.min(max, Math.floor(width / em)));
}
