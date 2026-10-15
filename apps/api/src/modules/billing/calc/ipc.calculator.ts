import {
  Decimal,
  type DecimalInput,
  dec,
  maxDecimal,
  minDecimal,
  roundMoney,
} from '../../../common/money/money.js';

/**
 * Interim payment certificate (overview §7):
 *   gross      = cumulativeWorkDone − previousCertified
 *   retention  = min(gross × retentionPct, contractValue × retentionCapPct − retentionSoFar)
 *   advance    = min(gross × advanceRecoveryPct, advanceAmount − recoveredSoFar)
 *   net        = gross − retention − advance − otherDeductions
 * Retention and advance recovery are never negative (a bill with a negative gross — work done
 * corrected downwards — deducts nothing).
 */
export interface IpcInput {
  /** Σ(latest measurement ≤ periodTo × rate). */
  measuredWorkDone: DecimalInput;
  /** Manual cumulative work done (overrides the measured value). */
  cumulativeOverride?: DecimalInput | null;
  /** Σ gross of the earlier certificates. */
  previousCertified: DecimalInput;
  retentionSoFar: DecimalInput;
  advanceRecoveredSoFar: DecimalInput;
  contractValue: DecimalInput;
  retentionPct: DecimalInput;
  retentionCapPct: DecimalInput;
  advanceAmount: DecimalInput;
  advanceRecoveryPct: DecimalInput;
  otherDeductions?: DecimalInput | null;
}

export interface IpcResult {
  measuredWorkDone: Decimal;
  cumulativeWorkDone: Decimal;
  previousCertified: Decimal;
  grossThisBill: Decimal;
  retentionPct: Decimal;
  retentionCap: Decimal;
  retentionSoFar: Decimal;
  retentionDeducted: Decimal;
  /** The cap limited this bill's retention (or was already reached). */
  retentionCapReached: boolean;
  advanceAmount: Decimal;
  advanceRecoveryPct: Decimal;
  advanceRecoveredSoFar: Decimal;
  advanceRecovered: Decimal;
  /** The whole advance is recovered after this bill. */
  advanceFullyRecovered: boolean;
  otherDeductions: Decimal;
  netPayable: Decimal;
}

const pct = (value: Decimal, p: DecimalInput) => roundMoney(value.times(dec(p)).dividedBy(100));

export function calculateIpc(input: IpcInput): IpcResult {
  const measuredWorkDone = roundMoney(dec(input.measuredWorkDone));
  const hasOverride =
    input.cumulativeOverride !== null &&
    input.cumulativeOverride !== undefined &&
    input.cumulativeOverride !== '';
  const cumulativeWorkDone = hasOverride
    ? roundMoney(dec(input.cumulativeOverride))
    : measuredWorkDone;
  const previousCertified = roundMoney(dec(input.previousCertified));
  const grossThisBill = cumulativeWorkDone.minus(previousCertified);
  const positiveGross = maxDecimal(grossThisBill, 0);

  const retentionSoFar = roundMoney(dec(input.retentionSoFar));
  const retentionCap = pct(dec(input.contractValue), input.retentionCapPct);
  const retentionRoom = maxDecimal(retentionCap.minus(retentionSoFar), 0);
  const retentionWanted = pct(positiveGross, input.retentionPct);
  const retentionDeducted = minDecimal(retentionWanted, retentionRoom);
  const retentionCapReached = retentionWanted.gt(retentionRoom) || retentionRoom.isZero();

  const advanceAmount = roundMoney(dec(input.advanceAmount));
  const advanceRecoveredSoFar = roundMoney(dec(input.advanceRecoveredSoFar));
  const advanceRoom = maxDecimal(advanceAmount.minus(advanceRecoveredSoFar), 0);
  const advanceRecovered = minDecimal(pct(positiveGross, input.advanceRecoveryPct), advanceRoom);
  const advanceFullyRecovered =
    advanceAmount.gt(0) && advanceRecoveredSoFar.plus(advanceRecovered).gte(advanceAmount);

  const otherDeductions = roundMoney(dec(input.otherDeductions));
  const netPayable = grossThisBill
    .minus(retentionDeducted)
    .minus(advanceRecovered)
    .minus(otherDeductions);

  return {
    measuredWorkDone,
    cumulativeWorkDone,
    previousCertified,
    grossThisBill,
    retentionPct: dec(input.retentionPct),
    retentionCap,
    retentionSoFar,
    retentionDeducted,
    retentionCapReached,
    advanceAmount,
    advanceRecoveryPct: dec(input.advanceRecoveryPct),
    advanceRecoveredSoFar,
    advanceRecovered,
    advanceFullyRecovered,
    otherDeductions,
    netPayable,
  };
}

export interface CertificateLike {
  status: string;
  grossThisBill: DecimalInput;
  netPayable: DecimalInput;
  retentionDeducted: DecimalInput;
  advanceRecovered: DecimalInput;
}

export interface PaymentLike {
  kind: string;
  amount: DecimalInput;
}

const BILLED = new Set(['SUBMITTED', 'CERTIFIED', 'PAID']);
const CERTIFIED = new Set(['CERTIFIED', 'PAID']);

/**
 * Project finance summary. Receivable = Σ net of submitted / certified / paid bills − Σ IPC
 * payments (paid bills are included so their payments cancel out). Retention held = Σ retention
 * of those bills − Σ retention releases.
 */
export function financeSummary(input: {
  contractValue: DecimalInput;
  approvedVariations: DecimalInput;
  advanceAmount: DecimalInput;
  certificates: readonly CertificateLike[];
  payments: readonly PaymentLike[];
}) {
  const sumOf = <T>(rows: readonly T[], pick: (r: T) => DecimalInput, keep: (r: T) => boolean) =>
    rows.filter(keep).reduce((acc, r) => acc.plus(dec(pick(r))), new Decimal(0));
  const billed = (c: CertificateLike) => BILLED.has(c.status);
  const paymentsOf = (kind: string) =>
    sumOf(
      input.payments,
      (p) => p.amount,
      (p) => p.kind === kind,
    );

  const contractValue = roundMoney(dec(input.contractValue));
  const approvedVariations = roundMoney(dec(input.approvedVariations));
  const billedNet = sumOf(input.certificates, (c) => c.netPayable, billed);
  const ipcPayments = paymentsOf('IPC_PAYMENT');
  const retentionDeducted = sumOf(input.certificates, (c) => c.retentionDeducted, billed);
  const retentionReleased = paymentsOf('RETENTION_RELEASE');
  const advanceAmount = roundMoney(dec(input.advanceAmount));
  const advanceRecovered = sumOf(input.certificates, (c) => c.advanceRecovered, billed);
  return {
    contractValue,
    approvedVariations,
    effectiveContractValue: contractValue.plus(approvedVariations),
    billedToDate: sumOf(input.certificates, (c) => c.grossThisBill, billed),
    certifiedToDate: sumOf(
      input.certificates,
      (c) => c.grossThisBill,
      (c) => CERTIFIED.has(c.status),
    ),
    received: sumOf(
      input.payments,
      (p) => p.amount,
      () => true,
    ),
    receivable: billedNet.minus(ipcPayments),
    retentionDeducted,
    retentionReleased,
    retentionHeld: retentionDeducted.minus(retentionReleased),
    advanceAmount,
    advanceReceived: paymentsOf('ADVANCE'),
    advanceRecovered,
    advanceBalance: maxDecimal(advanceAmount.minus(advanceRecovered), 0),
  };
}
