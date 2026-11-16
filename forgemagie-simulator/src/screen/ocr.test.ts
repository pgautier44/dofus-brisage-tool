import { describe, expect, it } from 'vitest';
import { parseDecimal, parseDigits } from './ocr';

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

  it('ignore le "%" des lignes affichées en pourcentage (% Critique, % Résistance Air)', () => {
    expect(parseDigits('4%')).toBe(4);
    expect(parseDigits('5 %')).toBe(5);
  });
});

describe('parseDecimal (puits / "reliquat")', () => {
  it('convertit la virgule française en point', () => {
    expect(parseDecimal('0,2')).toBe(0.2);
    expect(parseDecimal('12,5')).toBe(12.5);
  });

  it('accepte aussi un point décimal directement', () => {
    expect(parseDecimal('0.2')).toBe(0.2);
  });

  it('gère un entier sans séparateur', () => {
    expect(parseDecimal('100')).toBe(100);
  });

  it('ignore le texte parasite autour du nombre', () => {
    expect(parseDecimal('reliquat : 0,2')).toBe(0.2);
  });

  it('renvoie null quand aucun chiffre n\'est reconnu', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
});
