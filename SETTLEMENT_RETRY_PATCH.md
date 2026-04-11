# Settlement Retry H2 Fix — Multi-Source Verification Patch

## Current Code Location
`app/api/admin/settlement-retry/route.ts` lines ~150-200

## Replace Section

**FIND (around line 153):**
```typescript
    // ── Step 5: On-chain verification before retry ────────────
    // CRITICAL: Before firing sendSol, verify whether a payment from the
    // loser's wallet to the winner's wallet already exists on-chain.
    // If it does, we must NOT send again — that would double-pay.
    // We query Helius for recent signatures from the loser's wallet and
    // check for a transfer to the winner matching the expected amount.
    let alreadyPaidOnChain = false
    try {
      const heliusKey = process.env.HELIUS_API_KEY
      if (heliusKey && loserProfile.sol_address) {
        // ... existing Helius-only verification ...
      }
    } catch (verifyErr) {
      // ... existing error handling ...
    }

    // ── Step 6: Retry sendSol (only if not already paid on-chain) ──
```

**REPLACE WITH:**
```typescript
    // ── Step 5: Multi-Source On-Chain Verification (H2 FIX) ────
    import { verifySettlementOnChain, shouldRetrySettlement } from '@/lib/settlement-verification'

    const verification = await verifySettlementOnChain(
      loserProfile.sol_address,
      winnerProfile.sol_address,
      winnerPayout,
      houseFee
    )

    // If payment already detected on-chain, reconcile DB and skip sendSol
    if (verification.verified) {
      console.log(`[SettlementRetry] ${verification.source?.toUpperCase()}: Payment confirmed on-chain (${verification.signature})`)
      
      const { error: dbFixErr } = await supabaseAdmin.rpc('settle_match_db', {
        p_match_id: matchId,
        p_winner_id: winnerId,
        p_loser_id: loserId,
        p_entry_fee: entryFeeSol,
        p_winner_payout: winnerPayout,
        p_settlement_tx: verification.signature ?? 'recovered-onchain-verified',
      })

      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'settlement_recovered_onchain',
        metadata: {
          source: verification.source,
          signature: verification.signature,
          confidence: verification.confidence,
          details: verification.details,
          note: 'On-chain payment verified — DB reconciled without re-sending',
        },
      })

      results.push({
        matchId,
        action: 'already_settled',
        details: `${verification.source?.toUpperCase()} verified — sig: ${verification.signature}`,
      })
      continue
    }

    // If verification failed (Helius down + RPC down), DO NOT retry
    // Fail-safe: better to delay settlement than risk double-payment
    if (!shouldRetrySettlement(verification)) {
      console.error(`[SettlementRetry] Verification failed for match ${matchId} — cannot safely retry`)
      
      await incrementRetry(matchId, retryCount, `On-chain verification failed (${verification.confidence}): ${verification.details}`)
      
      await supabaseAdmin.from('audit_log').insert({
        match_id: matchId,
        event_type: 'settlement_retry_blocked_verification_failed',
        metadata: {
          confidence: verification.confidence,
          details: verification.details,
          note: 'All verification sources failed — cannot confirm payment status. Manual review required.',
        },
      })

      results.push({
        matchId,
        action: 'retry_failed',
        details: `Verification unavailable (${verification.confidence}) — skipped for safety`,
      })
      continue
    }

    // ── Step 6: Retry sendSol (verified safe to retry) ──────────
    console.log(`[SettlementRetry] All sources confirm no payment — safe to retry match ${matchId}`)
```

## Add Import at Top of File

```typescript
import { verifySettlementOnChain, shouldRetrySettlement } from '@/lib/settlement-verification'
```

## Benefits

1. **Multi-source verification:** Helius + Solana RPC + balance delta
2. **Fail-safe policy:** If verification fails, DO NOT retry (prevents double-payment risk)
3. **Better logging:** Records which source confirmed payment
4. **Audit trail:** All verification attempts logged to audit_log
5. **Configurable tolerance:** ±1000 lamports for rounding differences

## Testing

After applying patch:

1. Manually mark a settled match as `settlement_failed` (keep settlement_tx)
2. Run retry worker
3. Expected: Helius detects existing payment, reconciles DB, does NOT call sendSol
4. Check audit_log for `settlement_recovered_onchain` event
5. Verify match status = 'settled', no duplicate payment

## Rollout

1. Apply patch
2. Deploy to staging
3. Test with 1-2 real failed settlements
4. Monitor for 24h
5. Deploy to production
