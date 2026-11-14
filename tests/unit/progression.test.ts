/**
 * T-302 (AC2 à AC5) : modèle de progression. Fonctions pures, horloge injectée (`maintenant`).
 * Contrat attendu (src/lib/progression.ts), nommage fixé ici :
 *
 * type Barre = { valeur: number | null; max: number | null; pourcent: number | null; indeterminee: boolean; texte: string }
 *   - pourcent = entier, arrondi à l’inférieur ; `texte` = « N / M · P % » ou, si M inconnu, « N lus » ;
 *   - le paramètre optionnel `precedent: Barre | null` garantit un pourcent monotone (jamais inférieur à celui de `precedent`).
 *
 * progressionLot(lot: LotExecution, precedent?: Barre | null): Barre            (N = traitees + sautees, M = total)
 * progressionExecution(etat: EtatExecutionV2, precedent?: Barre | null): Barre  (N = traitees, M = total)
 * progressionSynchro(statut: StatutSynchroV2, precedent?: Barre | null): {
 *     etapeIndex: number | null; nbEtapes: 4; indeterminee: boolean; pourcent: number | null; texte: string;
 *     etapes: Array<{ etape: EtapeSynchro; etat: 'faite' | 'en-cours' | 'attente'; barre: Barre }> }
 *   - poids égaux des 4 étapes stats, pages, prix, ventes ; fraction de la courante : stats 0, pages (page-1)/pages,
 *     prix prixFaits/prixPrevus, ventes 0 ; pourcent global = floor(100 × (index-1 + fraction) / 4) ;
 *     texte « Étape i / 4 · P % » ; statut `termine` : 100 % ; etape null (v1 migrée) : indeterminee, aucune erreur.
 *
 * annoncer(precedent: Annonce | null, courant: { cle: string; pourcent: number }, maintenant: number)
 *     : { annoncer: boolean; suivant: Annonce }       avec Annonce = { le: number; cle: string; palier: number }
 *   - jamais deux annonces à moins de 2 000 ms ; sinon annonce si `cle` change ou si floor(pourcent/10) dépasse `palier` ;
 *     si rien n’est annoncé, `suivant` === `precedent`.
 *
 * secondesExecution(restantes: number): number         restantes × 0,25 (pas de division par la concurrence)
 * secondesSynchro(statut: StatutSynchroV2): number     (pagesRestantes + prixRestants + 1) × 0,25
 *     pagesRestantes = pages - page + 1 pour etape stats|pages (0 si page ou pages inconnus, 0 après), prixRestants = max(0, prixPrevus - prixFaits) (0 si inconnu)
 * dureeRestante(secondes: number): string               « moins d’une minute » sous 60 s, sinon « environ N min » (N = plafond)
 *
 * listesTaches({ statut, execution, journal }): {
 *     aucuneActivite: boolean; enCours: Tache[]; aVenir: Tache[]; terminees: EntreeJournal[] }
 *   Tache = { genre: 'etape', etape } | { genre: 'lot', famille, nombre }
 *   - statut: StatutSynchroV2 | null, execution: EtatExecutionV2 | null, journal: EntreeJournal[] ;
 *   - actif = etat 'en-cours' ; enCours : l’étape courante et/ou le premier lot non épuisé ;
 *     aVenir : une ligne par étape restante, une par lot restant (nombre = total - traitees - sautees) ;
 *   - terminees : 20 dernières entrées du journal, la plus récente (horodatage) en haut.
 */
import { describe, expect, it } from 'vitest';
import {
  annoncer, dureeRestante, listesTaches, progressionExecution, progressionLot, progressionSynchro,
  secondesExecution, secondesSynchro,
} from '../../src/lib/progression';
import type { EntreeJournal, EtatExecutionV2, LotExecution } from '../../src/lib/actions';
import type { StatutSynchroV2 } from '../../src/lib/statutSynchro';

const T0 = 1700000000000;
const statut = (s: Partial<StatutSynchroV2> = {}): StatutSynchroV2 => ({
  version: 2, etat: 'en-cours', page: null, pages: null, raison: null, codeHttp: null, le: T0,
  ajoutees: 0, etiquettes: 0, prix: 0, etape: 'stats', prixFaits: null, prixPrevus: null, debut: T0, ...s,
});
const lot = (l: Partial<LotExecution> = {}): LotExecution => ({ famille: 'etiquettes', total: 10, traitees: 0, sautees: 0, ...l });
const exec = (e: Partial<EtatExecutionV2> = {}): EtatExecutionV2 => ({
  version: 2, idLot: 'L1', etat: 'en-cours', traitees: 0, total: 0, lots: [], pauseJusqua: null, erreur: null, ...e,
});
const entree = (n: number): EntreeJournal => ({
  id: `e${n}`, horodatage: new Date(T0 + n * 1000).toISOString(), idCarte: `Rare|Carte ${n}`, titre: `Carte ${n}`,
  type: 'pose-etiquette', parametre: null, resultat: 'reussie', codeHttp: null, idLot: 'L0',
});

