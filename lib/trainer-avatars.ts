// Trainer avatar configuration
// Drop images into /public/trainer-avatars/ and add their filenames here
// They will appear as preset options during profile setup

export const TRAINER_AVATAR_PRESETS: string[] = [
  // Row 1 — Trainers
  '/trainer-avatars/ProfessorOak.webp',
  '/trainer-avatars/Ash.webp',
  '/trainer-avatars/Gary.webp',
  '/trainer-avatars/Brock.webp',
  // Row 2 — Trainers cont.
  '/trainer-avatars/Misty.webp',
  '/trainer-avatars/Giovanni.webp',
  // Row 3 — Pokémon
  '/trainer-avatars/Bulbasaur.webp',
  '/trainer-avatars/Charmander.webp',
  '/trainer-avatars/Squirtle.webp',
  '/trainer-avatars/Pikachu.webp',
  '/trainer-avatars/Eevee.webp',
  '/trainer-avatars/Snorlax.webp',
];

// Emoji fallbacks — used when no custom images are provided yet
export const EMOJI_FALLBACKS = ['🧑‍🦱', '👩‍🦰', '🧑‍🦳', '👨‍🦯', '🧕', '🧑‍🎤', '🧑‍💻', '👨‍🎨', '👩‍🚀', '🦸', '🧙', '🥷'];

export function getAvatarOptions(): { type: 'image' | 'emoji'; value: string }[] {
  const imageOptions = TRAINER_AVATAR_PRESETS.map(src => ({ type: 'image' as const, value: src }));
  if (imageOptions.length > 0) return imageOptions;
  // Fallback to emojis until real images are provided
  return EMOJI_FALLBACKS.map(e => ({ type: 'emoji' as const, value: e }));
}
