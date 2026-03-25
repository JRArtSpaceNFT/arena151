import type { RoomTier, Pokemon } from '@/types';

// Fee percentage taken from the pot (5%)
export const ARENA_FEE_PCT = 0.05;

// Fallback SOL price — overridden at runtime by useSolPrice hook
export const SOL_PRICE_USD_FALLBACK = 90.57;

// Helper: convert USD tier to SOL entry fee
export function usdToSol(usd: number, solPrice: number): number {
  return parseFloat((usd / solPrice).toFixed(4));
}

export const ROOM_TIERS: Record<string, RoomTier> = {
  'pallet-town': {
    id: 'pallet-town',
    name: 'Pallet Town',
    tier: 5,
    entryFee: parseFloat((5 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((5 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'Where every legend begins',
    emblem: '🌱',
    color: 'from-green-500 to-emerald-600',
    glow: 'shadow-green-500/50',
  },
  'viridian-city': {
    id: 'viridian-city',
    name: 'Viridian City',
    tier: 10,
    entryFee: parseFloat((10 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((10 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'The path through the forest',
    emblem: '🌲',
    color: 'from-teal-500 to-green-600',
    glow: 'shadow-teal-500/50',
  },
  'pewter-city': {
    id: 'pewter-city',
    name: 'Pewter City',
    tier: 25,
    entryFee: parseFloat((25 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((25 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'Stone walls, iron will',
    emblem: '🪨',
    color: 'from-stone-500 to-slate-600',
    glow: 'shadow-stone-500/50',
  },
  'cerulean-city': {
    id: 'cerulean-city',
    name: 'Cerulean City',
    tier: 50,
    entryFee: parseFloat((50 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((50 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'Where water meets ambition',
    emblem: '💧',
    color: 'from-blue-500 to-cyan-600',
    glow: 'shadow-blue-500/50',
  },
  'vermilion-city': {
    id: 'vermilion-city',
    name: 'Vermilion City',
    tier: 100,
    entryFee: parseFloat((100 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((100 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'Charged and ready to strike',
    emblem: '⚡',
    color: 'from-yellow-500 to-orange-500',
    glow: 'shadow-yellow-500/50',
  },
  'celadon-city': {
    id: 'celadon-city',
    name: 'Celadon City',
    tier: 250,
    entryFee: parseFloat((250 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((250 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'For the bold and skilled',
    emblem: '🌸',
    color: 'from-purple-500 to-pink-600',
    glow: 'shadow-purple-500/50',
  },
  'victory-road': {
    id: 'victory-road',
    name: 'Victory Road',
    tier: 500,
    entryFee: parseFloat((500 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((500 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'Only the elite survive',
    emblem: '⚔️',
    color: 'from-red-500 to-rose-700',
    glow: 'shadow-red-500/50',
  },
  'indigo-plateau': {
    id: 'indigo-plateau',
    name: 'Indigo Plateau',
    tier: 1000,
    entryFee: parseFloat((1000 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    prizePool: parseFloat((1000 * 2 * 0.95 / SOL_PRICE_USD_FALLBACK).toFixed(4)),
    description: 'Legends are forged here',
    emblem: '👑',
    color: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/50',
  },
};

export const STARTER_POKEMON: Pokemon[] = [
  {
    id: 1,
    name: 'Bulbasaur',
    sprite: '/sprites/bulbasaur.png',
    types: ['grass', 'poison'],
    stats: { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 },
  },
  {
    id: 4,
    name: 'Charmander',
    sprite: '/sprites/charmander.png',
    types: ['fire'],
    stats: { hp: 39, attack: 52, defense: 43, spAttack: 60, spDefense: 50, speed: 65 },
  },
  {
    id: 7,
    name: 'Squirtle',
    sprite: '/sprites/squirtle.png',
    types: ['water'],
    stats: { hp: 44, attack: 48, defense: 65, spAttack: 50, spDefense: 64, speed: 43 },
  },
  {
    id: 25,
    name: 'Pikachu',
    sprite: '/sprites/pikachu.png',
    types: ['electric'],
    stats: { hp: 35, attack: 55, defense: 40, spAttack: 50, spDefense: 50, speed: 90 },
  },
  {
    id: 133,
    name: 'Eevee',
    sprite: '/sprites/eevee.png',
    types: ['normal'],
    stats: { hp: 55, attack: 55, defense: 50, spAttack: 45, spDefense: 65, speed: 55 },
  },
  {
    id: 143,
    name: 'Snorlax',
    sprite: '/sprites/snorlax.png',
    types: ['normal'],
    stats: { hp: 160, attack: 110, defense: 65, spAttack: 65, spDefense: 110, speed: 30 },
  },
];

export const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
};

export const DEFAULT_AVATARS = [
  '/avatars/trainer-1.png',
  '/avatars/trainer-2.png',
  '/avatars/trainer-3.png',
  '/avatars/trainer-4.png',
  '/avatars/trainer-5.png',
  '/avatars/trainer-6.png',
];
