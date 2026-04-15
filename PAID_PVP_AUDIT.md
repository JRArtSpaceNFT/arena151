# Paid PvP End-to-End Audit
**Real Money Battle Flow Verification**  
*Updated: April 14, 2026 7:57 PM PST*

---

## 🎯 CRITICAL: Real Money Flow

This document audits the ENTIRE paid PvP battle flow from wallet balance check to SOL payout.

### Complete Flow (Expected)

```
1. Room Select → Player clicks "Quick Match $X SOL"
2. Balance Check → Verify player has sufficient SOL
3. Fund Lock → Deduct entry fee from player balance (escrow)
4. Queue → Start matchmaking
5. Match Found → Server pairs two players, creates match record
6. Versus Screen → 4s dramatic reveal of both players
7. GameWrapper Mount → Detects serverMatchId, routes to arena_reveal
8. Arena Reveal → 8s spinning animation + battle music
9. Battle Computation → Server-deterministic with canonical seed
10. Battle Screen → Same animations/VFX as practice mode
11. Victory/Defeat → Winner celebration, loser commiseration
12. Auto-Settlement → Server pays winner 2x entry fee
13. Results Screen → Shows SOL won/lost + stats
14. Balance Update → Winner sees +SOL, loser sees locked funds gone
```

---

## 📋 Step-by-Step Verification Checklist

### ✅ Step 1-2: Entry & Balance Check

**Location:** `components/RoomSelect.tsx` → Queue button click

**Verify:**
- [ ] Entry fee displayed correctly for each room tier
- [ ] Balance check happens BEFORE queue starts
- [ ] Insufficient balance shows error, prevents queue
- [ ] No duplicate charges if user clicks multiple times

**Code to check:**
```typescript
// RoomSelect.tsx - startQueue function
```

---

### ✅ Step 3: Fund Lock (Critical!)

**Location:** `app/api/match/create/route.ts` OR `app/api/match/queue/route.ts`

**What MUST happen:**
1. Check player balance >= entry_fee
2. Deduct entry_fee from player's internal wallet
3. Create match record with status='forming'
4. Store entry_fee in match.entry_fee_sol
5. Transaction must be ATOMIC (balance deduct + match create)

**Verify:**
- [ ] Balance deduction is atomic with match creation
- [ ] If match creation fails, balance is refunded
- [ ] Entry fee is stored in match record for settlement
- [ ] Player cannot join multiple matches simultaneously with same funds
- [ ] Database constraints prevent double-spending

**Critical SQL queries to verify:**
```sql
-- Check match creation atomicity
BEGIN TRANSACTION;
UPDATE users SET balance = balance - entry_fee WHERE id = player_id AND balance >= entry_fee;
INSERT INTO matches (player_a_id, entry_fee_sol, ...) VALUES (...);
COMMIT;

-- Verify escrow
SELECT SUM(entry_fee_sol) FROM matches WHERE status IN ('forming', 'settlement_pending');
-- Should match total locked SOL across all active matches
```

---

### ✅ Step 4-5: Matchmaking

**Location:** `app/api/match/queue/route.ts` → `app/api/match/[matchId]/join/route.ts`

**What happens:**
1. P1 creates match, waits in queue
2. P2 joins existing match OR creates new match
3. Match status changes: 'forming' → 'settlement_pending'
4. P2's entry fee also deducted and added to prize pool

**Verify:**
- [ ] P2 balance check before join
- [ ] P2 entry fee deducted atomically
- [ ] Match.status updated to 'settlement_pending'
- [ ] Prize pool = entry_fee * 2
- [ ] Both players' funds are in escrow

---

### ✅ Step 6-8: Pre-Battle Ceremony (NEW - Just Fixed!)

**Location:** `components/VersusScreen.tsx` → `components/battle/GameWrapper.tsx` → `components/battle/ArenaReveal.tsx`

**Flow:**
1. VersusScreen shows for 4s
2. Transitions to GameWrapper (screen='game')
3. GameWrapper detects serverMatchId, sets screen='arena_reveal'
4. ArenaReveal plays 8s animation + battle music
5. ArenaReveal computes canonical battle from server seed

**Verify:**
- [x] VersusScreen displays both players correctly
- [x] GameWrapper routes to arena_reveal (NOT battle)
- [x] ArenaReveal shows spinning arena animation
- [x] Battle music starts during reveal
- [x] ArenaReveal handles serverMatchId resume correctly
- [x] Battle computation uses server seed (deterministic)

