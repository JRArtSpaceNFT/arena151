# PUMP LAB — Full Process Audit & Operating Standard

**Audit version:** 2026-10-01-process-audit  
**Current research era:** v3.2-process-audit  
**Scope:** ingestion → normalization → scoring → entries → sizing → execution → exits → research → persistence → dashboard → deployment → eventual live launch.

## 1. Mission and non-negotiable principle

PUMP LAB is a paper-trading research laboratory first. A profitable dashboard is not proof that a live bot is ready. Paper results count only when the data, marks, execution assumptions, persistence, and evaluation methodology are all credible.

Production capital must never be exposed merely because a strategy has a high paper balance. The live gate requires independent holdout evidence, operational reliability, realistic execution costs, fresh marks, and a shadow-execution period.

## 2. Market-data pipeline

Current inputs include Pump.fun snapshots, DexScreener enrichment and open-position marks, Solana RPC/WebSocket observations, creator history, tracked-wallet observations, and optional PumpPortal realtime data.

### Required controls
- Preserve source timestamps and source identity.
- Reject stale flow/liquidity rather than silently carrying it forward.
- Cross-check high-conviction strategies across independent sources.
- Dedicated refresh path for every open mint.
- Track provider health, freshness, and coverage.
- Do not treat metadata presence as social sentiment.
- Do not invent wallet ownership or copy-trader identity.

### Remaining launch blockers
- Use a production-grade dedicated Solana RPC before real-money launch.
- Connect/validate the intended realtime Pump.fun/PumpPortal path.
- Add real social-stream data only if its provenance and latency can be measured.

## 3. Token normalization and data truth

Every token is normalized into one canonical record containing price, market cap, liquidity, flow, volume, lifecycle, creator, social metadata, venue/pair metadata, source freshness, and history.

Unknown data must remain unknown. Zero must never be used as a substitute for “not observed” in a way that improves a score.

Runtime token memory is bounded and stale non-position tokens are pruned. Open-position mints are retained.

## 4. Feature engineering and risk

Signals include momentum, acceleration, buy pressure, transaction depth, liquidity, volume, token age, lifecycle, social metadata, creator DNA, source quality, drawdown/rebound, wallet evidence, and structural/adversarial risk.

### Audit rules
- Freshness is part of every market signal.
- Creator history is observational, not an identity guarantee.
- Correlated inputs should not be counted as independent evidence.
- High-confidence strategies require stronger data quality than exploratory scouts.
- Missing holder concentration / bundle / sniper ownership remains a known blind spot unless directly observed.

## 5. Entry decision process

A token must pass:
1. strategy population eligibility,
2. authored playbook floor,
3. fresh market-data requirements,
4. data-quality requirements,
5. structural/adversarial risk checks,
6. market-regime adjustments,
7. strategy-specific confirmation,
8. bankroll risk circuit,
9. adaptive sizing,
10. execution/slippage veto.

Abstaining is a valid outcome. PUMP LAB must not relax a production threshold merely to force trades.

## 6. Position sizing

Normal paper entries target roughly 10% of current bankroll before modifiers. Scout/copy experiments remain smaller.

Sizing adjusts for:
- confidence above the gate,
- data quality,
- adversarial risk,
- regime,
- market cap,
- token age,
- observed volatility,
- DNA similarity evidence,
- strategy health,
- loss streak,
- current drawdown,
- rolling P&L,
- allocator evidence,
- liquidity,
- stop distance,
- total open exposure,
- narrative concentration,
- creator concentration.

Hard caps remain more important than upside conviction.

## 7. Execution realism

PUMP LAB models:
- lifecycle-aware Pump/PumpSwap platform fees where venue data permits,
- conservative 1.25% fallback when fee tier cannot be established,
- modeled price impact/slippage based on position size and liquidity,
- volatility slippage,
- configurable fixed transaction/network friction,
- per-trade execution metadata,
- execution veto for extreme modeled slippage.

Before real launch, paper execution must be replaced/validated against actual executable route quotes. Solana network and priority fees, failed transactions, expired blockhashes, retries, route changes, and MEV effects must be measured during shadow execution.

## 8. Marking and exits

Equity must represent executable value, not the last attractive price seen.

Stale marks now decay toward zero after the freshness warning window. Positions that remain unpriceable through the zero window are written off rather than held forever at an old price.

