// Formats numbers to a maximum of N significant digits, using K/M/B suffix when helpful.
// Also exposes a currency variant that prepends a currency symbol.

const SUFFIXES = [
  { v: 1e9, s: 'B' },
  { v: 1e6, s: 'M' },
  { v: 1e3, s: 'k' },
];

export function formatAmountShort(value, opts = {}) {
  const { maxDigits = 5, minFraction = 0, maxFraction = 3, useSuffix = true } = opts;
  let num = Number(value || 0);
  if (!isFinite(num)) num = 0;

  // Handle negatives gracefully
  const isNegative = num < 0;
  const sign = isNegative ? '-' : '';
  num = Math.abs(num);

  let suffix = '';
  let scaled = num;
  if (useSuffix) {
    for (const { v, s } of SUFFIXES) {
      if (num >= v) {
        scaled = num / v;
        suffix = s;
        break;
      }
    }
  }

  // Determine fraction digits so total numeric digits (int + frac) <= maxDigits
  // Count integer digits
  const intDigits = Math.max(1, Math.floor(Math.log10(Math.max(1, scaled))) + 1);
  let allowedFrac = Math.max(0, maxDigits - intDigits);
  allowedFrac = Math.min(allowedFrac, maxFraction);
  allowedFrac = Math.max(allowedFrac, minFraction);

  // Round values: standard rounding for positive, truncate toward 0 for negative
  let numericRounded;
  if (allowedFrac === 0) {
    numericRounded = isNegative ? Math.floor(scaled) : Math.round(scaled);
  } else {
    const factor = Math.pow(10, allowedFrac);
    numericRounded = isNegative
      ? Math.floor(scaled * factor) / factor
      : Number(scaled.toFixed(allowedFrac));
  }
  const rounded = numericRounded.toFixed(allowedFrac);

  // Remove trailing zeros if we exceeded minFraction
  let trimmed = rounded;
  if (allowedFrac > minFraction) {
    trimmed = rounded.replace(/(\.\d*?[1-9])0+$/,'$1').replace(/\.0+$/,'');
  }

  return `${sign}${trimmed}${suffix}`;
}

export function formatCurrencyShort(value, opts = {}) {
  const { symbol = '$', ...rest } = opts;
  // We prepend symbol and rely on formatAmountShort to keep digits <= maxDigits
  const numeric = formatAmountShort(value, rest);
  return `${symbol}${numeric}`;
}

export default formatCurrencyShort;