**Status:** ✅ FIXED in commit ba899dc (just deployed)

---

### ✅ Step 9: Battle Computation (CRITICAL - Must Be Deterministic!)

**Location:** `components/battle/ArenaReveal.tsx` → `lib/engine/battle.ts`

**What MUST happen:**
1. Server provides canonical seed (match.battle_seed)
2. Both clients compute IDENTICAL battle with same seed
3. Winner is deterministic - no client can manipulate
4. Server validates winner matches seed-derived outcome

**Verify:**
- [ ] Battle seed comes from server (stored in match record)
- [ ] Both clients use exact same seed for RNG
- [ ] resolveBattle() is pure function (same inputs = same output)
- [ ] Server can recompute battle outcome for validation
- [ ] No client-side RNG that could differ between players

**Test:**
```typescript
// Same seed + teams must produce same winner on both clients
const seed = "test123"
const rng1 = mulberry32(seedFromMatchId(seed))
const rng2 = mulberry32(seedFromMatchId(seed))
const battle1 = resolveBattle(teamA, teamB, arena, t1, t2, rng1)
const battle2 = resolveBattle(teamA, teamB, arena, t1, t2, rng2)
assert(battle1.winner === battle2.winner) // MUST be true
```

---

### ✅ Step 10-11: Battle & Victory/Defeat (NEW - Just Fixed!)

**Location:** `components/battle/BattleScreen.tsx` → `components/battle/VictoryScreen.tsx` / `DefeatScreen.tsx`

**Flow:**
1. BattleScreen plays battle animation
2. Auto-advances to victory/defeat after battle ends
3. Shows celebration/commiseration for 3-5s
4. Transitions to FinalResultsScreen

**Verify:**
- [x] BattleScreen works identically for paid/practice/friend modes
- [x] Victory/Defeat screens render for paid mode (just added)
- [x] Correct screen shown based on battle outcome
- [x] No way to skip or manipulate result display

**Status:** ✅ FIXED in commit ba899dc (added victory/defeat to GameWrapper)

---

### ✅ Step 12: Auto-Settlement (CRITICAL - MONEY MOVEMENT!)

**Location:** `app/api/match/[matchId]/settle/route.ts` OR auto-triggered in GameWrapper

**What MUST happen:**
1. Battle finishes, winner determined
2. Server validates winner matches seed-derived outcome
3. Prize pool (entry_fee * 2) transferred to winner
4. Match status: 'settlement_pending' → 'settled'
5. Loser's locked funds stay deducted (they lost)
6. Winner's balance += prize pool

