// Public, read-only GeckoTerminal pool fallback for previously opened paper positions.
// It is never used to start a position; a pool without observed 5m trading is not a fill.
export function bestGeckoExitPool(payload, mint, minReserveUsd = 5000) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(mint || ''))) return null;
  const pools = Array.isArray(payload?.data) ? payload.data : [];
  const eligible = [];
  for (const pool of pools) {
    const a = pool?.attributes || {};
    const base = pool?.relationships?.base_token?.data?.id;
    const quote = pool?.relationships?.quote_token?.data?.id;
    const baseMatch = base === 'solana_' + mint;
    const quoteMatch = quote === 'solana_' + mint;
    // Do not guess token side if the provider does not identify the asset.
    if (!baseMatch && !quoteMatch) continue;
    const price = Number(baseMatch ? a.base_token_price_usd : a.quote_token_price_usd);
    const reserve = Number(a.reserve_in_usd);
    const buys = Number(a.transactions?.m5?.buys || 0);
    const sells = Number(a.transactions?.m5?.sells || 0);
    const volume = Number(a.volume_usd?.m5 || 0);
    if (!Number.isFinite(price) || price <= 0 ||
        !Number.isFinite(reserve) || reserve < minReserveUsd ||
        !Number.isFinite(volume) || volume <= 0 ||
        !Number.isFinite(buys + sells) || buys + sells < 1) continue;
    eligible.push({
      mint, priceUsd: price, marketCapUsd: Number(a.market_cap_usd || a.fdv_usd || 0),
      liquidityUsd: reserve, volume: { m5: volume },
      txns: { m5: { buys, sells } }, buys, sells,
      poolAddress: a.address || '', observedTradeWindow: 'm5',
      quoteSide: baseMatch ? 'base' : 'quote',
      evidence: 'pool-reported-price-liquidity-and-5m-trades'
    });
  }
  eligible.sort((x,y)=>y.liquidityUsd-x.liquidityUsd);
  return eligible[0] || null;
}
export function quoteRecoveryCandidates(positions, lookup, nowMs, max = 4) {
  const best = new Map();
  for(const p of positions) {
    if (!p || p.closed || typeof p.mint !== 'string') continue;
    const d = lookup(p);
    const overdueMs = Math.max(0, nowMs - Number(p.opened || nowMs) - Math.max(0, Number(d?.maxHoldMinutes || 60))*60_000);
    const ageMs = Math.max(0, nowMs - Number(p.lastMarkedAt || p.opened || nowMs));
    if(overdueMs === 0 && ageMs < 120_000) continue;
    const prev = best.get(p.mint);
    const priority = overdueMs + Math.min(ageMs, 86_400_000);
    if(!prev || prev.priority < priority) best.set(p.mint,{mint:p.mint,priority});
  }
  return [...best.values()].sort((a,b)=>b.priority-a.priority).slice(0,max).map(x=>x.mint);
}
