'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { useArenaStore } from '@/lib/store';
import { OAK_TRAINERS, OAK_ARENAS, OAK_CREATURES, OAK_TYPE_CHART, OAK_LORE } from '@/lib/oak-knowledge';

interface Message {
  id: string;
  role: 'user' | 'oak';
  content: string;
  timestamp: Date;
}

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const getOakResponse = (userMessage: string): string => {
  const msg = userMessage.toLowerCase().trim();
  const p = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  // ── GREETINGS ──────────────────────────────────────────────────────────────
  if (/^(hi|hey|hello|howdy|yo|sup|greetings|good morning|good afternoon|good evening|what's up|wassup|hiya|heya)[s!?]*$/.test(msg)) {
    return p([
      "Hello there! Welcome to Arena 151! I'm Professor Oak — researcher, Pokédex author, and your guide to the world of Pokémon. Ask me about any of the 151, the trainers you'll face, the arenas, battle strategy, or how the game works!",
      "Ah, a trainer! I've spent my life studying Pokémon, and I'm delighted to share that knowledge here in Arena 151. What would you like to know today?",
      "Greetings! Professor Samuel Oak, at your service. Whether it's Pokédex facts, draft tips, or trainer lore — I have answers. What's on your mind?",
    ]);
  }

  // ── SPECIFIC POKÉMON LORE ──────────────────────────────────────────────────
  for (const [key, lore] of Object.entries(OAK_LORE)) {
    if (msg.includes(key)) return `${lore}`;
  }

  // ── TRAINER KNOWLEDGE ─────────────────────────────────────────────────────
  if (msg.match(/trainer|opponent|who is|tell me about|face.*red|battle.*red/) && msg.includes('red') && !msg.includes('reduc')) {
    const t = OAK_TRAINERS['red'];
    return `${t.name} — ${t.role}. ${t.lore} Arena ability: ${t.ability} Signature Pokémon: ${t.signature}. Tip: ${t.tip}`;
  }
  if (msg.includes('ash') && msg.match(/trainer|who is|tell me|ash ketchum/)) {
    const t = OAK_TRAINERS['ash'];
    return `${t.name} — ${t.role}. ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/gary|gary oak|rival/) && !msg.includes('sugar')) {
    const t = OAK_TRAINERS['gary'];
    return `${t.name} — ${t.role}. ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/brock|pewter/) && !msg.includes('broccoli')) {
    const t = OAK_TRAINERS['brock'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/misty|cerulean/) && !msg.includes('misty.*weather')) {
    const t = OAK_TRAINERS['misty'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/erika|celadon/)) {
    const t = OAK_TRAINERS['erika'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/koga|fuchsia|ninja/)) {
    const t = OAK_TRAINERS['koga'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/sabrina|saffron|psychic.*gym/)) {
    const t = OAK_TRAINERS['sabrina'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/blaine|cinnabar/)) {
    const t = OAK_TRAINERS['blaine'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/giovanni|team rocket boss|viridian.*gym/)) {
    const t = OAK_TRAINERS['giovanni'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/lorelei|ice.*elite|elite.*ice/)) {
    const t = OAK_TRAINERS['lorelei'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/bruno|fighting.*elite|elite.*fight/)) {
    const t = OAK_TRAINERS['bruno'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/agatha|ghost.*elite|elite.*ghost/)) {
    const t = OAK_TRAINERS['agatha'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/lance|dragon.*master|dragon.*elite|champion.*dragon/)) {
    const t = OAK_TRAINERS['lance'];
    return `${t.name} — ${t.role} (${t.type}). ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/mr.*fuji|fuji|lavender.*town.*keeper|mewtwo.*creator/)) {
    const t = OAK_TRAINERS['fuji'];
    return `${t.name} — ${t.role}. ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/jessie|james|team rocket.*duo|prepare for trouble/)) {
    const t = OAK_TRAINERS['jessie-james'];
    return `${t.name} — ${t.role}. ${t.lore} Arena ability: ${t.ability} Tip: ${t.tip}`;
  }
  if (msg.match(/professor oak|who are you|your name|tell me about yourself/) && !msg.match(/compare|vs/)) {
    const t = OAK_TRAINERS['oak'];
    return `${t.name} — ${t.role}. ${t.lore} In battle, my ability is: ${t.ability} I favor Dragonite as my signature Pokémon.`;
  }

  // ── ALL TRAINERS LIST ──────────────────────────────────────────────────────
  if (msg.match(/list.*trainer|all.*trainer|who.*trainer|trainer.*list/)) {
    return "Arena 151 features 17 trainers — each with unique abilities and lore! Gym Leaders: Brock (Rock), Misty (Water), Erika (Grass), Koga (Poison), Sabrina (Psychic), Blaine (Fire), Giovanni (Ground). Elite Four: Lorelei (Ice), Bruno (Fighting), Agatha (Ghost), Lance (Dragon). Special: Red (Champion), Ash, Gary, Professor Oak, Mr. Fuji, and Jessie & James. Ask me about any of them!";
  }

  // ── ARENA KNOWLEDGE ────────────────────────────────────────────────────────
  if (msg.match(/pallet.*town.*arena|pallet.*field/)) {
    const a = OAK_ARENAS['pallet_town'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/cinnabar|volcano.*arena/)) {
    const a = OAK_ARENAS['cinnabar'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/pewter.*arena|brock.*arena|rock.*arena/)) {
    const a = OAK_ARENAS['pewter'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/celadon.*garden|erika.*arena|grass.*garden/)) {
    const a = OAK_ARENAS['celadon'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/lavender.*tower|lavender.*summit/)) {
    const a = OAK_ARENAS['lavender'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/viridian.*arena|giovanni.*arena|ground.*arena/)) {
    const a = OAK_ARENAS['viridian'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/fuchsia.*dojo|koga.*arena|poison.*dojo/)) {
    const a = OAK_ARENAS['fuchsia'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/ice.*arena|lorelei.*arena|final.*ice/)) {
    const a = OAK_ARENAS['ice_arena'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/vermilion|electric.*arena|surge.*arena/)) {
    const a = OAK_ARENAS['vermilion'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/mewtwo.*lab|underground.*lab|laboratory/)) {
    const a = OAK_ARENAS['mewtwo_lab'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/cerulean.*arena|misty.*arena|water.*arena/)) {
    const a = OAK_ARENAS['cerulean'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/saffron.*chamber|sabrina.*arena|psychic.*chamber/)) {
    const a = OAK_ARENAS['saffron'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/rocket.*hideout|team.*rocket.*arena|casino/)) {
    const a = OAK_ARENAS['rocket_hideout'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/stone.*arena|final.*stone|bruno.*arena/)) {
    const a = OAK_ARENAS['stone_arena'];
    return `${a.name}: ${a.types.join('/')} type arena. Event: ${a.event} (${a.eventChance} chance). Strategy: ${a.tip}`;
  }
  if (msg.match(/all.*arena|list.*arena|arena.*list|which.*arena|how many.*arena/)) {
    return "Arena 151 has 14 battlegrounds, each tied to iconic Kanto locations! Pallet Town Field, Pewter City Rock Arena, Cerulean City Water Arena, Vermilion City Electric Arena, Celadon Grassy Garden, Fuchsia Poison Dojo, Saffron Psychic Chamber, Cinnabar Volcano, Lavender Tower Summit, Viridian Ground Arena, Team Rocket Hideout, Mewtwo's Underground Laboratory, Final Four Stone Arena, and the Final Four Ice Arena. Ask me about any of them!";
  }

  // ── STAT RANKINGS ─────────────────────────────────────────────────────────
  if (msg.match(/highest.*attack|most.*attack|strongest.*attack|best.*attack|most.*atk|highest.*atk/)) {
    return "Dragonite has the highest base Attack in Arena 151 at ATK:110 — no other Pokémon touches it. It costs 23 points. Behind it: Aerodactyl (ATK:105, cost 19), Moltres (ATK:100), Gyarados (ATK:100, Moxie scales it further), and Nidoking (ATK:102, cost 19 — best value). Mewtwo's ATK:90 looks lower but its passive and move pool make it overall more versatile.";
  }
  if (msg.match(/fastest|highest.*speed|most.*speed|highest.*spe|quickest/)) {
    return "The fastest Pokémon in Arena 151 are Aerodactyl (#142) and Jolteon (#135) — both at SPE:130. Neither is legendary, making them exceptional value! After those: Tauros (SPE:110, cost 21), Starmie (SPE:115, cost 21 — actually fastest at that tier), Mewtwo (SPE:105, cost 25), Scyther (SPE:105, cost 19). Speed determines who attacks first each turn — it matters enormously.";
  }
  if (msg.match(/tankiest|most.*defense|highest.*def|bulkiest|most.*hp|highest.*hp/)) {
    return "The tankiest Pokémon in Arena 151 combine HP and DEF. Top HP: Mewtwo, Mew, Dragonite, Articuno, Lapras, Venusaur, Blastoise — all at HP:175 or HP:165. Top DEF: Blastoise (DEF:100), Articuno (DEF:100), Kabutops (DEF:105), Omastar (DEF:125 — highest in game!). For raw survivability, Lapras (HP:165, DEF:80, Water Absorb) and Blastoise (HP:165, DEF:100) are my top picks.";
  }
  if (msg.match(/strongest|best.*overall|most powerful|best.*pokemon|top.*pokemon|who.*best/)) {
    return "The strongest Pokémon overall depends on what you need! For raw power: Mewtwo (cost 25, SPE:105, ATK:90, unmatched moveset). For highest attack: Dragonite (cost 23, ATK:110, Multiscale reduces the first hit by 25%). For speed: Aerodactyl or Jolteon (SPE:130). For value: Nidoking (cost 19, ATK:102, Sheer Force). Most complete team anchor: Mewtwo or Dragonite. Most cost-efficient: Nidoking or Aerodactyl. The 'best' depends on your strategy!";
  }
  if (msg.match(/best.*water|top.*water|strongest.*water/)) {
    return "Best Water-types in Arena 151: Blastoise (HP:165, DEF:100, Torrent +8%) for defense; Gyarados (ATK:100, Moxie scales per KO) for offense; Starmie (SPE:115, Water/Psychic dual type) for speed; Lapras (HP:165, Water Absorb) for bulk. Budget pick: Vaporeon at cost 19 with Water Absorb healing. All cost 19-21. Mix in Kabutops (cost 19, ATK:100, DEF:105) if you want a physical wall.";
  }
  if (msg.match(/best.*fire|top.*fire|strongest.*fire/)) {
    return "Best Fire-types in Arena 151: Charizard (cost 21, SPE:100, Blaze +8% below 33% HP, Flying type avoids Ground) — my personal favorite. Moltres (cost 23, ATK:100, Pressure stacks +5% Fire ATK). Arcanine (high tier, powerful with solid stats). Flareon (cost 19, Flash Fire gives +10% Fire moves — highest Fire multiplier). Budget: Rapidash and Arcanine in the 15-17 range.";
  }
  if (msg.match(/best.*electric|top.*electric|strongest.*electric/)) {
    return "Best Electric-types in Arena 151: Zapdos (cost 23, SPE:100, Static paralyzes on contact) — elite tier. Jolteon (cost 19, SPE:130 — fastest, Volt Absorb heals from Electric hits). Raichu (cost 17, SPE:110, Lightning Rod). Magneton for budget Electric coverage. In Vermilion City Electric Arena, all Electric moves get boosted — Zapdos there is fearsome.";
  }
  if (msg.match(/best.*psychic|top.*psychic|strongest.*psychic/)) {
    return "Best Psychic-types in Arena 151: Mewtwo is in a class of its own at cost 25 (SPE:105, ATK:90, moveset covers Ice, Shadow, and more). Mew (cost 25, equally priced, more versatile but slightly less raw power). Alakazam for mid-tier — blindingly fast. Starmie doubles as Water/Psychic at cost 21. In Mewtwo's Underground Laboratory, Psychic Surge fires at 12% — terrifying for Psychic teams.";
  }
  if (msg.match(/best.*dragon|top.*dragon|strongest.*dragon/)) {
    return "Dragon-types in Arena 151: Dragonite reigns supreme (cost 23, ATK:110 — highest in game, Multiscale absorbs 25% of first hit). Dragonair at lower cost if you need Dragon coverage on a budget. In Gen 1, Dragon is only super effective against Dragon — but Dragonite's physical bulk and Flying sub-type make it exceptional in almost any matchup. Ice moves are its main counter.";
  }
  if (msg.match(/best.*ice|top.*ice|strongest.*ice/)) {
    return "Best Ice-types in Arena 151: Articuno (cost 23, HP:175, DEF:100, Pressure PP drain) — the ultimate Ice wall and Dragon counter. Lapras (cost 21, Water/Ice dual type, HP:165, Water Absorb). Cloyster for budget Ice/Water with high defense. Ice is the premier type for countering Dragon and Flying teams — bring it when you expect Lance or Dragonite.";
  }
  if (msg.match(/best.*ghost|top.*ghost|strongest.*ghost/)) {
    return "Best Ghost-types in Arena 151: Gengar is the unchallenged king — Ghost/Poison, immune to Normal and Fighting, fast and hits hard. Haunter is the mid-evolution option. Ghost is immune to Normal and Fighting moves — incredible defensive utility. In Agatha's domain, Shadow Hex makes status moves even more threatening. Pair Gengar with Psychic or Ground moves for coverage.";
  }
  if (msg.match(/best.*grass|top.*grass|strongest.*grass/)) {
    return "Best Grass-types in Arena 151: Venusaur (cost 21, HP:165, Thick Fat resists Fire) — the most well-rounded Grass type. Exeggutor (Grass/Psychic dual type — excellent coverage). Vileplume for poison/grass utility. Grass is strong against Water, Ground, and Rock — perfect against Brock, Misty, or Giovanni. In Celadon Grassy Garden, Petal Dance heals your Grass Pokémon every few turns.";
  }
  if (msg.match(/best.*ground|top.*ground|strongest.*ground/)) {
    return "Best Ground-types in Arena 151: Nidoking (cost 19, ATK:102, Sheer Force +8% — best value Ground pick). Nidoqueen (similar cost and stats). Dugtrio for pure speed-based Ground attacks. Rhydon for bulk. Ground is immune to Electric — invaluable against Zapdos, Jolteon, and Vermilion City Electric Arena. Earthquake hits both Rock and Poison types for great coverage.";
  }
  if (msg.match(/best.*normal|top.*normal/)) {
    return "Best Normal-types in Arena 151: Tauros (cost 21, SPE:110 — fastest at tier, Intimidate drops enemy ATK). Snorlax (cost 21, ATK:100, Thick Fat, nearly unkillable). Kangaskhan (cost 19, Scrappy lets Normal/Fighting moves hit Ghost types). Normal has no super-effective matchup but also very few weaknesses — great for neutral coverage builds.";
  }

  // ── LEGENDARY & SPECIAL ───────────────────────────────────────────────────
  if (msg.match(/legendary|legendaries|legendary.*bird|bird.*legendary/)) {
    return "The three legendary birds of Kanto are in Arena 151 — each costs 23 points: Articuno (Ice/Flying, HP:175, DEF:100 — tankiest), Zapdos (Electric/Flying, SPE:100, Static paralyze), Moltres (Fire/Flying, ATK:100, +5% Fire ATK). Then there's Dragonite (Dragon/Flying, ATK:110 — highest in game) at 23 pts and the ultimate legends Mewtwo and Mew at 25 pts. Legendaries cost 23-25 of your 60-point budget — plan accordingly!";
  }
  if (msg.match(/dragonite/) && !OAK_LORE['dragonite']) {
    return "Dragonite holds the record for highest Attack in Arena 151 at ATK:110. It costs 23 points and comes with Multiscale — the first hit deals 25% less damage. Dragon/Flying dual typing gives it excellent offensive and defensive coverage. Lance, the Dragon Master of the Elite Four, uses Dragonite as his signature. Ice moves are your best counter.";
  }
  if (msg.match(/mewtwo/) && !OAK_LORE['mewtwo']) {
    return "Mewtwo — the Pokémon I helped create, and my greatest regret and pride. In Arena 151, it's the most expensive pick at 25 points: SPE:105, ATK:90, HP:175. Its move pool includes Psystrike, Aura Sphere, Ice Beam, and Shadow Ball — near-impossible to counter with one defensive typing. The Underground Laboratory arena boosts its Psychic power even further.";
  }

  // ── DRAFT STRATEGY ────────────────────────────────────────────────────────
  if (msg.match(/best.*team|team.*build|team.*comp|draft.*strategy|how.*draft|build.*team/)) {
    return p([
      "The best teams in Arena 151 balance attack, speed, and type coverage. Here's my research-backed formula: 1) Pick one 21-23 point ace (Dragonite, Charizard, Starmie). 2) Pick one 19 point value pick (Nidoking, Aerodactyl, Jolteon). 3) Fill the remaining ~20 points with two complementary Pokémon. Example: Dragonite (23) + Nidoking (19) + Misty's picks (13 + 5). That leaves you covered for Water, Ground, Dragon, and Normal.",
      "My draft research shows the strongest teams have: type coverage across at least 3 different types, at least one fast Pokémon (SPE 90+), and one bulky anchor (HP 150+ or DEF 85+). A 25-point Mewtwo leaves only 35 for three Pokémon — use two 13-pointers and one 9-pointer to stretch the budget.",
      "Value drafting is often stronger than stacking legendaries. Aerodactyl at 19 points (SPE:130, ATK:105) outpaces everything in the game that costs less than 25. Nidoking at 19 points (ATK:102, Sheer Force) hits as hard as most 21-point picks. A team of 19+19+13+9 can compete with Mewtwo teams if you play smart.",
    ]);
  }
  if (msg.match(/budget|point|cost|expensive|cheap|how.*many.*point|total.*point/)) {
    return "Every trainer gets 60 points in the draft to build a team of 4 Pokémon! Cost tiers: 7-9 pts (budget basics like Rattata, Pidgey), 11-15 pts (solid mid-tier like Pikachu, Beedrill), 17-19 pts (high-value like Jolteon, Nidoking, Aerodactyl), 21 pts (stage 3 starters, Snorlax, Tauros), 23 pts (legendary birds, Dragonite), 25 pts (Mewtwo, Mew). Clicking a Pokémon you already picked removes it and refunds the points.";
  }
  if (msg.match(/order|lineup|which.*first|lead.*pokemon|first.*pokemon|team.*order/)) {
    return "Team ordering is as important as team building! Your lead Pokémon faces the opponent first — choose one that can either: 1) survive a first hit (high HP/DEF), 2) go first and strike hard (high SPE), or 3) force an unfavorable matchup for the opponent. Save your ace for the mid-to-late game when you know what you're facing. Never lead with your only answer to a specific threat.";
  }

  // ── TYPE MATCHUPS ─────────────────────────────────────────────────────────
  if (msg.match(/type.*chart|type.*matchup|type.*advantage|what.*beat|counter.*type|type.*counter/)) {
    return "The Gen 1 type chart — my area of expertise! Key rules: Fire beats Grass/Ice/Bug/Steel. Water beats Fire/Ground/Rock. Grass beats Water/Ground/Rock. Electric beats Water/Flying — but Ground is immune. Psychic beats Fighting/Poison — but Dark is immune. Ghost beats Ghost/Psychic — but Normal is immune to Ghost. Ice beats Dragon/Flying/Grass/Ground. Fighting beats Normal/Ice/Rock. Ask me about a specific type and I'll give you the full breakdown!";
  }
  if (msg.match(/fire.*type|what.*beat.*fire|counter.*fire/)) {
    const t = OAK_TYPE_CHART['fire'];
    return `Fire types are strong against: ${t.strong.join(', ')}. They're weak to: ${t.weak.join(', ')}. Best Fire picks in Arena 151: Charizard (SPE:100, Flying avoids Ground), Moltres (ATK:100, +5% Fire ATK passive), Flareon (Flash Fire +10%). Water, Ground, and Rock moves will handle them.`;
  }
  if (msg.match(/water.*type|what.*beat.*water|counter.*water/)) {
    const t = OAK_TYPE_CHART['water'];
    return `Water types are strong against: ${t.strong.join(', ')}. They're weak to: ${t.weak.join(', ')}. Best Water picks: Blastoise (DEF:100), Gyarados (ATK:100 + Moxie), Starmie (SPE:115). Electric and Grass moves counter them — but Starmie's Ice Beam coverage complicates that.`;
  }
  if (msg.match(/electric.*type|what.*beat.*electric|counter.*electric/)) {
    const t = OAK_TYPE_CHART['electric'];
    return `Electric types are strong against: ${t.strong.join(', ')}. Weak to: ${t.weak.join(', ')}. Ground types are ${t.immune.join(', ')} — completely immune! Best Electric picks: Zapdos (SPE:100, Static), Jolteon (SPE:130, Volt Absorb). Bring a Ground-type Pokémon to shut down any Electric team.`;
  }
  if (msg.match(/psychic.*type|what.*beat.*psychic|counter.*psychic/)) {
    return "Psychic types are strong against Fighting and Poison. In Gen 1, Dark types are immune to Psychic — they're your safest counter. Bug types also hit Psychic for super effective damage. Key note: in Arena 151's Underground Laboratory and Saffron City arenas, Psychic moves are boosted — even harder to deal with. Mewtwo and Alakazam are the pinnacle of this type.";
  }
  if (msg.match(/dragon.*type|what.*beat.*dragon|counter.*dragon/)) {
    return "Dragon types are only super effective against other Dragon types — but Ice moves are also super effective against Dragon/Flying Pokémon like Dragonite! Bring Articuno, Lapras, or Cloyster to counter Lance and Dragonite. Dragon types resist Fire, Water, Grass, and Electric — four of the most common offensive types. They're uniquely difficult to hit for super effective damage.";
  }
  if (msg.match(/ghost.*type|what.*beat.*ghost|counter.*ghost/)) {
    return "Ghost types are immune to Normal and Fighting moves entirely — physical attackers are useless against Gengar! Ghost moves are super effective against other Ghost and Psychic types. Dark types resist Ghost. To counter Agatha's Ghost team, use Psychic, Ground, or Dark moves. Don't waste Normal or Fighting moves — they literally do nothing.";
  }
  if (msg.match(/ground.*type|what.*beat.*ground|counter.*ground/)) {
    return "Ground types are strong against Fire, Electric, Poison, Rock, and Steel — one of the most valuable offensive types in the game! Flying types are completely immune to Ground moves. Grass and Bug are super effective against Ground. Giovanni's Ground team in Viridian City is powerful, but any Flying-type Pokémon laughs at his Earthquake events.";
  }

  // ── BATTLE MECHANICS ──────────────────────────────────────────────────────
  if (msg.match(/ultimate|ult|special.*move|big.*move/)) {
    return "Every Pokémon in Arena 151 has an Ultimate move — a powerful attack that charges over turns of battle. When the ULTIMATE button glows, that's your moment. Ultimates deal massive damage and often have special effects: Charizard's Mega Flamestorm, Blastoise's Tsunami Cannon, Dragonite's Sky Wrath. Save your Ultimate for when the opponent is vulnerable or when you need to finish a weakened Pokémon quickly.";
  }
  if (msg.match(/passive|ability.*pokemon|pokemon.*ability/)) {
    return "Each Pokémon has a unique Passive ability that activates automatically! Examples: Dragonite's Multiscale reduces the first hit by 25%, Charizard's Blaze gives +8% Fire damage below 33% HP, Gyarados's Moxie gives +10% ATK for each KO, Jolteon's Volt Absorb heals 10% when hit by Electric moves. Check each Pokémon's Pokédex card in the draft to see their passive before picking!";
  }
  if (msg.match(/crit|critical/)) {
    return "Critical hits deal bonus damage and occasionally trigger special announcer reactions! Faster Pokémon have a higher base critical hit rate in Gen 1. Bruno's Iron Fist ability boosts his Pokémon's critical hit damage — making his crits devastating. Red's Champion Focus gives his lead Pokémon +2% crit chance from the start. A timely crit can completely swing the momentum of a battle.";
  }
  if (msg.match(/turn.*order|who.*go.*first|speed.*turn|first.*attack/)) {
    return "Turn order in Arena 151 is determined by Speed (SPE)! Higher SPE means you attack first. Fastest Pokémon: Aerodactyl and Jolteon (SPE:130), Starmie (SPE:115), Tauros (SPE:110), Raichu (SPE:110), Mewtwo (SPE:105). Paralysis halves Speed. Arena events like Mountain Wind in Lavender Tower can lower both sides' speed mid-battle, changing turn order unexpectedly.";
  }
  if (msg.match(/heal|recover|hp.*restore|restore.*hp/)) {
    return "HP recovery in Arena 151 comes from several sources: Pokémon passives like Lapras's Water Absorb (heals 10% from Water moves) and Vaporeon's Water Absorb. Arena events like Petal Dance in Celadon Garden heal Grass types. Some Pokémon have Recover in their move pool (like Mewtwo). And trainer abilities like Erika's Natural Calm heal Grass Pokémon on entry. Build a team with recovery and you'll outlast most opponents.";
  }
  if (msg.match(/coin.*toss|who.*first.*pick|flip|toss/)) {
    return "Before every battle, a coin toss determines who picks their starting Pokémon first in the lineup phase! Winning the toss lets you see the opponent's lead and respond — a meaningful strategic advantage. The flip is random — may fortune favor you!";
  }
  if (msg.match(/status|poison.*battle|paralyze|burn|sleep|freeze|confuse/)) {
    return "Status conditions are powerful tools in Arena 151! Poison deals damage over time — Koga's Toxic Tactics passive gives his Pokémon +5% poison application chance. Paralysis halves Speed — huge against fast teams. Burn chips HP each turn. Sleep prevents the opponent from attacking. Agatha's Shadow Hex boosts her Ghost team's status and trick move effectiveness by 5%. Bring Pokémon with status resistance if you're facing Koga or Agatha.";
  }

  // ── ARENA / GAME SYSTEM ───────────────────────────────────────────────────
  if (msg.match(/how.*play|how.*game|how.*work|how.*battle|game.*work|what.*do|get started|begin|tutorial/)) {
    return "Here's the full Arena 151 flow: 1️⃣ Create your trainer profile and choose your favorite Pokémon. 2️⃣ Deposit SOL to your account. 3️⃣ Head to Road to Victory and choose a trainer. 4️⃣ Select a battle room based on your stakes. 5️⃣ Queue for a match — you'll be paired with an AI opponent. 6️⃣ Draft your team of 4 Pokémon (60-point budget). 7️⃣ Order your team strategically. 8️⃣ Battle turn-by-turn — use moves, save your Ultimate! The winner takes the prize pool.";
  }
  if (msg.match(/room|tier|pallet pot|gym challenger|elite clash|master ball|stake|entry.*fee|prize.*pool|battle.*room/)) {
    return "Arena 151 has 4 battle rooms! 🌱 Pallet Pot — 0.01 SOL entry, ~0.019 SOL prize (perfect for beginners). 🏆 Gym Challenger — 0.05 SOL entry, ~0.095 SOL prize. ⚔️ Elite Clash — 0.1 SOL entry, ~0.19 SOL prize. 👑 Master Ball Room — 0.5 SOL entry, ~0.95 SOL prize (elite trainers only). Prize pools are ~95% of double the entry fee. Start small, build your record, move up!";
  }
  if (msg.match(/sol|deposit|wallet|balance|fund|solana|crypto|address/)) {
    if (msg.match(/withdraw|cash.*out|take.*out/)) return "To withdraw SOL, head to your Trainer Profile and click the 'Withdraw SOL' button next to Deposit SOL. Enter your Solana wallet address, set your amount, and review the fee summary before confirming. The minimum withdrawal is $5 USD worth of SOL, and a small network fee is deducted automatically. Make absolutely sure your address is correct — Solana transactions are irreversible!";
    if (msg.match(/minimum|min.*deposit|minimum.*deposit/)) return "The minimum deposit is 0.01 SOL. Confirmations typically take about 60 seconds on the Solana network. Always send SOL only — sending other tokens to your Arena 151 wallet address cannot be recovered.";
    return "Arena 151 runs exclusively on Solana (SOL). Your account has a built-in wallet — find your deposit address in your Trainer Profile under the 'Deposit SOL' tab. Copy your address, send SOL from any Solana wallet, and your balance updates within a minute. SOL ONLY — never send other tokens!";
  }

  // ── PROFILE / SIGNUP ──────────────────────────────────────────────────────
  if (msg.match(/profile|signup|sign up|create.*account|account|username|bio|avatar|register/)) {
    return "Creating your trainer profile is step one! Choose your email, display name, and username. Pick an avatar — we have Ash, Misty, Brock, Professor Oak, Pikachu, Squirtle, Eevee, and Snorlax. Then select your signature Pokémon — the one that defines your identity. Your win/loss record and P&L build on your profile over time. It's your legacy in the making!";
  }

  // ── GEN 2+ POKÉMON ────────────────────────────────────────────────────────
  if (msg.match(/gen 2|generation 2|johto|chikorita|cyndaquil|totodile|pichu|togepi|umbreon|espeon|scizor|heracross|lugia|ho-oh|celebi|meganium|typhlosion|feraligatr/)) {
    return p([
      "Fascinating question — but my research is focused exclusively on the original 151 Pokémon of the Kanto region. The Arena may expand to Johto and beyond in the future, but for now my Pokédex ends at #151. Ask me anything about the original 151 and I'll have a detailed answer!",
      "Ah, you're asking about Pokémon from beyond Kanto! My studies haven't ventured that far yet. Arena 151 covers the original 151 — the region I know best. Perhaps one day the data will expand. For now, ask me about any Kanto Pokémon!",
    ]);
  }

  // ── MUSIC / AUDIO ─────────────────────────────────────────────────────────
  if (msg.match(/music|sound|audio|bgm|song|soundtrack/)) {
    return "Arena 151 features authentic Pokémon battle music! The classic menu theme plays on the homepage, and the iconic battle BGM kicks in during the Arena Reveal before combat. Turn up your volume — the music is half the experience. It's remarkable how those original compositions still create such excitement after all these years!";
  }

  // ── LEADERBOARD ───────────────────────────────────────────────────────────
  if (msg.match(/leaderboard|top.*player|best.*player|ranking|rank/)) {
    return "Arena 151 has a live Top 100 Leaderboard! Find it on the Road to Victory screen — it shows the top 100 trainers by wins, with tie-breaking by win rate and join date. Gold, silver, and bronze medals for the top three. It updates from real player data in real time. Do you have what it takes to claim a spot?";
  }

  // ── THANKS / GOODBYE ──────────────────────────────────────────────────────
  if (msg.match(/thank|thanks|thx|ty|bye|goodbye|see you|later|appreciate|cheers/)) {
    return p([
      "You're welcome, young trainer! Remember — the road to becoming a Pokémon Master starts with knowledge. Come back anytime my Pokédex is always open!",
      "Glad I could help! Now get out there, build your team, and write your legend in Arena 151. The data is on your side!",
      "It was my pleasure! A good trainer never stops learning. Best of luck in the arena — I'll be here if you need me.",
    ]);
  }

  // ── OFF-TOPIC REDIRECT ────────────────────────────────────────────────────
  if (msg.match(/weather|news|politics|crypto.*price|bitcoin|stocks|recipe|movie|sports|football|basketball|nba|nfl|cooking|travel/)) {
    return p([
      "Fascinating question — but I'm afraid that's outside my field of research! My expertise is the world of Pokémon. Ask me about the 151 Kanto species, the trainers, the arenas, draft strategy, or battle mechanics and I'll give you everything I know!",
      "Hmm, that's a bit outside the Pokédex! My research is focused on the original 151 Pokémon and Arena 151. I'd be happy to help with anything in that world — just ask!",
    ]);
  }

  // ── DEFAULT ───────────────────────────────────────────────────────────────
  return p([
    "That's an interesting question! I can help with specific Pokémon (ask me about any of the original 151!), trainer lore, arena knowledge, type matchups, draft strategy, battle mechanics, or how the SOL wallet system works. What would you like to know?",
    "Hmm, let me think on that! My expertise covers the 151 Pokémon species, every trainer and battleground in Arena 151, battle strategies, and Pokémon lore from Kanto. Ask me anything in those areas!",
    "As a researcher, I'm always eager to share knowledge! Try asking me about a specific Pokémon's stats, a trainer's lore, which Pokémon has the highest attack, or how a specific arena works. I'll give you the real data!",
  ]);
};

