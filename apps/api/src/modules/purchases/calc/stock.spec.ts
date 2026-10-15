import { describe, expect, it } from 'vitest';
import { lineAmount, stockLevel, stockRow, weightedAverageCost } from './stock.js';

describe('lineAmount', () => {
  it.each([
    ['10', '2150.00', '21500.00'],
    ['2.5', '18500', '46250.00'],
    ['0.333', '100.01', '33.30'],
    ['1.005', '1', '1.01'],
  ])('%s × %s = %s', (q, p, expected) => {
    expect(lineAmount(q, p).toFixed(2)).toBe(expected);
  });
});

describe('weightedAverageCost', () => {
  it('weights by quantity', () => {
    // 100 bags at 2,100 + 50 bags at 2,250 → 322,500 / 150 = 2,150
    expect(
      weightedAverageCost([
        { quantity: '100', amount: '210000' },
        { quantity: '50', amount: '112500' },
      ]).toFixed(2),
    ).toBe('2150.00');
  });

  it('rounds half-up to cents', () => {
    expect(weightedAverageCost([{ quantity: '3', amount: '100' }]).toFixed(2)).toBe('33.33');
    expect(weightedAverageCost([{ quantity: '8', amount: '1' }]).toFixed(2)).toBe('0.13');
  });

  it('is 0 without purchases', () => {
    expect(weightedAverageCost([]).toFixed(2)).toBe('0.00');
    expect(weightedAverageCost([{ quantity: '0', amount: '0' }]).toFixed(2)).toBe('0.00');
  });
});

describe('stock', () => {
  it('stock = purchased − issued', () => {
    expect(stockLevel('150', '62.5').toString()).toBe('87.5');
    expect(stockLevel('10', '10').toString()).toBe('0');
  });

  it('stock row values the stock at the average cost', () => {
    const r = stockRow({ purchasedQty: '150', purchasedAmount: '322500', issuedQty: '40' });
    expect(r.stock.toString()).toBe('110');
    expect(r.averageCost.toFixed(2)).toBe('2150.00');
    expect(r.value.toFixed(2)).toBe('236500.00');
  });
});
