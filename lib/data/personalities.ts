// ═══════════════════════════════════════════════════════════════
// ARENA 151 — CREATURE BATTLE PERSONALITIES
// ═══════════════════════════════════════════════════════════════

export type BattlePersonality =
  | 'aggressive' | 'balanced' | 'cautious'
  | 'trickster' | 'closer' | 'tanky' | 'desperate'

export const CREATURE_PERSONALITIES: Record<number, BattlePersonality> = {
  1: 'trickster', 2: 'trickster', 3: 'trickster',
  4: 'aggressive', 5: 'aggressive', 6: 'aggressive',
  7: 'balanced', 8: 'cautious', 9: 'cautious',
  10: 'desperate', 11: 'tanky', 12: 'trickster',
  13: 'desperate', 14: 'desperate', 15: 'aggressive',
  16: 'balanced', 17: 'balanced', 18: 'aggressive',
  19: 'aggressive', 20: 'aggressive',
  21: 'aggressive', 22: 'aggressive',
  23: 'trickster', 24: 'trickster',
  25: 'balanced', 26: 'aggressive',
  27: 'tanky', 28: 'cautious',
  29: 'balanced', 30: 'aggressive', 31: 'aggressive',
  32: 'balanced', 33: 'aggressive', 34: 'aggressive',
  35: 'trickster', 36: 'balanced',
  37: 'trickster', 38: 'trickster',
  39: 'trickster', 40: 'balanced',
  41: 'aggressive', 42: 'aggressive',
  43: 'trickster', 44: 'trickster', 45: 'trickster',
  46: 'trickster', 47: 'trickster',
  48: 'trickster', 49: 'trickster',
  50: 'desperate', 51: 'aggressive',
  52: 'cautious', 53: 'aggressive',
  54: 'balanced', 55: 'balanced',
  56: 'aggressive', 57: 'aggressive',
  58: 'aggressive', 59: 'aggressive',
  60: 'balanced', 61: 'balanced', 62: 'aggressive',
  63: 'cautious', 64: 'closer', 65: 'closer',
  66: 'aggressive', 67: 'aggressive', 68: 'aggressive',
  69: 'trickster', 70: 'trickster', 71: 'trickster',
  72: 'trickster', 73: 'trickster',
  74: 'tanky', 75: 'tanky', 76: 'tanky',
  77: 'aggressive', 78: 'aggressive',
  79: 'tanky', 80: 'cautious',
  81: 'balanced', 82: 'balanced',
  83: 'balanced',
  84: 'aggressive', 85: 'aggressive',
  86: 'cautious', 87: 'cautious',
  88: 'aggressive', 89: 'aggressive',
  90: 'tanky', 91: 'tanky',
  92: 'trickster', 93: 'trickster', 94: 'trickster',
  95: 'tanky',
  96: 'trickster', 97: 'trickster',
  98: 'tanky', 99: 'aggressive',
  100: 'desperate', 101: 'desperate',
  102: 'trickster', 103: 'trickster',
  104: 'tanky', 105: 'cautious',
  106: 'aggressive', 107: 'aggressive',
  108: 'tanky',
  109: 'tanky', 110: 'aggressive',
  111: 'tanky', 112: 'aggressive',
  113: 'tanky',
  114: 'tanky',
  115: 'aggressive',
  116: 'cautious', 117: 'cautious',
  118: 'balanced', 119: 'aggressive',
  120: 'closer', 121: 'closer',
  122: 'trickster',
  123: 'aggressive',
  124: 'trickster',
  125: 'aggressive', 126: 'aggressive',
  127: 'aggressive',
  128: 'aggressive',
  129: 'desperate', 130: 'aggressive',
  131: 'cautious',
  132: 'balanced',
  133: 'balanced',
  134: 'cautious',
  135: 'closer',
  136: 'aggressive',
  137: 'closer',
  138: 'tanky', 139: 'tanky',
  140: 'balanced', 141: 'aggressive',
  142: 'aggressive',
  143: 'tanky',
  144: 'cautious',
  145: 'aggressive',
  146: 'aggressive',
  147: 'balanced', 148: 'balanced', 149: 'aggressive',
  150: 'closer',
  151: 'closer',
}

export function getPersonality(creatureId: number): BattlePersonality {
  return CREATURE_PERSONALITIES[creatureId] ?? 'balanced'
}

export function getPersonalityMultiplier(
  personality: BattlePersonality,
  movePower: number,
  moveAccuracy: number,
  isUltimate: boolean,
  isStatus: boolean,
  hpRatio: number,
): number {
  switch (personality) {
    case 'aggressive':
      if (movePower >= 80) return 1.3
      if (isStatus) return 0.5
      return 1.0
    case 'cautious':
      if (moveAccuracy === 100 && movePower > 0 && movePower < 80) return 1.2
      if (moveAccuracy < 85 && movePower > 0) return 0.6
      return 1.0
    case 'trickster':
      if (isStatus) return 2.5
      if (movePower > 0 && movePower < 60) return 1.1
      if (movePower >= 100) return 0.6
      return 0.85
    case 'closer':
      if (isUltimate) return 2.2
      if (movePower >= 100) return 1.4
      return 1.0
    case 'tanky':
      if (isStatus) return 1.5
      if (movePower > 0 && movePower < 60) return 1.2
      if (movePower >= 100) return 0.65
      return 1.0
    case 'desperate':
      if (hpRatio < 0.33) {
        if (isUltimate) return 3.0
        if (movePower >= 80) return 1.6
      }
      return 1.0
    case 'balanced':
    default:
      return 1.0
  }
}