export default function ProfessorOak() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'oak',
      content: "Hello there! Welcome to Arena 151! I'm Professor Oak, your guide to the world of Pokémon battles! Ask me anything about Pokémon, battles, or how the arena works!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentScreen = useArenaStore((state) => state.currentScreen);

  // Hide during battle screens
  const shouldHide = currentScreen === 'battle' || currentScreen === 'versus';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/oak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Rate limited or error
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'oak',
          content: data.error || "My research notes seem to be out of reach at the moment. Try again shortly!",
          timestamp: new Date(),
        }]);
      } else {
        if (data.remaining !== undefined) setRemaining(data.remaining);
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'oak',
          content: data.reply,
          timestamp: new Date(),
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'oak',
        content: "My Pokédex seems to be having a moment. Please try again!",
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (shouldHide) return null;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-[-12px] z-50 w-20 h-20 rounded-full bg-gradient-to-r from-red-600 to-orange-600 shadow-2xl shadow-red-500/50 flex items-center justify-center border-4 border-white overflow-hidden group"
          >
            <img 
              src="/professor-oak.png" 
              alt="Professor Oak"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-40 transition-opacity"
            />
            <MessageCircle className="w-8 h-8 text-white relative z-10" />
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-[-12px] z-50 w-96 h-[600px] flex flex-col bg-slate-900/95 backdrop-blur-xl border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-4 flex items-center gap-3 border-b-4 border-yellow-400">
              <div className="w-12 h-12 rounded-full bg-white border-2 border-yellow-400 overflow-hidden flex-shrink-0">
                <img
                  src="/professor-oak.png"
                  alt="Professor Oak"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-white text-lg">Professor Oak</h3>
                <p className="text-xs text-yellow-200">Pokémon Expert</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {message.role === 'oak' && (
                    <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 overflow-hidden border-2 border-yellow-400">
                      <img
                        src="/professor-oak.png"
                        alt="Oak"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`flex-1 max-w-[80%] p-3 rounded-2xl ${
                      message.role === 'oak'
                        ? 'bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-600'
                        : 'bg-gradient-to-br from-blue-600 to-blue-500'
                    }`}
                  >
                    <p className="text-white text-sm leading-relaxed">{message.content}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-white flex-shrink-0 overflow-hidden border-2 border-yellow-400">
                    <img
                      src="/professor-oak.png"
                      alt="Oak"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="bg-slate-800 p-3 rounded-2xl border border-slate-600">
                    <div className="flex gap-1">
                      <motion.div
                        className="w-2 h-2 bg-slate-400 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      />
                      <motion.div
                        className="w-2 h-2 bg-slate-400 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      />
                      <motion.div
                        className="w-2 h-2 bg-slate-400 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t-2 border-slate-700 bg-slate-900/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Professor Oak anything..."
                  className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  disabled={isTyping}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-slate-700 disabled:to-slate-600 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                {remaining !== null
                  ? `${remaining} message${remaining === 1 ? '' : 's'} remaining today`
                  : 'Ask me anything about Pokémon or the game!'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
