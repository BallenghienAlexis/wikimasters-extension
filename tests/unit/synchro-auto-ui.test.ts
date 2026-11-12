import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EcartCarte } from '../../src/lib/ecarts';
import type { StatutSynchro } from '../../src/lib/stockage';
import { VueSynchroAuto, relancePossible, texteDerniereSynchro, texteEtatSynchro, texteRelance } from '../../src/app/SynchroAuto';

// Données fictives uniquement. Espace insécable avant « : » et autour de « h » (typographie française).
const NB = ' ';
const MAINTENANT = new Date(2026, 10, 9, 17, 0, 0).getTime();
const HEURE = new Date(2026, 10, 9, 16, 42, 0).getTime();

const statut = (surcharge: Partial<StatutSynchro> = {}): StatutSynchro => ({
  version: 1,
  etat: 'en-cours',
  page: 12,
  pages: 134,
  raison: null,
  codeHttp: null,
  le: HEURE,
  ajoutees: 0,
  etiquettes: 0,
  prix: 0,
  ...surcharge,
});

const etat = (o: { actif?: boolean; statut?: StatutSynchro | null; bail?: number | null }) =>
  texteEtatSynchro({ actif: o.actif ?? true, statut: o.statut ?? null, bail: o.bail ?? null, maintenant: MAINTENANT });

describe('T-206 D-01 : texte d’état', () => {
  it('désactivée', () => {
    expect(etat({ actif: false })).toBe('Désactivée');
    expect(etat({ actif: false, statut: statut(), bail: MAINTENANT + 1000 })).toBe('Désactivée');
  });

  it('en attente d’un onglet WikiMasters quand rien ne tourne', () => {
    expect(etat({})).toBe('En attente d’un onglet WikiMasters');
  });

  it('en cours : page N sur M, tant que le bail est valide', () => {
    expect(etat({ statut: statut(), bail: MAINTENANT + 60_000 })).toBe(`En cours${NB}: page 12 sur 134`);
    expect(etat({ statut: statut({ page: null, pages: null }), bail: MAINTENANT + 60_000 })).toBe('En cours');
    expect(etat({ statut: statut({ page: 3, pages: null }), bail: MAINTENANT + 60_000 })).toBe(`En cours${NB}: page 3`);
  });

  it('un statut « en cours » dont le bail a expiré n’est pas affiché comme en cours', () => {
    expect(etat({ statut: statut(), bail: MAINTENANT - 1 })).toBe('En attente d’un onglet WikiMasters');
    expect(etat({ statut: statut(), bail: null })).toBe('En attente d’un onglet WikiMasters');
  });

  it('terminée à HH h MM', () => {
    expect(etat({ statut: statut({ etat: 'termine' }) })).toBe(`Terminée à 16${NB}h${NB}42`);
  });

  it('arrêtée : refus du site, échecs ou arrêt manuel', () => {
    expect(etat({ statut: statut({ etat: 'arret', raison: 'code-http', codeHttp: 403 }) })).toBe(`Arrêtée${NB}: le site a refusé (403)`);
    expect(etat({ statut: statut({ etat: 'arret', raison: 'code-http', codeHttp: 429 }) })).toBe(`Arrêtée${NB}: le site a refusé (429)`);
    expect(etat({ statut: statut({ etat: 'arret', raison: 'echecs' }) })).toBe(`Arrêtée${NB}: la lecture a échoué`);
    expect(etat({ statut: statut({ etat: 'arret', raison: 'manuel' }) })).toBe('Arrêtée par vous');
  });
});

