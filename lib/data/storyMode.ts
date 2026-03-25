// ═══════════════════════════════════════════════════════════════
// STORY MODE DATA — ASH'S JOURNEY
// ═══════════════════════════════════════════════════════════════

export interface StoryOpponent {
  trainerId: string          // Maps to TRAINERS
  title: string              // "Gym Leader", "Elite Four", etc.
  team: number[]             // 6 Pokémon IDs (lore-accurate)
  badgeId?: string           // Only gym leaders have badges
  arenaId: string            // Arena override
  introDialogue: string      // Pre-battle speech
  defeatDialogue: string     // After loss
  previewHidden?: boolean    // Blue only - shows as ???
  imageUrl?: string          // Trainer portrait (80x80 circle)
}

export interface Badge {
  id: string
  name: string
  description: string
  imageUrl: string  // SVG data URL
}

export interface StoryProgress {
  currentOpponentIndex: number   // 0-12
  defeatedOpponents: boolean[]   // [false, false, ...] × 13
  earnedBadges: string[]         // Badge IDs
  lockedTeam: number[]           // [25, ...] Pikachu + 4
  teamOrder: number[]            // Reorderable copy
  completedStory: boolean
}

// ── BADGES ──────────────────────────────────────────────────────
export const BADGES: Badge[] = [
  { id: "boulder", name: "Boulder Badge", description: "Pewter City — Proof of Rock mastery", imageUrl: "/badges/BoulderBadge.png" },
  { id: "cascade", name: "Cascade Badge", description: "Cerulean City — Symbol of flowing strength", imageUrl: "/badges/CascadeBadge.png" },
  { id: "thunder", name: "Thunder Badge", description: "Vermilion City — Mark of the Lightning American", imageUrl: "/badges/ThunderBadge.png" },
  { id: "rainbow", name: "Rainbow Badge", description: "Celadon City — Grace and beauty perfected", imageUrl: "/badges/RainbowBadge.png" },
  { id: "soul", name: "Soul Badge", description: "Fuchsia City — Shadow of the ninja", imageUrl: "/badges/SoulBadge.png" },
  { id: "marsh", name: "Marsh Badge", description: "Saffron City — Psychic dominance proven", imageUrl: "/badges/MarshBadge.png" },
  { id: "volcano", name: "Volcano Badge", description: "Cinnabar Island — Forged in fire", imageUrl: "/badges/VolcanoBadge.png" },
  { id: "earth", name: "Earth Badge", description: "Viridian City — Giovanni's seal of respect", imageUrl: "/badges/EarthBadge.png" },
]

