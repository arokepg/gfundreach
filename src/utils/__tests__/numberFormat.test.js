import { describe, it, expect } from 'vitest';
import { formatAmountShort, formatCurrencyShort } from '../../utils/numberFormat';

describe('numberFormat', () => {
  it('limits to 5 digits including decimals', () => {
    expect(formatAmountShort(123.4567, { maxDigits: 5 })).toBe('123.46');
    expect(formatAmountShort(12345.678, { maxDigits: 5 })).toBe('12.346k');
    expect(formatAmountShort(999, { maxDigits: 5 })).toBe('999');
    expect(formatAmountShort(1000000, { maxDigits: 5 })).toBe('1M');
  });

  it('handles negative values', () => {
    expect(formatAmountShort(-1234.56, { maxDigits: 5 })).toBe('-1.234k');
  });

  it('currency variant adds symbol', () => {
    expect(formatCurrencyShort(1234.56, { maxDigits: 5 })).toBe('$1.235k');
  });
});