describe('T-206 D-01 : dernière synchro', () => {
  it('jamais faite', () => {
    expect(texteDerniereSynchro(null, null)).toBe('Aucune synchronisation pour l’instant.');
  });

  it('date et heure seules quand le détail est inconnu', () => {
    expect(texteDerniereSynchro(HEURE, null)).toBe(`Dernière synchro${NB}: 09/11/2026 à 16${NB}h${NB}42`);
  });

  it('cartes ajoutées, étiquettes lues, prix relevés (accords au pluriel)', () => {
    const s = statut({ etat: 'termine', ajoutees: 3, etiquettes: 12, prix: 40 });
    expect(texteDerniereSynchro(HEURE, s)).toBe(
      `Dernière synchro${NB}: 09/11/2026 à 16${NB}h${NB}42 · 3 cartes ajoutées · 12 étiquettes lues · 40 prix relevés`,
    );
    const un = statut({ etat: 'termine', ajoutees: 1, etiquettes: 1, prix: 1 });
    expect(texteDerniereSynchro(HEURE, un)).toContain('1 carte ajoutée · 1 étiquette lue · 1 prix relevé');
    const zero = statut({ etat: 'termine' });
    expect(texteDerniereSynchro(HEURE, zero)).toContain('0 carte ajoutée · 0 étiquette lue · 0 prix relevé');
  });
});

const ecart = (surcharge: Partial<EcartCarte> = {}): EcartCarte => ({
  idCarte: 'C|Carte fictive',
  titre: 'Carte fictive',
  manquantes: ['Statut · Garder'],
  enTrop: ['Ancienne'],
  ...surcharge,
});

const rendre = (props: Partial<React.ComponentProps<typeof VueSynchroAuto>> = {}): string =>
  renderToStaticMarkup(
    React.createElement(VueSynchroAuto, {
      actif: false,
      statut: null,
      bail: null,
      derniere: null,
      maintenant: MAINTENANT,
      ecarts: [],
      onBascule: () => undefined,
      onArreter: () => undefined,
      onRelancer: () => undefined,
      ...props,
    }),
  );

describe('T-206 D-01 : interrupteur', () => {
  it('role="switch", libellé, désactivé par défaut, activable (bouton natif, Espace)', () => {
    const html = rendre();
    expect(html).toMatch(/<button[^>]*role="switch"/);
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toContain('Synchronisation automatique');
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).not.toContain('tabindex="-1"');
  });

  it('aria-checked="true" quand activée', () => {
    expect(rendre({ actif: true })).toMatch(/aria-checked="true"/);
  });

  it('la ligne d’état est un texte annoncé poliment (aria-live, sans role="status" déjà pris par le message de page)', () => {
    const html = rendre({ actif: true });
    expect(html).toMatch(/aria-live="polite"[^>]*>[^<]*En attente d’un onglet WikiMasters/);
  });

  it('rien ne prévient que l’option est active pour un lecteur d’écran seulement par la couleur', () => {
    expect(rendre({ actif: true })).toContain('Activée');
    expect(rendre({ actif: false })).toContain('Désactivée');
  });
});

describe('T-206 D-01 : bouton « Arrêter »', () => {
  it('visible seulement pendant une synchro', () => {
    const enCours = rendre({ actif: true, statut: statut(), bail: MAINTENANT + 60_000 });
    expect(enCours).toContain('Arrêter');
    expect(rendre({ actif: true })).not.toContain('Arrêter');
    expect(rendre({ actif: true, statut: statut({ etat: 'termine' }) })).not.toContain('Arrêter');
    expect(rendre({ actif: true, statut: statut(), bail: MAINTENANT - 1 })).not.toContain('Arrêter');
  });

  it('la progression est un texte, pas seulement une animation', () => {
    const html = rendre({ actif: true, statut: statut(), bail: MAINTENANT + 60_000 });
    expect(html).toContain(`En cours${NB}: page 12 sur 134`);
    expect(html).toMatch(/motion-safe:/);
  });
});