**Verify:**
- [ ] Settlement is triggered automatically after battle
- [ ] Settlement is idempotent (calling twice doesn't double-pay)
- [ ] Server validates winner before paying out
- [ ] Winner receives exactly 2x entry_fee
- [ ] Transaction is atomic (balance update + match status)
- [ ] No way for loser to get refund after loss
- [ ] Settlement cannot be called before battle completes

**Critical code to review:**
```typescript
// app/api/match/[matchId]/settle/route.ts
// Must verify:
// 1. Match status is 'settlement_pending'
// 2. Battle outcome matches server-computed winner
// 3. Winner hasn't been paid yet (settlement_tx_id is null)
// 4. Update winner balance atomically
// 5. Set match.status = 'settled'
// 6. Store settlement_tx_id for audit trail
```

---

### ✅ Step 13-14: Results & Balance Update

**Location:** `components/battle/FinalResultsScreen.tsx`

**What displays:**
1. Winner: "You won X SOL!" with green highlight
2. Loser: "You lost X SOL" with red highlight
3. Match stats (MVP, damage, KOs)
4. Updated balance displayed
5. Option to play again or return to lobby

**Verify:**
- [ ] Correct SOL amount shown (entry_fee for loser, 2x for winner)
- [ ] Balance in UI matches database
- [ ] Results screen pulls from settled match record
- [ ] No cached/stale balance displayed
- [ ] Play again button doesn't reuse same funds

---

## 🚨 CRITICAL SECURITY CHECKS

### Fund Safety
- [ ] **No double-deduction:** Player cannot be charged entry fee twice
- [ ] **No double-payout:** Winner cannot receive prize pool twice  
- [ ] **Escrow integrity:** Locked funds cannot be spent on other matches
- [ ] **Atomic transactions:** Balance updates are all-or-nothing
- [ ] **Refund on failure:** If match creation fails, entry fee is refunded
- [ ] **Abandon refund:** If opponent never joins, entry fee is refunded

### Anti-Cheat
- [ ] **Deterministic battles:** Same seed = same winner on all clients
- [ ] **Server validation:** Server can recompute battle to verify winner
- [ ] **No client manipulation:** Winner is derived from server seed, not client
- [ ] **Immutable seed:** Battle seed cannot be changed after match creation
- [ ] **Team verification:** Teams come from server, not client-submitted

### Edge Cases
- [ ] **Refresh mid-battle:** Player can resume without losing funds
- [ ] **Disconnect:** Funds are safe, match can be resumed or abandoned
- [ ] **Simultaneous matches:** Player cannot join multiple paid matches
- [ ] **Insufficient balance:** Match creation fails before funds are locked
- [ ] **Opponent abandons:** Entry fee is refunded, not forfeited

---

## 🔍 Files to Audit

### API Routes (Fund Movement)
1. `app/api/match/create/route.ts` - Initial fund lock
2. `app/api/match/queue/route.ts` - Matchmaking + P1 lock
3. `app/api/match/[matchId]/join/route.ts` - P2 join + lock
4. `app/api/match/[matchId]/settle/route.ts` - Prize payout **CRITICAL**
5. `app/api/match/[matchId]/abandon/route.ts` - Refund logic

### Battle Logic (Determinism)
1. `lib/engine/battle.ts` - resolveBattle() must be pure
2. `lib/engine/prng.ts` - Seed-based RNG must be deterministic
3. `components/battle/ArenaReveal.tsx` - Battle computation with server seed

### UI Flow (User Experience)
1. `components/RoomSelect.tsx` - Entry point, balance check
2. `components/QueueScreen.tsx` - Matchmaking status
3. `components/VersusScreen.tsx` - Player reveal
4. `components/battle/GameWrapper.tsx` - Paid battle wrapper
5. `components/battle/FinalResultsScreen.tsx` - SOL payout display

---

## 🧪 Test Scenarios

### Happy Path
1. Two players with sufficient balance
2. Both join match successfully
3. Battle completes normally
4. Winner receives 2x entry fee
5. Loser sees entry fee deducted
6. Both can play again

### Failure Scenarios
1. **Insufficient balance:** Match creation fails, no charge
2. **Opponent never joins:** Match voided after 5min, refund issued
3. **Mid-battle disconnect:** Player refreshes, battle resumes
4. **Server crash:** Funds are in escrow, can be recovered
5. **Double-click queue:** Only one match created, one charge

---

## ✅ Verification Commands

### Check Fund Integrity
```sql
-- Total SOL in escrow
SELECT SUM(entry_fee_sol * 2) as locked_sol 
FROM matches 
WHERE status IN ('forming', 'settlement_pending');

-- User balance snapshot
SELECT id, username, balance 
FROM users 
WHERE id IN (SELECT player_a_id FROM matches WHERE status = 'settlement_pending');

-- Recent settlements
SELECT id, player_a_id, player_b_id, winner, entry_fee_sol, status, settled_at
FROM matches 
WHERE status = 'settled' 
ORDER BY settled_at DESC 
LIMIT 20;
```

### Check Match State
```sql
-- Active matches
SELECT id, status, player_a_id, player_b_id, entry_fee_sol, created_at
FROM matches
WHERE status IN ('forming', 'settlement_pending')
ORDER BY created_at DESC;

-- Abandoned matches (should have refunds)
SELECT id, player_a_id, entry_fee_sol, status, error_message
FROM matches
WHERE status = 'voided'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 Action Items

1. **Review settlement API:** Ensure atomic payout + validation
2. **Test battle determinism:** Same seed = same winner
3. **Verify refund logic:** Abandoned matches refund correctly
4. **Check balance atomicity:** No race conditions in fund locks
5. **Test edge cases:** Refresh, disconnect, double-click
6. **Audit SQL transactions:** All fund movements are atomic
7. **Test with real SOL:** Small amounts first, verify payout

---

## Status: ⚠️ NEEDS VERIFICATION

✅ UI Flow: Arena reveal + victory/defeat FIXED  
⚠️ Fund Safety: NEEDS AUDIT  
⚠️ Settlement: NEEDS CODE REVIEW  
⚠️ Determinism: NEEDS TESTING  
⚠️ Refunds: NEEDS VERIFICATION  

**Next Step:** Audit settlement API and fund lock logic for atomicity and security.
