// Runtime-only admission and memory guardrails. No trading-state mutation.
export const MIB = 1024 * 1024;
export function memoryReport(usage, budgetMiB = 512) {
  const budgetBytes = Math.max(64, Number(budgetMiB) || 512) * MIB;
  const rssBytes = Math.max(0, Number(usage?.rss) || 0);
  const heapUsedBytes = Math.max(0, Number(usage?.heapUsed) || 0);
  const fraction = rssBytes / budgetBytes;
  return {
    rssMiB: Math.round(rssBytes / MIB),
    heapUsedMiB: Math.round(heapUsedBytes / MIB),
    budgetMiB: budgetBytes / MIB,
    rssFraction: Math.round(fraction * 1000) / 1000,
    pressure: fraction >= .93 ? 'CRITICAL' : fraction >= .80 ? 'HIGH' : fraction >= .68 ? 'ELEVATED' : 'NORMAL'
  };
}
export function rejectSlowStream(client, maxBufferedBytes = 512 * 1024) {
  return Boolean(!client || client.destroyed || client.writableEnded ||
    (Number(client.writableLength) || 0) > maxBufferedBytes);
}
export function reuseSnapshotUnderPressure({ageMs,hasSnapshot,pressure}) {
  if(!hasSnapshot || ageMs < 0) return false;
  const ttl = pressure === 'CRITICAL' ? 5 * 60_000
    : pressure === 'HIGH' ? 2 * 60_000 : 30_000;
  return ageMs < ttl;
}