describe('T-206 D-02 : écarts avec le site', () => {
  it('« Aucun écart. » quand la liste est vide', () => {
    const html = rendre({ ecarts: [] });
    expect(html).toContain('Écarts avec le site');
    expect(html).toContain('Aucun écart.');
  });

  it('liste la carte, l’étiquette attendue et l’étiquette présente, en lecture seule', () => {
    const html = rendre({ ecarts: [ecart()] });
    expect(html).toContain('Carte fictive');
    expect(html).toContain('Statut · Garder');
    expect(html).toContain('Ancienne');
    expect(html).not.toContain('Aucun écart.');
    // Aucun bouton ni champ qui écrive : seul l’interrupteur (et jamais « Arrêter » ici) existe.
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('<input');
  });

  it('affiche un nom d’étiquette du site comme texte, sans HTML ni style', () => {
    const html = rendre({ ecarts: [ecart({ enTrop: ['<img src=x onerror=alert(1)>'], manquantes: [] })] });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('style=');
  });

  it('limite l’affichage et propose d’afficher la suite', () => {
    const beaucoup = Array.from({ length: 120 }, (_, i) => ecart({ idCarte: `C|${i}`, titre: `Carte ${i}` }));
    const html = rendre({ ecarts: beaucoup });
    expect(html.match(/<li/g)?.length).toBe(50);
    expect(html).toContain('Afficher 50 de plus');
  });
});

describe('T-206 : garde-fous du fichier', () => {
  const source = readFileSync('src/app/SynchroAuto.tsx', 'utf8');
  it('pas d’innerHTML, pas de style en ligne, pas de couleur en dur, pas d’action sur le site', () => {
    expect(source).not.toMatch(/innerHTML|dangerouslySetInnerHTML/);
    expect(source).not.toMatch(/style=\{/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/);
    expect(source).not.toMatch(/\.(click|focus|submit|requestSubmit|dispatchEvent)\(/);
    expect(source).not.toMatch(/fetch\(|XMLHttpRequest/);
  });
});

describe('bouton « Relancer la synchro »', () => {
  const arret = (surcharge: Partial<StatutSynchro> = {}) => statut({ etat: 'arret', ...surcharge });

  it('après un 401 ou un 429, pas de bouton : la pause de 30 min est gardée', () => {
    for (const code of [401, 429]) {
      const html = rendre({ actif: true, statut: arret({ raison: 'code-http', codeHttp: code }) });
      expect(html).not.toContain('Relancer la synchro');
      expect(html).toContain('Reprise automatique après');
    }
  });

  it('proposé après un arrêt manuel, un refus 403 ou des échecs', () => {
    for (const s of [arret({ raison: 'manuel' }), arret({ raison: 'code-http', codeHttp: 403 }), arret({ raison: 'echecs' })]) {
      const html = rendre({ actif: true, statut: s });
      expect(html).toContain('Relancer la synchro');
      expect(html).toMatch(/<button[^>]*type="button"[^>]*>Relancer la synchro/);
    }
  });

  it('absent quand la synchro tourne, est terminée, désactivée ou sans statut', () => {
    const bail = MAINTENANT + 60_000;
    expect(rendre({ actif: true, statut: statut({ etat: 'en-cours' }), bail })).not.toContain('Relancer');
    expect(rendre({ actif: true, statut: statut({ etat: 'termine' }) })).not.toContain('Relancer');
    expect(rendre({ actif: false, statut: arret({ raison: 'manuel' }) })).not.toContain('Relancer');
    expect(rendre({ actif: true, statut: null })).not.toContain('Relancer');
  });

  it('pas proposé quand un statut « en cours » est resté sans bail : seul un arrêt compte', () => {
    expect(relancePossible({ actif: true, statut: statut({ etat: 'en-cours' }), bail: null, maintenant: MAINTENANT })).toBe(false);
  });

  it('après un refus, le message dit que la pause de 30 min est ignorée et que le site peut refuser de nouveau', () => {
    const texte = texteRelance(arret({ raison: 'code-http', codeHttp: 403 }));
    expect(texte).toContain(`pause de 30${NB}min`);
    expect(texte).toContain('(403)');
    expect(texte).toContain('refuser de nouveau');
    expect(rendre({ actif: true, statut: arret({ raison: 'code-http', codeHttp: 403 }) })).toContain('refuser de nouveau');
  });

  it('après un arrêt manuel, pas d’avertissement de pause', () => {
    expect(texteRelance(arret({ raison: 'manuel' }))).not.toContain('pause');
    expect(texteRelance(null)).toBe('');
  });
});
