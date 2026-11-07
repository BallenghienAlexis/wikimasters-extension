import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EntreeJournal, Registre } from '../../src/lib/actions';
import Journal, {
  PAS_AFFICHAGE,
  entreesAffichees,
  entreesAvecRetrait,
  formaterHorodatage,
  libelleParametre,
  libelleResultat,
  libelleType,
  mentionNonAnnulable,
  rareteDe,
  raisonRetrait,
} from '../../src/app/Journal';
import DialogueVider from '../../src/app/DialogueVider';

const entree = (surcharge: Partial<EntreeJournal> = {}): EntreeJournal => ({
  id: '1-1',
  horodatage: '2026-11-07T14:02:11.000Z',
  idCarte: 'C|Carte fictive',
  titre: 'Carte fictive',
  type: 'pose-etiquette',
  parametre: 'Ami · Léa',
  resultat: 'reussie',
  codeHttp: 200,
  idLot: 'lot-1',
  ...surcharge,
});

const registre = (noms: string[] = []): Registre => ({
  version: 1,
  etiquettes: {},
  couples: noms.map((nom, i) => ({ ex: `ex-${i}`, nom })),
});

describe('entreesAvecRetrait (AC2)', () => {
  it('ne retient que la pose réussie la plus récente d’un couple encore au registre', () => {
    const ancienne = entree({ id: '1-1', horodatage: '2026-11-07T10:00:00.000Z' });
    const recente = entree({ id: '1-2', horodatage: '2026-11-07T12:00:00.000Z' });
    const r = entreesAvecRetrait([ancienne, recente], registre(['Ami · Léa']));
    expect([...r.keys()]).toEqual(['1-2']);
    expect(r.get('1-2')).toEqual({ idCarte: 'C|Carte fictive', nomEtiquette: 'Ami · Léa' });
  });

  it('exclut les étiquettes absentes du registre', () => {
    expect(entreesAvecRetrait([entree()], registre([])).size).toBe(0);
    expect(entreesAvecRetrait([entree()], registre(['Autre'])).size).toBe(0);
  });

  it('exclut les poses échouées, les autres types et les entrées sans paramètre', () => {
    const r = registre(['Ami · Léa']);
    expect(entreesAvecRetrait([entree({ resultat: 'echouee' })], r).size).toBe(0);
    expect(entreesAvecRetrait([entree({ type: 'enchere', parametre: '50' })], r).size).toBe(0);
    expect(entreesAvecRetrait([entree({ parametre: null })], r).size).toBe(0);
  });

  it('distingue deux cartes portant la même étiquette', () => {
    const a = entree({ id: '1-1', idCarte: 'C|A' });
    const b = entree({ id: '1-2', idCarte: 'C|B' });
    expect(entreesAvecRetrait([a, b], registre(['Ami · Léa'])).size).toBe(2);
  });
});

describe('raisonRetrait (AC2)', () => {
  it('sans onglet WikiMasters', () => {
    expect(raisonRetrait({ retraitDisponible: true, ongletPret: false })).toBe('Aucun onglet WikiMasters ouvert.');
  });
  it('retrait non disponible', () => {
    expect(raisonRetrait({ retraitDisponible: false, ongletPret: true })).toBe('Action non disponible.');
  });
  it('onglet d’abord quand les deux manquent', () => {
    expect(raisonRetrait({ retraitDisponible: false, ongletPret: false })).toBe('Aucun onglet WikiMasters ouvert.');
  });
  it('aucune raison quand tout est prêt', () => {
    expect(raisonRetrait({ retraitDisponible: true, ongletPret: true })).toBeNull();
  });
});

describe('mentionNonAnnulable (AC3)', () => {
  it('enchère et défausse réussies seulement', () => {
    expect(mentionNonAnnulable(entree({ type: 'enchere', resultat: 'reussie' }))).toBe(true);
    expect(mentionNonAnnulable(entree({ type: 'defausse', resultat: 'reussie' }))).toBe(true);
    expect(mentionNonAnnulable(entree({ type: 'defausse', resultat: 'echouee' }))).toBe(false);
    expect(mentionNonAnnulable(entree({ type: 'defausse', resultat: 'passee' }))).toBe(false);
    expect(mentionNonAnnulable(entree({ type: 'pose-etiquette', resultat: 'reussie' }))).toBe(false);
  });
});

describe('libellés (AC1)', () => {
  it('résultats en toutes lettres', () => {
    expect(libelleResultat('reussie')).toBe('réussie');
    expect(libelleResultat('echouee')).toBe('échouée');
    expect(libelleResultat('passee')).toBe('passée');
    expect(libelleResultat('interrompue')).toBe('interrompue');
    expect(libelleResultat('inconnu')).toBe('résultat inconnu, à vérifier sur le site');
    expect(libelleResultat('en-cours')).toBe('en cours');
  });
  it('types en toutes lettres', () => {
    expect(libelleType('enchere')).toBe('Mettre aux enchères');
    expect(libelleType('defausse')).toBe('Défausser');
    expect(libelleType('pose-etiquette')).toBe('Étiquette');
  });
  it('paramètres', () => {
    expect(libelleParametre(entree({ type: 'enchere', parametre: '50' }))).toBe('à 50');
    expect(libelleParametre(entree())).toBe('Ami · Léa');
    expect(libelleParametre(entree({ parametre: null }))).toBeNull();
  });
  it('rareté et horodatage', () => {
    expect(rareteDe('C|Titre | avec barre')).toBe('C');
    expect(rareteDe('sans-separateur')).toBe('');
    expect(formaterHorodatage('2026-11-07T14:02:11.000Z')).toMatch(/^2026-11-0[78] \d{2}:\d{2}:\d{2}$/);
  });
});

