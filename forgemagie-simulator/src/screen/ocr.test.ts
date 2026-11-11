import { describe, expect, it } from 'vitest';
import { parseDigits } from './ocr';

describe('parseDigits', () => {
  it('extrait un nombre simple', () => {
    expect(parseDigits('115')).toBe(115);
  });

  it('ignore les espaces, lettres et symboles parasites de l\'OCR', () => {
    expect(parseDigits(' 1 15 \n')).toBe(115);
    expect(parseDigits('ll5')).toBe(5);
  });

  it('ne garde que la valeur avant un "/" (format "valeur/max" du jeu)', () => {
    expect(parseDigits('39/40')).toBe(39);
    expect(parseDigits('115 / 130')).toBe(115);
  });

  it('renvoie null quand aucun chiffre n\'est reconnu', () => {
    expect(parseDigits('')).toBeNull();
    expect(parseDigits('abc')).toBeNull();
  });
});
