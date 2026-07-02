import { describe, expect, it } from 'vitest';
import { daysLeft, statusOf } from './status';

const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

describe('RAG status from expiry', () => {
  it('green when more than 30 days away', () => {
    expect(statusOf(shift(31))).toBe('green');
    expect(statusOf(shift(365))).toBe('green');
  });
  it('amber at 30 days or fewer', () => {
    expect(statusOf(shift(30))).toBe('amber');
    expect(statusOf(shift(1))).toBe('amber');
    expect(statusOf(shift(0))).toBe('amber'); // expires today = still valid, act now
  });
  it('red once expired', () => {
    expect(statusOf(shift(-1))).toBe('red');
  });
  it('daysLeft is calendar-day based', () => {
    expect(daysLeft(shift(0))).toBe(0);
    expect(daysLeft(shift(7))).toBe(7);
  });
});
