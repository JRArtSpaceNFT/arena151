// Pump Lab v2: isolated, dependency-free measurement integrity primitives.
// IMPORTANT: Research-only module. Does not submit orders or modify live trading.
export const V2_INTEGRITY_VERSION = 'v2.0.0';

export function validateQuote(quote, { nowMs = Date.now(), prior = null, maxAgeMs = 5000 } = {}) {
  const reasons = [];
  if (!quote || typeof quote !== 'object') return { ok: false, reasons: ['MISSING_QUOTE'] };
  if (typeof quote.mint !== 'string' || quote.mint.length < 32) reasons.push('INVALID_MINT');
  if (!Number.isFinite(quote.price) || quote.price <= 0) reasons.push('INVALID_PRICE');
  if (!Number.isFinite(quote.observedAtMs)) reasons.push('MISSING_OBSERVATION_TIME');
  else {
    if (quote.observedAtMs > nowMs + 1000) reasons.push('FUTURE_QUOTE');
    if (nowMs - quote.observedAtMs > maxAgeMs) reasons.push('STALE_QUOTE');
  }
  if (prior && prior.mint === quote.mint && prior.price === quote.price)
    reasons.push('UNCHANGED_PRICE'); // Per v2 plan; may be conservative in flat markets.
  if (prior && prior.mint === quote.mint && Number.isFinite(prior.observedAtMs) &&
      quote.observedAtMs <= prior.observedAtMs) reasons.push('NON_MONOTONIC_TIME');
  return { ok: reasons.length === 0, reasons };
}

// An uncertain fill must never silently become a total loss.
export function classifyMark({ entryPrice, latestPrice, latestObservedAtMs, nowMs = Date.now(), maxAgeMs = 5000 }) {
  if (!(entryPrice > 0) || !Number.isFinite(entryPrice)) return { status: 'UNCERTAIN', reason: 'BAD_ENTRY' };
  if (!(latestPrice > 0) || !Number.isFinite(latestPrice)) return { status: 'UNCERTAIN', reason: 'NO_VALID_MARK' };
  if (!Number.isFinite(latestObservedAtMs) || latestObservedAtMs > nowMs + 1000 ||
      nowMs - latestObservedAtMs > maxAgeMs) return { status: 'UNCERTAIN', reason: 'STALE_MARK' };
  return { status: 'MARKED', grossReturnFraction: latestPrice / entryPrice - 1 };
}

// Audits LONG trades using observed intratrade minimum and explicit realized costs.
// A flag means audit required, not automatic proof that the ledger is wrong:
// slippage/unobserved ticks can explain differences and must be separately recorded.
export function reconcileClosedLongTrade({
  entryPrice, exitPrice, minObservedPrice, realizedNetReturnFraction,
  entryFeeFraction = 0, exitFeeFraction = 0, otherCostsFraction = 0, tolerance = 0.002
}) {
  const nums = [entryPrice, exitPrice, minObservedPrice, realizedNetReturnFraction,
    entryFeeFraction, exitFeeFraction, otherCostsFraction, tolerance];
  if (nums.some(v => !Number.isFinite(v)) || entryPrice <= 0 || exitPrice <= 0 ||
      minObservedPrice <= 0 || [entryFeeFraction, exitFeeFraction, otherCostsFraction, tolerance].some(v => v < 0))
    return { status: 'UNCERTAIN', reasons: ['INVALID_OR_MISSING_ACCOUNTING_INPUT'] };
  const observedWorstGrossReturn = minObservedPrice / entryPrice - 1;
  const totalCosts = entryFeeFraction + exitFeeFraction + otherCostsFraction;
  const worstExplainedNetReturn = observedWorstGrossReturn - totalCosts;
  const pricePathViolation = exitPrice < minObservedPrice * (1 - tolerance);
  const netReturnViolation = realizedNetReturnFraction < worstExplainedNetReturn - tolerance;
  return {
    status: (pricePathViolation || netReturnViolation) ? 'REVIEW_REQUIRED' : 'CONSISTENT_WITH_OBSERVATIONS',
    reasons: [pricePathViolation && 'EXIT_BELOW_OBSERVED_MAE', netReturnViolation && 'LOSS_EXCEEDS_MAE_PLUS_COSTS'].filter(Boolean),
    observedWorstGrossReturn, worstExplainedNetReturn, totalCosts
  };
}

export function validateSignalSnapshot(snapshot, { decisionAtMs } = {}) {
  const reasons = [];
  if (!Number.isFinite(decisionAtMs)) reasons.push('MISSING_DECISION_TIME');
  if (!snapshot || typeof snapshot !== 'object') reasons.push('MISSING_SNAPSHOT');
  else {
    if (!Number.isFinite(snapshot.featureObservedAtMs)) reasons.push('MISSING_FEATURE_TIME');
    else if (Number.isFinite(decisionAtMs) && snapshot.featureObservedAtMs > decisionAtMs) reasons.push('LOOKAHEAD_FEATURE');
    if (!snapshot.strategyVersion || !snapshot.strategyId) reasons.push('UNVERSIONED_SIGNAL');
    if (!snapshot.mint) reasons.push('MISSING_MINT');
  }
  return { ok: reasons.length === 0, reasons };
}