describe('T-302 progression de la synchro (SC-002)', () => {
  it('SC-002 : étape pages, fraction (page-1)/pages sur 4 étapes de poids égal', () => {
    const p = progressionSynchro(statut({ etape: 'pages', page: 3, pages: 6 }));
    expect(p.etapeIndex).toBe(2);
    expect(p.nbEtapes).toBe(4);
    expect(p.pourcent).toBe(33);
    expect(p.texte).toBe('Étape 2 / 4 · 33 %');
    expect(p.indeterminee).toBe(false);
  });

  it('SC-002 : étape prix, N / M · P % sur la barre d’étape', () => {
    const p = progressionSynchro(statut({ etape: 'prix', prixFaits: 6, prixPrevus: 8 }));
    expect(p.texte).toBe('Étape 3 / 4 · 68 %');
    const prix = p.etapes.find((e) => e.etape === 'prix')!;
    expect(prix.etat).toBe('en-cours');
    expect(prix.barre.texte).toBe('6 / 8 · 75 %');
    expect(p.etapes.map((e) => e.etat)).toEqual(['faite', 'faite', 'en-cours', 'attente']);
  });

  it('retouche T-302 : la barre d’étape reste monotone avec `precedent` quand `pages` augmente', () => {
    const avant = progressionSynchro(statut({ etape: 'pages', page: 5, pages: 6 }));
    const pagesAvant = avant.etapes.find((e) => e.etape === 'pages')!.barre;
    expect(pagesAvant.pourcent).toBe(66);
    const apres = progressionSynchro(statut({ etape: 'pages', page: 5, pages: 12 }), avant);
    const pagesApres = apres.etapes.find((e) => e.etape === 'pages')!.barre;
    expect(pagesApres.pourcent).toBe(66);
    expect(apres.pourcent).toBeGreaterThanOrEqual(avant.pourcent!);
  });

  it('retouche T-302 : la barre d’étape reste monotone quand `prixPrevus` augmente', () => {
    const avant = progressionSynchro(statut({ etape: 'prix', prixFaits: 6, prixPrevus: 8 }));
    const apres = progressionSynchro(statut({ etape: 'prix', prixFaits: 6, prixPrevus: 20 }), avant);
    expect(apres.etapes.find((e) => e.etape === 'prix')!.barre.pourcent).toBe(75);
  });

  it('SC-002 : prixPrevus null, barre d’étape indéterminée « N lus » sans erreur', () => {
    const p = progressionSynchro(statut({ etape: 'prix', prixFaits: 0, prixPrevus: null }));
    const prix = p.etapes.find((e) => e.etape === 'prix')!;
    expect(prix.barre.indeterminee).toBe(true);
    expect(prix.barre.texte).toMatch(/ lus$/);
  });

  it('SC-002 : arrêt anticipé des pages, passer à prix fait de pages une étape faite', () => {
    const p = progressionSynchro(statut({ etape: 'prix', page: 2, pages: 9, prixFaits: 0, prixPrevus: 4 }));
    expect(p.etapes[1]!.etat).toBe('faite');
    expect(p.pourcent).toBe(50);
  });

  it('SC-002 : v1 migrée (etape null), barre indéterminée et pas d’exception', () => {
    const p = progressionSynchro(statut({ etape: null }));
    expect(p.indeterminee).toBe(true);
    expect(p.etapeIndex).toBeNull();
  });

  it('SC-002 : synchro terminée, 100 %', () => {
    expect(progressionSynchro(statut({ etat: 'termine', etape: 'ventes' })).pourcent).toBe(100);
  });

  it('SC-002 : pourcent monotone, jamais en dessous du précédent', () => {
    const avant = progressionSynchro(statut({ etape: 'prix', prixFaits: 6, prixPrevus: 8 }));
    const apres = progressionSynchro(statut({ etape: 'prix', prixFaits: 6, prixPrevus: 40 }), {
      valeur: null, max: null, pourcent: avant.pourcent, indeterminee: false, texte: avant.texte,
    });
    expect(apres.pourcent).toBeGreaterThanOrEqual(avant.pourcent as number);
  });
});

describe('T-302 progression de lot et d’exécution (SC-002)', () => {
  it('SC-002 : lot « N / M · P % », les sautées comptent comme avancées', () => {
    expect(progressionLot(lot({ total: 10, traitees: 3, sautees: 1 })).texte).toBe('4 / 10 actions · 40 %');
  });

  it('SC-002 : lot terminé, 100 %', () => {
    expect(progressionLot(lot({ total: 5, traitees: 5 })).pourcent).toBe(100);
  });

  it('SC-002 : monotone par lot', () => {
    const precedent = progressionLot(lot({ total: 10, traitees: 6 }));
    const encore = progressionLot(lot({ total: 10, traitees: 4 }), precedent);
    expect(encore.pourcent).toBe(60);
  });

  it('SC-002 : exécution globale « N / M · P % »', () => {
    const b = progressionExecution(exec({ total: 20, traitees: 5, lots: [lot({ total: 20, traitees: 5 })] }));
    expect(b.texte).toBe('5 / 20 actions · 25 %');
    expect(b.indeterminee).toBe(false);
  });
});

