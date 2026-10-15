import { describe, expect, it } from 'vitest';
import { type IpcInput, calculateIpc, financeSummary } from './ipc.calculator.js';

/** A 10,000,000 contract, 10% retention capped at 5% (500,000), 20% advance recovered at 25%. */
const base: IpcInput = {
  measuredWorkDone: '0',
  previousCertified: '0',
  retentionSoFar: '0',
  advanceRecoveredSoFar: '0',
  contractValue: '10000000',
  retentionPct: '10',
  retentionCapPct: '5',
  advanceAmount: '2000000',
  advanceRecoveryPct: '25',
};

const money = (r: ReturnType<typeof calculateIpc>) => ({
  cumulative: r.cumulativeWorkDone.toFixed(2),
  gross: r.grossThisBill.toFixed(2),
  retention: r.retentionDeducted.toFixed(2),
  advance: r.advanceRecovered.toFixed(2),
  other: r.otherDeductions.toFixed(2),
  net: r.netPayable.toFixed(2),
});

describe('calculateIpc', () => {
  it.each([
    {
      name: 'first bill',
      input: { ...base, measuredWorkDone: '2000000' },
      expected: {
        cumulative: '2000000.00',
        gross: '2000000.00',
        retention: '200000.00',
        advance: '500000.00',
        other: '0.00',
        net: '1300000.00',
      },
      capReached: false,
      fullyRecovered: false,
    },
    {
      name: 'a later bill (previous bills deducted)',
      input: {
        ...base,
        measuredWorkDone: '3500000',
        previousCertified: '2000000',
        retentionSoFar: '200000',
        advanceRecoveredSoFar: '500000',
      },
      expected: {
        cumulative: '3500000.00',
        gross: '1500000.00',
        retention: '150000.00',
        advance: '375000.00',
        other: '0.00',
        net: '975000.00',
      },
      capReached: false,
      fullyRecovered: false,
    },
    {
      name: 'retention cap reached mid-bill',
      input: {
        ...base,
        measuredWorkDone: '6000000',
        previousCertified: '4500000',
        retentionSoFar: '450000',
        advanceRecoveredSoFar: '1125000',
      },
      // 10% of 1.5M = 150,000 but only 50,000 left under the 500,000 cap
      expected: {
        cumulative: '6000000.00',
        gross: '1500000.00',
        retention: '50000.00',
        advance: '375000.00',
        other: '0.00',
        net: '1075000.00',
      },
      capReached: true,
      fullyRecovered: false,
    },
    {
      name: 'cap already reached: no more retention',
      input: {
        ...base,
        measuredWorkDone: '7000000',
        previousCertified: '6000000',
        retentionSoFar: '500000',
        advanceRecoveredSoFar: '1500000',
      },
      expected: {
        cumulative: '7000000.00',
        gross: '1000000.00',
        retention: '0.00',
        advance: '250000.00',
        other: '0.00',
        net: '750000.00',
      },
      capReached: true,
      fullyRecovered: false,
    },
    {
      name: 'advance fully recovered (only the remaining balance is taken)',
      input: {
        ...base,
        measuredWorkDone: '9000000',
        previousCertified: '7000000',
        retentionSoFar: '500000',
        advanceRecoveredSoFar: '1750000',
      },
      // 25% of 2M = 500,000 but only 250,000 still owed
      expected: {
        cumulative: '9000000.00',
        gross: '2000000.00',
        retention: '0.00',
        advance: '250000.00',
        other: '0.00',
        net: '1750000.00',
      },
      capReached: true,
      fullyRecovered: true,
    },
    {
      name: 'other deductions',
      input: { ...base, measuredWorkDone: '1000000', otherDeductions: '12500.50' },
      expected: {
        cumulative: '1000000.00',
        gross: '1000000.00',
        retention: '100000.00',
        advance: '250000.00',
        other: '12500.50',
        net: '637499.50',
      },
      capReached: false,
      fullyRecovered: false,
    },
    {
      name: 'a manual cumulative override',
      input: { ...base, measuredWorkDone: '1000000', cumulativeOverride: '1200000.25' },
      expected: {
        cumulative: '1200000.25',
        gross: '1200000.25',
        retention: '120000.03',
        advance: '300000.06',
        other: '0.00',
        net: '780000.16',
      },
      capReached: false,
      fullyRecovered: false,
    },
    {
      name: 'a project without an advance',
      input: { ...base, advanceAmount: '0', advanceRecoveryPct: '0', measuredWorkDone: '500000' },
      expected: {
        cumulative: '500000.00',
        gross: '500000.00',
        retention: '50000.00',
        advance: '0.00',
        other: '0.00',
        net: '450000.00',
      },
      capReached: false,
      fullyRecovered: false,
    },
    {
      name: 'a negative gross deducts no retention or advance',
      input: {
        ...base,
        measuredWorkDone: '900000',
        previousCertified: '1000000',
        retentionSoFar: '100000',
        advanceRecoveredSoFar: '250000',
      },
      expected: {
        cumulative: '900000.00',
        gross: '-100000.00',
        retention: '0.00',
        advance: '0.00',
        other: '0.00',
        net: '-100000.00',
      },
      capReached: false,
      fullyRecovered: false,
    },
  ])('$name', ({ input, expected, capReached, fullyRecovered }) => {
    const r = calculateIpc(input);
    expect(money(r)).toEqual(expected);
    expect(r.retentionCapReached).toBe(capReached);
    expect(r.advanceFullyRecovered).toBe(fullyRecovered);
    expect(r.retentionCap.toFixed(2)).toBe(
      input.contractValue === '10000000' ? '500000.00' : r.retentionCap.toFixed(2),
    );
  });

  it('an empty override uses the measured value', () => {
    expect(
      calculateIpc({
        ...base,
        measuredWorkDone: '100',
        cumulativeOverride: '',
      }).cumulativeWorkDone.toFixed(2),
    ).toBe('100.00');
  });
});