Exit logic includes stop loss, catastrophic thesis break, flow/momentum fade, take profit, trailing protection, time exit, copy-source exits, and scale-outs.

Future work should compare exit decisions against route-level executable prices, not only observed midpoint/last price.

## 9. Portfolio and kill switches

New entries are blocked when:
- durable state has not restored,
- persistence has been unavailable beyond its grace period,
- strategy max drawdown is exceeded,
- rolling 24-hour strategy loss exceeds the configured limit,
- modeled slippage exceeds the execution ceiling,
- strategy-specific evidence gates fail.

Existing positions may still be managed/exited while new risk is blocked.

## 10. Research methodology

Tokens are assigned deterministically to an 80/20 train/holdout split by mint.

**Training set:** may influence learned thresholds, recent strategy health, regime weighting, and dynamic allocation.  
**Holdout set:** must not influence those learned production decisions and is used to judge generalization.

Challengers need at least 60 post-audit trades and 12 holdout trades before evaluation. Holdout profitability, profit factor, tail behavior, and edge versus the parent are required for promotion-candidate status.

Automatic production promotion is disabled by default. A challenger can earn candidate status without silently rewriting production.

## 11. Controls and benchmarks

The random control is deterministic per mint. It does not reroll on every market tick, which would otherwise make it eventually buy nearly everything.

Simple volume, launch, and metadata controls remain useful only as benchmarks. They should never be mixed into production performance.

## 12. Persistence and recovery

Postgres is canonical durable state.

Rules:
- No trading before initial durable restore.
- Database writes are serialized; overlapping state writes are forbidden.
- Closed positions are removed from the active-position collection after being copied into trade history.
- State memory and opportunity memory are bounded/pruned.
- A database outage beyond the configured grace window locks new trading.
- Restarts must preserve bankroll, trades, open positions, and research history.
- Staging is a read-only mirror of canonical production state; it must not maintain a competing bankroll universe.

## 13. Dashboard and observability

Dashboard health is separate from trading-engine health.

The API records state-build time and payload size. The Research Lab includes a Process Audit & Live Launch Gate with:
- critical blockers,
- warnings,
- passed safeguards,
- stale-position count,
- state payload/build cost,
- persistence state,
- qualified holdout strategies.

A blank dashboard must never be interpreted as zero trades or a reset.

## 14. Live-launch gate

Real money remains blocked until all critical audit blockers are cleared.

Minimum strategy evidence:
- at least 20 holdout trades for a candidate,
- positive holdout mean,
- holdout profit factor above 1.10,
- drawdown below configured maximum,
- no unresolved stale positions,
- healthy market-data providers.

Operational requirements:
- dedicated production RPC,
- validated realtime token feed,
- shadow execution with real quotes and no real orders,
- reconciliation of quoted versus observed fills,
- transaction failure/retry accounting,
- wallet/key security review,
- explicit global kill switch,
- maximum daily loss and per-trade exposure limits,
- alerting for persistence/data/execution failures.

## 15. Recommended launch sequence

1. **Paper research:** accumulate post-audit train/holdout evidence.
2. **Shadow execution:** construct real transactions/routes and record expected fills/fees without signing or broadcasting.
3. **$100 canary:** only after the live gate passes; one strategy, strict caps, no autonomous scaling.
4. **Review period:** compare live fill quality and P&L with shadow/paper predictions.
5. **Controlled scaling:** increase capital only after enough real execution evidence; never because of a short hot streak.

## 16. Highest-priority remaining backlog

1. Dedicated Solana RPC and realtime feed redundancy.
2. True shadow-execution engine with executable route quotes.
3. Transaction failure/retry/priority-fee telemetry.
4. Holder concentration, bundle/sniper and linked-wallet risk data.
5. Stronger source-independence scoring.
6. Walk-forward regime testing across longer time windows.
7. Strategy-specific live deployment packaging rather than deploying the whole research lab.
8. Key-management design that keeps signing authority isolated from the research dashboard.
9. Automated incident alerts for stale marks, provider failure, persistence lock, and abnormal drawdown.
10. A formal canary/live rollback procedure.

## 17. Current status

PUMP LAB should be treated as **PAPER RESEARCH ONLY** until the dashboard's Live Launch Gate explicitly clears all blockers. A paper strategy can look strong and still fail live due to latency, fees, failed transactions, liquidity, data gaps, or overfitting. The purpose of this audit architecture is to force those differences into the system rather than hide them.
