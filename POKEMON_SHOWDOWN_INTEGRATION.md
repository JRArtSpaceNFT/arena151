# Pokémon Showdown Animation Integration Plan

## What is Pokémon Showdown?

Pokémon Showdown is the most popular online Pokémon battle simulator with **battle-tested, production-ready animations** for every Pokémon move.

**GitHub:** https://github.com/smogon/pokemon-showdown-client  
**Live:** https://play.pokemonshowdown.com/

## Why Use Their Animation System?

1. **900+ moves** already animated
2. **Open source** (MIT License)
3. **Battle-tested** by millions of users
4. **Professional quality** - smooth, performant
5. **Element-specific** effects for all types
6. **Sound effects** included

## Architecture Overview

### Core Files Needed

```
battle-animations.js    - Main animation engine
battle-log.ts          - Battle log parser
battle-scene-stub.ts   - Scene/sprite management
sprite-data/          - Pokémon sprite positions/data
```

### How It Works

1. **BattleScene** - Canvas-based rendering engine
2. **Sprites** - Manages Pokémon sprites (front/back/shiny)
3. **Animations** - Move-specific effect sequences
4. **SFX** - Sound effect triggers

## Integration Steps

### Phase 1: Extract Core Animation Engine ✅ (Started)

- [x] Created custom CSS/SVG animations (Fire, Water, Electric, Impact Rings)
- [ ] Add Ice, Grass, Fighting, Psychic, Dark animations
- [ ] Add status effect overlays (Burn, Poison, Paralysis)

### Phase 2: Integrate Showdown Sprites (Recommended)

**Option A: Use Showdown's Sprite System**
```bash
npm install @pkmn/sprites
```

Benefits:
- All Gen 1-9 Pokémon sprites
- Animated GIFs for modern gens
- Shiny variants included
- Battle-ready positioning

**Option B: Keep Current Pixel Art**
- Faster (no new dependencies)
- Consistent with current art style
- Would need to add animations manually

### Phase 3: Port Showdown Move Animations

**High Priority Moves (Gen 1 Classics):**
- Thunderbolt - Jagged lightning ⚡ (DONE)
- Flamethrower - Stream of fire 🔥 (DONE)
- Hydro Pump - Powerful water blast 💧 (DONE)
- Ice Beam - Freezing beam ❄️
- Psychic - Mind wave ripples 🔮
- Earthquake - Ground shaking 🌍
- Solar Beam - Charging + laser beam ☀️
- Hyper Beam - Massive energy blast 💥

**Implementation:**
```typescript
// Showdown uses this pattern:
BattleOtherAnims.thunderbolt = {
  anim(battle, args) {
    const defender = args[0]
    battle.backgroundEffect('#000000', 300, 0.6)
    battle.showEffect('lightning', { 
      x: defender.x,
      y: defender.y,
      scale: 2
    })
  }
}
```

**Our adaptation:**
```typescript
// We can port this to React/Framer Motion:
export function ThunderboltAnimation({ target, onComplete }) {
  return (
    <>
      <BackgroundFlash color="#000000" opacity={0.6} />
      <LightningBolt target={target} />
      <ElectricSparks count={20} />
    </>
  )
}
```

### Phase 4: Add Sound Effects

**Showdown Audio:**
- `audio/move-{movename}.mp3` - Individual move sounds
- `audio/hit-{type}.mp3` - Type-specific hit sounds
- `audio/faint.mp3` - KO sound

**Integration:**
```typescript
import { Howl } from 'howler' // Already used in Arena 151

const moveSounds = {
  thunderbolt: new Howl({ src: ['/audio/move-thunderbolt.mp3'] }),
  flamethrower: new Howl({ src: ['/audio/move-flamethrower.mp3'] }),
  // ...
}
```

## File Structure

```
components/battle/
├── attack-animations/
│   ├── FireAttack.tsx           ✅ DONE
│   ├── WaterAttack.tsx          ✅ DONE
│   ├── ElectricAttack.tsx       ✅ DONE
│   ├── ImpactRings.tsx          ✅ DONE
│   ├── IceAttack.tsx            📝 TODO
│   ├── GrassAttack.tsx          📝 TODO
│   ├── PsychicAttack.tsx        📝 TODO
│   ├── FightingAttack.tsx       📝 TODO
│   └── index.ts
├── status-effects/               📝 TODO
│   ├── BurnEffect.tsx
│   ├── PoisonEffect.tsx
│   ├── ParalysisEffect.tsx
│   └── index.ts
└── EnhancedBattleWrapper.tsx    ✅ Wired up

lib/battle-animations/            📝 TODO (Showdown port)
├── move-database.ts              - Map move names to animations
├── animation-engine.ts           - Core animation sequencer
└── showdown-adapter.ts           - Adapt Showdown patterns to React
```

## Next Steps

### Immediate (Tonight):
1. ✅ Add Fire/Water/Electric animations
2. Add Ice, Grass, Fighting, Psychic, Dark animations
3. Add status effect overlays
4. Test in live battle

### Short Term (This Week):
1. Port 20-30 most common Gen 1 moves from Showdown
2. Add move sound effects
3. Create animation database mapping

### Long Term:
1. Full Showdown animation library port
2. Animated sprites (optional)
3. Advanced effects (weather, terrain, abilities)

## Resources

- **Showdown Animations Source:** https://github.com/smogon/pokemon-showdown-client/tree/master/src/battle-animations
- **Sprite Data:** https://github.com/smogon/pokemon-showdown-client/tree/master/sprites
- **Audio Files:** https://play.pokemonshowdown.com/audio/
- **Animation Docs:** https://pokemonshowdown.com/animations/

## Performance Considerations

- Use Framer Motion's layout animations (GPU-accelerated)
- Lazy load animation components
- Limit particle counts on mobile
- Consider Canvas fallback for complex effects

---

**Status:** Phase 1 in progress, Phase 2+ ready to implement
