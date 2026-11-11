import type { Rng } from './types';

/**
 * Mulberry32 : PRNG rapide et simple, suffisant pour la simulation (pas un usage
 * cryptographique). Même seed => même séquence, pour des tests reproductibles.
 */
export function createSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG non déterministe, pour le jeu "pour de vrai" (pas pour les tests). */
export const mathRandomRng: Rng = () => Math.random();
