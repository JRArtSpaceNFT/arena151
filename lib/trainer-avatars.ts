// Trainer avatar configuration
// Drop images into /public/trainer-avatars/ and add their filenames here
// They will appear as preset options during profile setup

export const TRAINER_AVATAR_PRESETS: string[] = [
  // Row 1 — Trainers
  '/trainer-avatars/ProfessorOak.png',
  '/trainer-avatars/Ash.png',
  '/trainer-avatars/Gary.png',
  '/trainer-avatars/Brock.png',
  // Row 2 — Trainers cont.
  '/trainer-avatars/Misty.png',
  '/trainer-avatars/Giovanni.png',
  // Row 3 — Pokémon
  '/trainer-avatars/Bulbasaur.png',
  '/trainer-avatars/Charmander.png',
  '/trainer-avatars/Squirtle.png',
  '/trainer-avatars/Pikachu.png',
  '/trainer-avatars/Eevee.png',
  '/trainer-avatars/Snorlax.png',
];

// Emoji fallbacks — used when no custom images are provided yet
export const EMOJI_FALLBACKS = ['🧑‍🦱', '👩‍🦰', '🧑‍🦳', '👨‍🦯', '🧕', '🧑‍🎤', '🧑‍💻', '👨‍🎨', '👩‍🚀', '🦸', '🧙', '🥷'];

export function getAvatarOptions(): { type: 'image' | 'emoji'; value: string }[] {
  const imageOptions = TRAINER_AVATAR_PRESETS.map(src => ({ type: 'image' as const, value: src }));
  if (imageOptions.length > 0) return imageOptions;
  // Fallback to emojis until real images are provided
  return EMOJI_FALLBACKS.map(e => ({ type: 'emoji' as const, value: e }));
}
