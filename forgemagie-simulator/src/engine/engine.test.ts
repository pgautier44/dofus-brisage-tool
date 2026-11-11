import { describe, expect, it } from 'vitest';
import { LINES, MON_ANNEAU_HDV_VALUES, RUNE_BY_ID } from './config';
import { lineCap } from './caps';
import { applyLoss } from './loss';
import { createSeededRng } from './rng';
import { createObjectState } from './state';
import { getCoachAdvice } from './coach';

describe('plafonds (cap / PA max 1)', () => {
  it('calcule le plafond comme max + max(1, round(max*0.25))', () => {
    expect(lineCap(LINES.vi)).toBe(130 + 33); // round(32.5) = 33
    expect(lineCap(LINES.do)).toBe(6 + 2); // round(1.5) = 2
    expect(lineCap(LINES.pro)).toBe(15 + 4); // round(3.75) = 4
  });

  it('plafonne toujours le PA à 1, quel que soit son max de table (0)', () => {
    expect(lineCap(LINES.pa)).toBe(1);
  });

  it("n'autorise jamais le PA à dépasser 1 via applyLoss/gain répétés", () => {
    const rng = createSeededRng(42);
    let state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 1 });
    for (let i = 0; i < 200; i++) {
      const result = applyLoss(state, 5 + Math.floor(rng() * 50), 'vi', { isGaPaRune: false, rng });
      state = result.nextState;
      expect(state.values.pa).toBeLessThanOrEqual(1);
    }
  });
});

describe('applyLoss', () => {
  it('puise en priorité dans le puits, sans toucher aux lignes si le puits suffit', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES }, 50);
    const rng = createSeededRng(1);
    const { nextState, detail } = applyLoss(state, 20, 'vi', { isGaPaRune: false, rng });

    expect(detail.fromPuits).toBe(20);
    expect(detail.linesLost).toHaveLength(0);
    expect(nextState.puits).toBe(30);
    expect(nextState.values).toEqual(state.values);
  });

  it("renvoie l'excédent de points entiers en reliquat dans le puits", () => {
    // puits à 0, une seule ligne non nulle (Do, poids/point = 20) hors ligne exclue :
    // un montant de 1 force à retirer 1 point complet = 20 de poids, soit 19 de reliquat.
    const zeroValues = { pa: 0, vi: 0, age: 0, pui: 0, cri: 0, do: 5, rair: 0, rterre: 0, rfeu: 0, pro: 0 };
    const state = createObjectState(zeroValues, 0);
    const rng = createSeededRng(7);
    const { nextState, detail } = applyLoss(state, 1, 'vi', { isGaPaRune: false, rng });

    expect(detail.fromPuits).toBe(0);
    expect(detail.linesLost).toEqual([{ line: 'do', points: 1 }]);
    expect(detail.reliquat).toBe(19);
    expect(nextState.puits).toBeCloseTo(19, 5);
  });

  it('absorbe partiellement via le puits puis complète en retirant des points', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES }, 10);
    const rng = createSeededRng(99);
    const { detail } = applyLoss(state, 40, 'vi', { isGaPaRune: false, rng });

    expect(detail.fromPuits).toBe(10);
    expect(detail.linesLost.length).toBeGreaterThan(0);
  });
});

describe('le PA ne peut jamais être retiré par une rune de poids < 10', () => {
  it('reste intact sur de nombreux tirages de pertes légères (montant < 10)', () => {
    const rng = createSeededRng(123);
    let paEverTargeted = false;

    for (let i = 0; i < 500; i++) {
      const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 1 });
      const montant = 1 + Math.floor(rng() * 9); // toujours < 10
      const { detail } = applyLoss(state, montant, 'vi', { isGaPaRune: false, rng });
      if (detail.linesLost.some((l) => l.line === 'pa')) paEverTargeted = true;
    }

    expect(paEverTargeted).toBe(false);
  });
});

describe('RNG seedé (Mulberry32)', () => {
  it('produit la même séquence pour une même seed', () => {
    const a = createSeededRng(2026);
    const b = createSeededRng(2026);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produit des séquences différentes pour des seeds différentes', () => {
    const a = createSeededRng(1);
    const b = createSeededRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('reste dans [0, 1)', () => {
    const rng = createSeededRng(555);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('coach : phases A et B', () => {
  it('phase A, Cri sous le minimum -> conseille la rune Cri', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 0, cri: 3 });
    const advice = getCoachAdvice(state);
    expect(advice.phase).toBe('A');
    expect(advice.rune?.id).toBe('cri');
  });

  it('phase A, Cri ok mais Do sous le minimum -> conseille la rune Do', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 0, cri: 4, do: 4 });
    const advice = getCoachAdvice(state);
    expect(advice.phase).toBe('A');
    expect(advice.rune?.id).toBe('do');
  });

  it('phase A, Cri et Do ok -> conseille Ga Pa', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 0, cri: 4, do: 5 });
    const advice = getCoachAdvice(state);
    expect(advice.phase).toBe('A');
    expect(advice.rune?.id).toBe('gaPa');
  });

  it('phase B, ne conseille jamais Cri, Do ou Ga Pa', () => {
    const state = createObjectState({
      ...MON_ANNEAU_HDV_VALUES,
      pa: 1,
      rair: 4,
      age: 30,
      pui: 7,
      vi: 110,
      rterre: 5,
      rfeu: 5,
    });
    const advice = getCoachAdvice(state);
    expect(advice.phase).toBe('B');
    expect(['gaPa', 'cri', 'do']).not.toContain(advice.rune?.id);
    if (advice.rune) {
      expect(advice.rune.weight).toBeLessThan(10);
    }
  });

  it('phase B, suit l\'ordre de priorité Ré Per Air > Agilité > Puissance > Vitalité > Ré Terre > Ré Feu', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 1, rair: 4, age: 30 });
    const advice = getCoachAdvice(state);
    expect(advice.rune?.line).toBe('rair');
  });

  it('phase B, Cri ou Do retombés sous le minimum -> "Accepte ou risque le PA", pas de rune conseillée', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 1, cri: 2 });
    const advice = getCoachAdvice(state);
    expect(advice.phase).toBe('B');
    expect(advice.rune).toBeNull();
    expect(advice.reason).toMatch(/Accepte ou risque le PA/);
  });

  it('objectif atteint -> phase done, goalReached true', () => {
    const state = createObjectState({ ...MON_ANNEAU_HDV_VALUES, pa: 1 });
    const advice = getCoachAdvice(state);
    expect(advice.phase).toBe('done');
    expect(advice.goalReached).toBe(true);
    expect(RUNE_BY_ID.gaPa).toBeDefined();
  });
});