describe('entreesAffichees (D-31)', () => {
  const beaucoup = Array.from({ length: 120 }, (_, i) => entree({ id: `1-${i + 1}` }));
  it('plus récentes d’abord, 50 puis 50 de plus', () => {
    expect(PAS_AFFICHAGE).toBe(50);
    const a = entreesAffichees(beaucoup, 50);
    expect(a.visibles).toHaveLength(50);
    expect(a.visibles[0]!.id).toBe('1-120');
    expect(a.restantes).toBe(70);
    expect(entreesAffichees(beaucoup, 150).restantes).toBe(0);
  });
});

describe('rendu en texte brut (AC1)', () => {
  const props = {
    registre: registre(),
    retraitDisponible: false,
    ongletPret: false,
    onRetirer: () => {},
    onVider: () => {},
  };

  it('échappe titre et paramètre venus du site', () => {
    const html = renderToStaticMarkup(
      React.createElement(Journal, {
        ...props,
        entrees: [entree({ titre: '<img src=x onerror=alert(1)>', parametre: '<b>x</b>' })],
      }),
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>x');
    expect(html).toContain('&lt;img');
  });

  it('entrée sans identifiant de carte : pas de repère de rareté, libellé sans crochets (écart assumé avec D-29)', () => {
    const html = renderToStaticMarkup(
      React.createElement(Journal, { ...props, registre: registre(['Ami · Léa']), entrees: [entree({ idCarte: '' })] }),
    );
    expect(html).toContain('aria-label="Retirer l’étiquette « Ami · Léa » de Carte fictive"');
    expect(html).not.toContain('[] ');
    expect(html).not.toContain('[C]');
  });

  it('journal vide : message et bouton Vider désactivé avec raison', () => {
    const html = renderToStaticMarkup(React.createElement(Journal, { ...props, entrees: [] }));
    expect(html).toContain('Le journal est vide. Les actions envoyées au site apparaîtront ici.');
    expect(html).toContain('aria-disabled="true"');
  });

  it('journal illisible', () => {
    const html = renderToStaticMarkup(React.createElement(Journal, { ...props, entrees: [], illisible: true }));
    expect(html).toContain('Le journal est illisible et n’a pas été modifié.');
  });

  it('mention non annulable sans bouton d’annulation', () => {
    const html = renderToStaticMarkup(
      React.createElement(Journal, { ...props, entrees: [entree({ type: 'defausse', parametre: null })] }),
    );
    expect(html).toContain('Non annulable par l’extension');
    expect(html).not.toMatch(/Annuler/);
  });

  it('bouton Retirer avec aria-label unique, désactivé avec sa raison', () => {
    const html = renderToStaticMarkup(
      React.createElement(Journal, { ...props, registre: registre(['Ami · Léa']), entrees: [entree()] }),
    );
    expect(html).toContain('aria-label="Retirer l’étiquette « Ami · Léa » de [C] Carte fictive"');
    expect(html).toContain('Aucun onglet WikiMasters ouvert.');
  });
});

describe('DialogueVider (AC4)', () => {
  it('structure modale et libellés', () => {
    const html = renderToStaticMarkup(React.createElement(DialogueVider, { onAnnuler: () => {}, onConfirmer: () => {} }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Vider le journal ?');
    expect(html).toContain('Cela efface l’historique local. La collection et les étiquettes enregistrées ne sont pas touchées.');
    expect(html.indexOf('Annuler')).toBeLessThan(html.indexOf('>Vider<'));
  });
});

describe('DialogueVider, focus au clic sur le voile', () => {
  it('le voile remet le focus sur « Annuler » au mousedown, sans fermer', () => {
    const source = readFileSync('src/app/DialogueVider.tsx', 'utf8');
    expect(source).toMatch(/onMouseDown={/);
    expect(source).toMatch(/annuler.current?.focus()/);
    expect(source).not.toMatch(/onClick={onAnnuler}[^>]*data-testid/);
  });
});

describe('DialogueVider, styles des boutons (D-10)', () => {
  it('« Annuler » et « Vider » en font-semibold, « Annuler » en text-paper', () => {
    const html = renderToStaticMarkup(React.createElement(DialogueVider, { onAnnuler: () => {}, onConfirmer: () => {} }));
    const boutons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
    expect(boutons).toHaveLength(2);
    for (const b of boutons) expect(b).toContain('font-semibold');
    expect(boutons[0]).toContain('text-paper');
  });
});

describe('boutons désactivés (rendu)', () => {
  it('« Vider » désactivé n’a pas cursor-pointer', () => {
    const html = renderToStaticMarkup(
      React.createElement(Journal, { entrees: [], registre: registre(), retraitDisponible: true, ongletPret: true, onRetirer: () => {}, onVider: () => {} }),
    );
    const bouton = html.match(/<button[^>]*>Vider<\/button>/)?.[0] ?? '';
    expect(bouton).toContain('cursor-not-allowed');
    expect(bouton).not.toContain('cursor-pointer');
  });
});