// ── STORY OPPONENTS ─────────────────────────────────────────────
export const STORY_OPPONENTS: StoryOpponent[] = [
  // ── GYM LEADERS ────────────────────────────────────────────
  {
    trainerId: 'brock',
    imageUrl: '/trainers/Brock2.png',
    title: 'Gym Leader',
    team: [74, 95, 75, 76, 141, 139],  // Geodude, Onix, Graveler, Golem, Kabutops, Omastar
    badgeId: 'boulder',
    arenaId: 'brocks_gym',
    introDialogue: 'My rock-hard willpower is evident even in my Pokémon. My Pokémon are all rock-hard, and have true grit. Fuhaha! You\'re going to challenge me knowing that you\'ll lose? That\'s the trainer\'s honor that compels you to challenge me. Fine! Let\'s go!',
    defeatDialogue: 'I took you for granted, and so I lost. As proof of your victory, I confer on you this... the Boulder Badge!'
  },
  {
    trainerId: 'misty',
    imageUrl: '/trainers/Misty2.png',
    title: 'Gym Leader',
    team: [120, 121, 118, 119, 54, 131],  // Staryu, Starmie, Goldeen, Seaking, Psyduck, Lapras
    badgeId: 'cascade',
    arenaId: 'mistys_gym',
    introDialogue: 'I may be a Water Pokémon trainer, but I\'m gonna wipe you out! My policy is an all-out offensive with Water Pokémon! Prepare yourself!',
    defeatDialogue: 'Wow! You\'re too much! All right! You can have the Cascade Badge to show you beat me!'
  },
  {
    trainerId: 'surge',
    imageUrl: '/trainers/LtSurge2.png',
    title: 'Gym Leader',
    team: [100, 101, 25, 26, 82, 125],  // Voltorb, Electrode, Pikachu, Raichu, Magneton, Electabuzz
    badgeId: 'thunder',
    arenaId: 'lt_surge_gym',
    introDialogue: 'Hey, kid! What do you think you\'re doing here? You won\'t live long in combat! That\'s for sure! I tell you kid, electric Pokémon saved me during the war! They zapped my enemies into paralysis! The same as I\'m going to do to you!',
    defeatDialogue: 'Whoa! You\'re the real deal, kid! Fine then, take the Thunder Badge!'
  },
  {
    trainerId: 'erika',
    imageUrl: '/trainers/Erika2.png',
    title: 'Gym Leader',
    team: [44, 45, 70, 71, 114, 103],  // Gloom, Vileplume, Weepinbell, Victreebel, Tangela, Exeggutor
    badgeId: 'rainbow',
    arenaId: 'erikas_gym',
    introDialogue: 'Welcome to my garden! I am Erika, master of Grass Pokémon! My beautiful flowers bloom with power, and my team strikes like vines in the night! You may think Grass types are gentle... but you\'ll soon discover they can be deadly! Are you ready to face nature\'s wrath?',
    defeatDialogue: 'Oh! I concede defeat... You are remarkably strong... I must confer you the Rainbow Badge.'
  },
  {
    trainerId: 'koga',
    imageUrl: '/trainers/Koga2.png',
    title: 'Gym Leader',
    team: [48, 49, 109, 110, 89, 42],  // Venonat, Venomoth, Koffing, Weezing, Muk, Golbat
    badgeId: 'soul',
    arenaId: 'kogas_gym',
    introDialogue: 'Fwahahaha! A brave little boy! I applaud your courage! I am Koga, the ninja! I will show you the discipline of my poison Pokémon!',
    defeatDialogue: 'Humph! You have proven your worth! Here! Take the Soul Badge!'
  },
  {
    trainerId: 'sabrina',
    imageUrl: '/trainers/Sabrina2.png',
    title: 'Gym Leader',
    team: [63, 64, 65, 122, 97, 124],  // Abra, Kadabra, Alakazam, Mr. Mime, Hypno, Jynx
    badgeId: 'marsh',
    arenaId: 'sabrinas_gym',
    introDialogue: 'I had a vision of your arrival! I have had psychic powers since I was a child. I first learned to bend spoons with my mind. I dislike battling, but if you wish, I will show you my powers!',
    defeatDialogue: 'I\'m shocked! But, a loss is a loss. I admit I didn\'t work hard enough to win! You earned the Marsh Badge!'
  },
  {
    trainerId: 'blaine',
    imageUrl: '/trainers/Blaine2.png',
    title: 'Gym Leader',
    team: [58, 59, 37, 38, 78, 126],  // Growlithe, Arcanine, Vulpix, Ninetales, Rapidash, Magmar
    badgeId: 'volcano',
    arenaId: 'blaines_gym',
    introDialogue: 'Hah! I am Blaine! I am the Leader of Cinnabar Gym! My fiery Pokémon will incinerate all challengers! Hah! You better have Burn Heal!',
    defeatDialogue: 'I have burned out! You have earned the Volcano Badge!'
  },
  {
    trainerId: 'giovanni',
    imageUrl: '/trainers/Giovanni2.png',
    title: 'Gym Leader',
    team: [111, 112, 50, 51, 34, 31],  // Rhyhorn, Rhydon, Diglett, Dugtrio, Nidoking, Nidoqueen
    badgeId: 'earth',
    arenaId: 'giovannis_gym',
    introDialogue: 'I am Giovanni! For taking on Team Rocket singlehandedly, I shall personally punish you! However, know that it takes more than brute force to defeat the Team Rocket boss!',
    defeatDialogue: 'Ha! That was a truly intense fight. You have won! As proof, here is the Earth Badge!'
  },
  
  // ── ELITE FOUR ─────────────────────────────────────────────
  {
    trainerId: 'lorelei',
    imageUrl: '/trainers/Lorelei2.png',
    title: 'Elite Four',
    team: [86, 87, 91, 80, 124, 131],  // Seel, Dewgong, Cloyster, Slowbro, Jynx, Lapras
    arenaId: 'loreleis_ice_arena',
    introDialogue: 'Welcome to the Pokémon League! I am Lorelei of the Elite Four. No one can best me when it comes to icy Pokémon! Freezing moves are powerful! Your Pokémon will be at my mercy when they are frozen solid! Hahaha! Are you ready?',
    defeatDialogue: 'How dare you! You\'re better than I thought! Go on ahead! You only got a taste of the Pokémon League power!'
  },
  {
    trainerId: 'bruno',
    imageUrl: '/trainers/Bruno2.png',
    title: 'Elite Four',
    team: [95, 95, 66, 67, 107, 106],  // Onix, Onix, Machop, Machoke, Hitmonchan, Hitmonlee (Machamp removed - too strong)
    arenaId: 'brunos_stone_arena',
    introDialogue: 'I am Bruno of the Elite Four! Through rigorous training, people and Pokémon can become stronger without limit. I\'ve lived and trained with my fighting Pokémon! And that will never change! Now, let me see what you and your Pokémon are made of!',
    defeatDialogue: 'Why? How could I lose? I practiced every day! Oh well. That\'s the way it goes. I just knew you\'d continue on!'
  },
  {
    trainerId: 'agatha',
    imageUrl: '/trainers/Agatha2.png',
    title: 'Elite Four',
    team: [92, 93, 94, 94, 24, 42],  // Gastly, Haunter, Gengar, Gengar, Arbok, Golbat
    arenaId: 'agatha_ghost_arena',
    introDialogue: 'I am Agatha of the Elite Four! Oak\'s taken a lot of interest in you, child! That old duff was once tough and handsome! But that was decades ago! Now he just wants to fiddle with his Pokédex! He\'s wrong! Pokémon are for fighting! You! I\'ll show you how a real trainer fights!',
    defeatDialogue: 'Oh ho! You\'re something special, child! I still don\'t like you, though! Your journey isn\'t over yet. Keep going!'
  },
  {
    trainerId: 'lance',
    imageUrl: '/trainers/Lance2.png',
    title: 'Elite Four Dragon Master',
    team: [130, 147, 148, 148, 142, 149],  // Gyarados, Dratini, Dragonair, Dragonair, Aerodactyl, Dragonite
    arenaId: 'lance_dragon_arena',
    introDialogue: 'Ah! I heard about you! I lead the Elite Four! You can call me Lance the dragon trainer! You know that dragons are mythical Pokémon! They\'re hard to catch and raise, but their powers are superior! They\'re virtually indestructible! Well, are you ready to lose? Your League challenge ends with me!',
    defeatDialogue: 'That\'s it! I hate to admit it, but you are a Pokémon master! ...Or, you will be, once you\'ve beaten Blue! He\'s in the next room!'
  },
  
  // ── CHAMPION ───────────────────────────────────────────────
  {
    trainerId: 'gary',  // Blue uses Gary's trainer data
    title: 'Champion',
    team: [18, 112, 65, 59, 103, 9],  // Pidgeot, Rhydon, Alakazam, Arcanine, Exeggutor, Blastoise
    arenaId: 'champion_stadium',
    introDialogue: 'Hey! I was looking forward to seeing you here! My rival should be strong to keep me sharp! While working on my Pokédex, I looked all over for powerful Pokémon! Not only that, I assembled teams that would beat any Pokémon type! And now! I\'m the Pokémon League Champion! Do you know what that means? I\'ll tell you! I am the most powerful trainer in the world!',
    defeatDialogue: 'WHAT! Unbelievable! I picked the wrong Pokémon! I... I\'ve lost... Smell ya later.',
    previewHidden: true  // Shows as ??? until reached
  },
]

// ── HELPER FUNCTIONS ────────────────────────────────────────────
export function createEmptyProgress(): StoryProgress {
  return {
    currentOpponentIndex: 0,
    defeatedOpponents: new Array(STORY_OPPONENTS.length).fill(false),
    earnedBadges: [],
    lockedTeam: [],
    teamOrder: [],
    completedStory: false,
  }
}

export function getBadgeById(badgeId: string): Badge | undefined {
  return BADGES.find(b => b.id === badgeId)
}

export function getCurrentOpponent(progress: StoryProgress): StoryOpponent | null {
  if (progress.currentOpponentIndex >= STORY_OPPONENTS.length) return null
  return STORY_OPPONENTS[progress.currentOpponentIndex]
}

export function isStoryComplete(progress: StoryProgress): boolean {
  return progress.defeatedOpponents.every(d => d === true)
}

export function getProgressPercentage(progress: StoryProgress): number {
  const defeated = progress.defeatedOpponents.filter(d => d).length
  return Math.round((defeated / STORY_OPPONENTS.length) * 100)
}