describe('financeSummary', () => {
  it('receivable, retention held and advance balance', () => {
    const s = financeSummary({
      contractValue: '10000000',
      approvedVariations: '250000',
      advanceAmount: '2000000',
      certificates: [
        {
          status: 'PAID',
          grossThisBill: '2000000',
          netPayable: '1300000',
          retentionDeducted: '200000',
          advanceRecovered: '500000',
        },
        {
          status: 'CERTIFIED',
          grossThisBill: '1500000',
          netPayable: '975000',
          retentionDeducted: '150000',
          advanceRecovered: '375000',
        },
        {
          status: 'SUBMITTED',
          grossThisBill: '1000000',
          netPayable: '650000',
          retentionDeducted: '100000',
          advanceRecovered: '250000',
        },
        // drafts never count
        {
          status: 'DRAFT',
          grossThisBill: '999',
          netPayable: '999',
          retentionDeducted: '99',
          advanceRecovered: '99',
        },
      ],
      payments: [
        { kind: 'ADVANCE', amount: '2000000' },
        { kind: 'IPC_PAYMENT', amount: '1300000' },
        { kind: 'IPC_PAYMENT', amount: '500000' },
        { kind: 'RETENTION_RELEASE', amount: '50000' },
      ],
    });
    const out = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.toFixed(2)]));
    expect(out).toEqual({
      contractValue: '10000000.00',
      approvedVariations: '250000.00',
      effectiveContractValue: '10250000.00',
      billedToDate: '4500000.00',
      certifiedToDate: '3500000.00',
      received: '3850000.00',
      receivable: '1125000.00', // 2,925,000 − 1,800,000
      retentionDeducted: '450000.00',
      retentionReleased: '50000.00',
      retentionHeld: '400000.00',
      advanceAmount: '2000000.00',
      advanceReceived: '2000000.00',
      advanceRecovered: '1125000.00',
      advanceBalance: '875000.00',
    });
  });

  it('an empty project is all zero', () => {
    const s = financeSummary({
      contractValue: '0',
      approvedVariations: '0',
      advanceAmount: '0',
      certificates: [],
      payments: [],
    });
    expect(Object.values(s).every((v) => v.isZero())).toBe(true);
  });
});
