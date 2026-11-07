import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DialogueDefausse, {
  BOUTON_FOCUS_INITIAL,
  ORDRE_BOUTONS,
  cibleTabulation,
  decisionTouche,
  titreDialogue,
} from '../../src/app/DialogueDefausse';

const rendu = (): string =>
  renderToStaticMarkup(
    React.createElement(DialogueDefausse, { carte: '[R] Carte fictive', rang: 1, total: 2, onDecision: () => {} }),
  );

describe('DialogueDefausse — focus initial (D-26)', () => {
  it('le focus initial est sur « Passer », jamais sur le bouton destructeur', () => {
    expect(BOUTON_FOCUS_INITIAL).toBe('passer');
    expect(BOUTON_FOCUS_INITIAL).not.toBe('defausser');
  });

  it('l’ordre des boutons est Défausser, Passer, Arrêter le lot', () => {
    expect(ORDRE_BOUTONS).toEqual(['defausser', 'passer', 'arreter']);
  });
});

describe('DialogueDefausse — touches (D-26, D-43)', () => {
  it('Échap vaut « Passer »', () => {
    expect(decisionTouche('Escape')).toBe('passer');
  });

  it('Entrée et Espace ne décident jamais seuls (ils activent le bouton focalisé)', () => {
    expect(decisionTouche('Enter')).toBeNull();
    expect(decisionTouche(' ')).toBeNull();
    expect(decisionTouche('a')).toBeNull();
  });

  it('Tab boucle du dernier au premier bouton, Maj+Tab du premier au dernier', () => {
    expect(cibleTabulation('arreter', false)).toBe('defausser');
    expect(cibleTabulation('defausser', true)).toBe('arreter');
  });

  it('Tab au milieu laisse le navigateur faire', () => {
    expect(cibleTabulation('passer', false)).toBeNull();
    expect(cibleTabulation('passer', true)).toBeNull();
    expect(cibleTabulation('defausser', false)).toBeNull();
    expect(cibleTabulation('arreter', true)).toBeNull();
  });
});

describe('DialogueDefausse — rendu', () => {
  it('porte les attributs ARIA du dialogue modal', () => {
    const html = rendu();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby=');
    expect(html).toContain('aria-describedby=');
  });

  it('a trois boutons dans l’ordre, hors de tout formulaire', () => {
    const html = rendu();
    const a = html.indexOf('Défausser cette carte');
    const b = html.indexOf('>Passer<');
    const c = html.indexOf('Arrêter le lot');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(html).not.toContain('<form');
    expect(html).not.toContain('type="submit"');
  });

  it('annonce le caractère définitif et le rang de l’exemplaire', () => {
    const html = rendu();
    expect(html).toContain('Exemplaire 1 sur 2');
    expect(html).toContain('Cette action est définitive sur le site');
  });

  it('le titre garde la carte entière', () => {
    expect(titreDialogue('[R] Carte fictive')).toBe('Défausser [R] Carte fictive ?');
  });

  it('n’emploie ni animation ni transition ni couleur en dur', () => {
    const html = rendu();
    expect(html).not.toMatch(/animate-|transition|#[0-9a-f]{3,6}\b|rgb\(/i);
  });

  it('le bouton destructeur n’a pas de survol sur bg-line (D-44)', () => {
    const html = rendu();
    expect(html).toContain('hover:bg-ink-2');
    expect(html).not.toMatch(/border-defausser[^"]*hover:bg-line/);
  });
});
