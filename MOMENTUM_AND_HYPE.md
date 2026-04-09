# Momentum Meter + Live Hype Reactions

## What Was Added

Two major cinematic battle features that make fights feel alive and interactive:

1. **Momentum Meter** — Shows who's dominating the fight
2. **Live Hype Reactions** — Players can send emotes and phrases during battle

---

## 1. Momentum Meter

### Location
Positioned **just below the HP bars** in the center of the screen (top 12% of viewport).

### How It Works
Calculates a momentum score from **-100 (Blue dominating)** to **+100 (Red dominating)** based on:

1. **HP Advantage** (-50 to +50)
   - Difference in current HP percentages
2. **Team Alive Count** (-30 to +30)
   - Difference in number of Pokémon still standing
3. **Attacker Bonus** (±10)
   - Slight momentum boost to whoever just attacked

### Dynamic States

The meter displays one of these states based on the momentum score:

| State | Condition | Color |
|-------|-----------|-------|
| **FINAL STAND** | ≤15% HP left, only 1 Pokémon alive | Red |
| **DANGER STATE** | ≤25% HP left | Red |
| **RED DOMINANT** | Momentum ≥ +60 | Red |
| **BLUE DOMINANT** | Momentum ≤ -60 | Blue |
| **MOMENTUM → RED** | +30 to +59 | Red |
| **MOMENTUM → BLUE** | -30 to -59 | Blue |
| **RED RALLYING** | +10 to +29 | Red |
| **BLUE RALLYING** | -10 to -29 | Blue |
| **EVEN FIGHT** | -9 to +9 | Yellow |

### Visual Design

- **Horizontal bar** with gradient: Blue on left, Gray in center, Red on right
- **Moving indicator** (colored circle) slides along the bar based on momentum
- **Center tick** marks the neutral 50/50 point
- **State label** appears above with glowing text
- **Smooth spring animations** for all transitions

**Example:**
```
         MOMENTUM → RED
    ═══════════════○════════
   BLUE         ║         RED
```

---

## 2. Live Hype Reactions

### Overview
Players can trigger **harmless visual reactions** during the battle that don't affect outcomes:
- Floating emoji bursts
- Trainer catchphrases
- GG explosions

### How to Trigger

**Control Panel:**
- Toggle button in **bottom left (Red)** or **bottom right (Blue)**
- Click the 🎉 button to open the panel
- Select from:
  - 8 **emote buttons** (🔥, 💀, 😤, 👑, ⚡, 💪, 😱, 💯)
  - 4 **quick phrases** (e.g., "Let's go!", "Too easy!", "Comeback time!")
  - **GG! button** (big gold callout)

**Cooldown:**
- 2-second cooldown between reactions (prevents spam)
- Panel shows "Cooldown active..." message

### Auto-Reactions

The system **automatically triggers reactions** on epic moments:
- **Critical Hit** → ⚡ (lightning bolt) from attacker's side
- **KO** → 💀 (skull) from winning side

### Visual Behavior

**Emotes:**
- Large floating emoji (48px)
- Spawns from player's side (15% or 85% from left)
- Floats upward with random horizontal drift
- Fades out after 3 seconds

**Phrases:**
- Rounded pill-shaped bubble
- Gradient background (red for A, blue for B)
- Bold uppercase text
- Same floating animation as emotes

**Animation:**
- Initial scale: 0.3 → 1.2 → 1 (pop-in effect)
- Opacity: 0 → 1 → 0.8 → 0 (fade out)
- Y position: 70% → -100px (rises off screen)
- Duration: 3 seconds total

---

## Files Created

### New Components

1. **`components/battle/MomentumMeter.tsx`** (6.3 KB)
   - Momentum calculation logic
   - State determination
   - Animated meter bar
   - Label display

2. **`components/battle/LiveHypeReactions.tsx`** (4.5 KB)
   - Reaction spawning system
   - Floating animation wrapper
   - Hook for external triggers

3. **`components/battle/HypeControlPanel.tsx`** (7.5 KB)
   - Toggle button
   - Expandable panel
   - Emote grid (4×2)
   - Quick phrases list
   - GG button
   - Cooldown management

### Integration

**Modified:**
- `components/battle/BattleScreen.tsx`
  - Added imports for all 3 components
  - Integrated `useHypeReactions()` hook
  - Mounted `MomentumMeter` with live battle data
  - Mounted `LiveHypeReactions` with trigger callback
  - Added 2 `HypeControlPanel` instances (one per side)
  - Auto-trigger on critical hits + KOs

---

## Props & API

### MomentumMeter Props
```ts
{
  currentHpA: number
  maxHpA: number
  currentHpB: number
  maxHpB: number
  activeA: number          // Active slot index
  activeB: number
  koSetA: Set<number>      // KO'd slot indices
  koSetB: Set<number>
  teamSizeA: number
  teamSizeB: number
  attackingSide: 'A' | 'B' | null
}
```

### LiveHypeReactions Props
```ts
{
  onMount?: (triggerFn: (side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void) => void
}
```

### HypeControlPanel Props
```ts
{
  side: 'A' | 'B'
  onTrigger: (side: 'A' | 'B', type: 'emote' | 'phrase' | 'gg', content?: string) => void
}
```

---

## Example Usage Flow

1. **Battle starts** → Momentum meter appears showing "EVEN FIGHT"
2. **Red attacks** → Momentum shifts slightly toward Red, meter updates
3. **Critical hit lands** → ⚡ auto-spawns from Red's side
4. **Blue's HP drops to 20%** → "DANGER STATE" appears in red text
5. **Red player clicks 🔥 emote** → Fire emoji floats up from Red's side
6. **Blue player sends "Comeback time!"** → Blue pill bubble rises
7. **Red KO's Blue's Pokémon** → 💀 auto-spawns from Red's side + "RED DOMINANT" state
8. **Blue switches in last Pokémon** → "FINAL STAND" state appears
9. **Blue wins clutch battle** → Blue player hits "GG! 🎮" button → Gold GG burst appears

---

## Design Philosophy

**Non-Invasive:**
- Zero impact on battle mechanics or outcomes
- Pure spectacle layer

**Cinematic:**
- Real-time visual feedback on fight flow
- Momentum swings feel dramatic
- Players can express emotion without interrupting flow

**Social:**
- Adds personality to competitive matches
- Creates memorable moments ("That GG after the clutch comeback!")
- Encourages respectful hype/banter

**Balanced:**
- Cooldowns prevent spam
- Auto-reactions highlight epic moments without player input
- Momentum meter is informative, not distracting

---

## Performance

- GPU-accelerated animations (Framer Motion)
- Max 1 reaction active per side at a time (with 3s cleanup)
- Momentum recalculates only on state changes (HP/KO/attack)
- No impact on battle logic performance

---

## Future Enhancements

Potential additions:
- Custom emote packs (unlock via achievements)
- Sound effects for reactions
- Replay highlights showing momentum swings
- Spectator mode with crowd vote reactions
- Team combo reactions (both players send same emote → bigger explosion)

---

**Commit:** `c71d4fb`  
**Status:** ✅ Production-ready, deployed to arena151.xyz

Every battle is now a spectacle with live momentum tracking and player hype. 🎮⚡
