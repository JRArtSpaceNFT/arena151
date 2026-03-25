# Arena 151 - Draft Mode

**Build Your Legend. Face Real Rivals. Write Your Destiny.**

Arena 151 is the premier competitive Pokémon Draft Mode platform built on Solana. This is a complete ground-up rebuild following the comprehensive product vision document.

## 🎮 Core Experience

Draft Mode is the **flagship competitive mode** where:

- Players create **trainer identities** with public profiles
- Every trainer has a **signature Pokémon** and visible **battle record**
- Players select **battle rooms** with different stakes (SOL entry fees)
- Matchmaking finds **real rivals** for suspenseful PvP battles
- Every match feels like a **chapter in your legend**

## 🌟 Visual Identity

The product embodies:

- **Pokémon League prestige** - stadium atmosphere, championship energy
- **Anime rivalry drama** - explosive match-found moments, ceremonial versus screens
- **Modern competitive polish** - premium UI, smooth motion, cohesive world
- **Pokédex-inspired interface** - badge emblems, type-colored glows, nostalgic touches

## 🏆 Room Tiers

Each room has its own prestige and challenge level:

- **Pallet Pot** (0.01 SOL) - Where every legend begins
- **Gym Challenger** (0.05 SOL) - Prove your worth
- **Elite Clash** (0.1 SOL) - For the bold and skilled
- **Master Ball Room** (0.5 SOL) - Legends are forged here

## 🔐 SOL Only

Arena 151 operates **exclusively on Solana**:

- Internal wallet system managed by the platform
- Clear balance visibility in trainer profiles
- Deposit confirmation screens on every transaction
- SOL-only messaging throughout the product

## 📋 Product Flow

1. **Account Creation** - Email → Name/Username → Avatar → Favorite Pokémon
2. **Trainer Profile** - Public identity with record, bio, signature Pokémon
3. **Draft Mode Intro** - Learn the mode, see the steps, understand SOL usage
4. **Room Selection** - Choose your battlefield and stakes
5. **Queue** - Suspenseful search with global arena chat
6. **Match Found** - Explosive rival reveal with trainer cards
7. **Versus Lock-In** - Ceremonial pre-battle sequence
8. **Battle** - (Placeholder for now - goes straight to result)
9. **Result** - Triumphant victory or respectful defeat with updated record

## 🛠 Tech Stack

- **Next.js 16** with App Router
- **TypeScript** for type safety
- **Tailwind CSS 4** for styling
- **Framer Motion** for cinematic animations
- **Zustand** for state management
- **Solana Web3.js** for blockchain integration (ready to wire)

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3002
```

## 📁 Project Structure

```
arena151/
├── app/
│   ├── layout.tsx       # Root layout with stadium background
│   ├── page.tsx         # Main app with screen router
│   └── globals.css      # Visual identity system
├── components/
│   ├── HomePage.tsx           # Landing page
│   ├── SignupFlow.tsx         # 4-step trainer creation
│   ├── TrainerProfile.tsx     # Public trainer identity
│   ├── DraftModeIntro.tsx     # Mode explanation + SOL notice
│   ├── RoomSelect.tsx         # Battle room selection
│   ├── QueueScreen.tsx        # Matchmaking + global chat
│   ├── MatchFound.tsx         # Explosive rival reveal
│   ├── VersusScreen.tsx       # Pre-battle lock-in
│   └── ResultScreen.tsx       # Post-match ceremony
├── lib/
│   ├── store.ts         # Zustand state management
│   └── constants.ts     # Room tiers, Pokémon data, type colors
└── types/
    └── index.ts         # TypeScript definitions
```

## 🎨 Design System

### Colors
- **Arena Blue** (#1e40af) - Primary competitive energy
- **Arena Red** (#dc2626) - Rivalry and combat
- **Arena Gold** (#f59e0b) - Victory and prestige
- **Arena Cyan** (#06b6d4) - Electric energy and highlights
- **Arena Purple** (#9333ea) - Mystery and Solana brand

### Components
- **Glass panels** - Frosted dark backgrounds with subtle borders
- **Arena buttons** - Gradient backgrounds with glowing shadows
- **Room cards** - Large interactive panels with type-inspired glows
- **Trainer cards** - Pokédex-style identity displays

### Motion
- **Pulse glow** - Radar search, live status indicators
- **Slide up** - Content reveals, screen transitions
- **Spring animations** - Match found, versus lock-in
- **Confetti** - Victory celebration particles

## 🔮 Next Steps

### Phase 1: Core Foundation ✅ (Complete)
- [x] Account creation flow
- [x] Trainer profiles
- [x] Room selection
- [x] Queue system
- [x] Match found sequence
- [x] Versus screen
- [x] Result screen
- [x] Global chat

### Phase 2: Backend Integration (Next)
- [ ] Solana wallet integration
- [ ] Real deposit/withdraw flows
- [ ] Match result API
- [ ] Persistent user accounts
- [ ] Real-time matchmaking
- [ ] Chat moderation (profanity filter, slur blocking)

### Phase 3: Battle System
- [ ] Full battle UI
- [ ] Team draft mechanics
- [ ] Turn-based combat
- [ ] Battle animations
- [ ] Move selection

### Phase 4: Social & Prestige
- [ ] Battle history log
- [ ] Leaderboards
- [ ] Badges and achievements
- [ ] Trainer rankings
- [ ] Rival system

## 💡 Design Principles

1. **Identity First** - Players are trainers, not users
2. **Prestige Matters** - Every room, every match, every moment feels important
3. **Suspense Over Speed** - Build tension, make matchmaking feel dramatic
4. **One Cohesive World** - Every screen belongs to Arena 151
5. **Momentum Over Perfection** - Ship, iterate, improve

## 📖 Vision

Arena 151 Draft Mode is not just a game mode — it's **the center of a living Pokémon battle world** where:

- Every trainer has a public identity
- Every matchup feels meaningful
- Every step into battle feels charged with tension
- Every battle writes a chapter in your legend

This is where names are made. This is where rivalries are born. This is where legends are forged.

---

**Enter the Arena. Build Your Legend.**