describe('T-302 annonces aria-live (SC-002, D-11)', () => {
  it('SC-002 : première annonce toujours émise', () => {
    const r = annoncer(null, { cle: 'etape:stats', pourcent: 0 }, T0);
    expect(r.annoncer).toBe(true);
    expect(r.suivant.cle).toBe('etape:stats');
  });

  it('SC-002 : pas deux annonces en moins de 2 s, même sur changement d’étape', () => {
    const p = annoncer(null, { cle: 'etape:stats', pourcent: 0 }, T0).suivant;
    const r = annoncer(p, { cle: 'etape:pages', pourcent: 25 }, T0 + 1999);
    expect(r.annoncer).toBe(false);
    expect(r.suivant).toBe(p);
    expect(annoncer(p, { cle: 'etape:pages', pourcent: 25 }, T0 + 2000).annoncer).toBe(true);
  });

  it('SC-002 : annonce sur changement d’étape ou de lot, et sur palier de 10 %', () => {
    const p = annoncer(null, { cle: 'lot:0', pourcent: 12 }, T0).suivant;
    expect(annoncer(p, { cle: 'lot:0', pourcent: 15 }, T0 + 5000).annoncer).toBe(false);
    expect(annoncer(p, { cle: 'lot:0', pourcent: 20 }, T0 + 5000).annoncer).toBe(true);
    expect(annoncer(p, { cle: 'lot:1', pourcent: 12 }, T0 + 5000).annoncer).toBe(true);
  });
});

describe('T-302 durée restante H4 (SC-002)', () => {
  it('SC-002 : exécution, actions × 0,25 s sans division par la concurrence', () => {
    expect(secondesExecution(100)).toBe(25);
    expect(secondesExecution(0)).toBe(0);
  });

  it('SC-002 : synchro, (pages restantes + prix restants + 1) × 0,25 s', () => {
    expect(secondesSynchro(statut({ etape: 'pages', page: 3, pages: 6, prixPrevus: 400, prixFaits: 0 }))).toBe(101.25);
    expect(secondesSynchro(statut({ etape: 'prix', page: 6, pages: 6, prixPrevus: 400, prixFaits: 100 }))).toBe(75.25);
  });

  it('SC-002 : prixPrevus null, aucun prix restant compté', () => {
    expect(secondesSynchro(statut({ etape: 'pages', page: 1, pages: 3, prixPrevus: null }))).toBe((3 + 1) * 0.25);
  });

  it('SC-002 : libellés « moins d’une minute » et « environ N min »', () => {
    expect(dureeRestante(0)).toBe('moins d’une minute');
    expect(dureeRestante(59.75)).toBe('moins d’une minute');
    expect(dureeRestante(60)).toBe('environ 1 min');
    expect(dureeRestante(101.25)).toBe('environ 2 min');
    expect(dureeRestante(1500)).toBe('environ 25 min');
  });
});

describe('T-302 listes de tâches (SC-003)', () => {
  it('SC-003 : synchro en cours, étape courante en cours et une ligne par étape restante', () => {
    const l = listesTaches({ statut: statut({ etape: 'pages', page: 1, pages: 4 }), execution: null, journal: [] });
    expect(l.aucuneActivite).toBe(false);
    expect(l.enCours).toEqual([{ genre: 'etape', etape: 'pages' }]);
    expect(l.aVenir).toEqual([{ genre: 'etape', etape: 'prix' }, { genre: 'etape', etape: 'ventes' }]);
  });

  it('SC-003 : exécution, lot courant en cours et un à venir par lot restant avec famille et nombre', () => {
    const execution = exec({
      total: 30, traitees: 10,
      lots: [lot({ famille: 'etiquettes', total: 10, traitees: 10 }), lot({ famille: 'encheres', total: 8, traitees: 3, sautees: 1 }),
        lot({ famille: 'defausses', total: 12 })],
    });
    const l = listesTaches({ statut: null, execution, journal: [] });
    expect(l.enCours).toEqual([{ genre: 'lot', famille: 'encheres', nombre: 4 }]);
    expect(l.aVenir).toEqual([{ genre: 'lot', famille: 'defausses', nombre: 12 }]);
  });

  it('SC-003 : Terminées limitées à 20, la plus récente en haut', () => {
    const journal = Array.from({ length: 25 }, (_, i) => entree(i + 1)).reverse();
    const l = listesTaches({ statut: null, execution: null, journal });
    expect(l.terminees).toHaveLength(20);
    expect(l.terminees[0]!.id).toBe('e25');
    expect(l.terminees[19]!.id).toBe('e6');
  });

  it('SC-003 : sans activité, « Aucune activité en cours » et les seules Terminées', () => {
    const l = listesTaches({
      statut: statut({ etat: 'termine' }), execution: exec({ etat: 'terminee', total: 5, traitees: 5, lots: [lot({ total: 5, traitees: 5 })] }),
      journal: [entree(1)],
    });
    expect(l.aucuneActivite).toBe(true);
    expect(l.enCours).toEqual([]);
    expect(l.aVenir).toEqual([]);
    expect(l.terminees).toHaveLength(1);
  });
});
