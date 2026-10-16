/** Compact money for headlines: $283.8M, −$29.2M, $12K. Receipts show full precision instead. */
export function shortMoney(value: number, digits = 1): string {
  const sign = value < 0 ? '−' : '';
  const a = Math.abs(value);
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${a.toLocaleString('en-US')}`;
}
