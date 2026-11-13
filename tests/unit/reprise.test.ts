/**
 * T-313 (AC3, AC7) : règles de reprise, pause de 30 min et états des choix du panneau d’erreur
 * (`src/lib/reprise.ts`, pur : aucun `chrome.*`, horloge murale `Date.now` toujours passée en argument).
 *
 * Nommage fixé par ces tests (le dev les implémente tels quels) :
 *   PAUSE_LOTS_MS                                       30 min en ms
 *   calculerPauseJusqua({ raison, codeHttp }, maintenant) -> number | null   (heure murale de fin, ou null)
 *   pauseActive(pauseJusqua, maintenant)                -> boolean           (vrai tant que maintenant < pauseJusqua)
 *   heureReprise(pauseJusqua)                           -> 'HH:MM' (heure locale, sur 2 chiffres)
 *   raisonPause(pauseJusqua, maintenant)                -> 'Reprise possible à HH:MM' | null
 *   RAISON_RESULTAT_INCONNU                             texte fixe (décision 2 de tasks.md)
 *   resultatInconnu(journal, { type, parametre, idCarte }, idLot) -> boolean (dernière entrée de l’action dans l’exécution)
 *   choixPanneau({ pauseJusqua, maintenant, repriseImpossible, resultatInconnu }) -> ChoixPanneau (table D-33)
 *     ChoixPanneau = { reessayer, sauterAction, sauterLot, ignorer, arreterTout, fermer, preparerNouveauLot }
 *     chaque entrée : { visible: boolean; actif: boolean; raison: string | null }
 */
import { describe, expect, it } from 'vitest';
import type { EntreeJournal } from '../../src/lib/actions';
import type { RaisonArret } from '../../src/lib/file';
import {
  PAUSE_LOTS_MS,
  RAISON_RESULTAT_INCONNU,
  calculerPauseJusqua,
  choixPanneau,
  heureReprise,
  pauseActive,
  raisonPause,
  resultatInconnu,
} from '../../src/lib/reprise';

const MAINTENANT = new Date(2026, 10, 13, 14, 5, 0).getTime();

describe('AC3 : pauseJusqua = maintenant + 30 min (SC-016)', () => {
  it('SC-016 : la pause dure 30 minutes', () => {
    expect(PAUSE_LOTS_MS).toBe(30 * 60_000);
  });

  it.each([
    ['401', 'code-http', 401],
    ['429', 'code-http', 429],
    ['403 hors exemplaire (création ou suppression d’étiquette)', 'code-http', 403],
    ['3 échecs', 'echecs', 500],
    ['3 échecs sans code', 'echecs', null],
  ] as Array<[string, RaisonArret, number | null]>)('SC-016 : %s -> pause de 30 min', (_nom, raison, codeHttp) => {
    expect(calculerPauseJusqua({ raison, codeHttp }, MAINTENANT)).toBe(MAINTENANT + PAUSE_LOTS_MS);
  });

  it('décision 3 : le seuil de refus par carte atteint (arrêt code-http 403) pause aussi 30 min', () => {
    // Le seuil (3 d’affilée ou 5 par lot) arrête la file avec la raison `code-http` et le code 403 :
    // traité comme un refus hors exemplaire.
    expect(calculerPauseJusqua({ raison: 'code-http', codeHttp: 403 }, MAINTENANT)).toBe(MAINTENANT + PAUSE_LOTS_MS);
  });

  it('décision 3 : le seuil de refus par carte déclenche la pause même si le dernier refus est un 404', () => {
    expect(calculerPauseJusqua({ raison: 'code-http', codeHttp: 404, seuilRefus: true }, MAINTENANT)).toBe(MAINTENANT + PAUSE_LOTS_MS)
    expect(calculerPauseJusqua({ raison: 'code-http', codeHttp: 404 }, MAINTENANT)).toBeNull()
  })

  it.each([
    ['409 (conflit sur enchère ou défausse)', 'code-http', 409],
    ['résultat inconnu ou arrêt de classe `arret`', 'resultat', null],
    ['erreur de transport', 'transport', null],
    ['écriture locale refusée', 'ecriture', null],
    ['revérification en échec', 'verification', null],
    ['arrêt manuel', 'manuel', null],
  ] as Array<[string, RaisonArret, number | null]>)('SC-016 : %s -> aucune pause (Réessayer immédiat)', (_nom, raison, codeHttp) => {
    expect(calculerPauseJusqua({ raison, codeHttp }, MAINTENANT)).toBeNull();
  });

  it('la date est murale : elle dépend de l’argument `maintenant`, jamais d’une horloge interne', () => {
    expect(calculerPauseJusqua({ raison: 'code-http', codeHttp: 429 }, 5_000)).toBe(5_000 + PAUSE_LOTS_MS);
  });
});

describe('pause active et raison de désactivation', () => {
  const fin = MAINTENANT + PAUSE_LOTS_MS;

  it('SC-016 : active jusqu’à l’heure exacte exclue', () => {
    expect(pauseActive(fin, MAINTENANT)).toBe(true);
    expect(pauseActive(fin, fin - 1)).toBe(true);
    expect(pauseActive(fin, fin)).toBe(false);
    expect(pauseActive(fin, fin + 1)).toBe(false);
  });

  it('SC-016 : pas de pause quand pauseJusqua est null', () => {
    expect(pauseActive(null, MAINTENANT)).toBe(false);
  });

  it('SC-016 : heureReprise rend HH:MM en heure locale, sur 2 chiffres', () => {
    expect(heureReprise(new Date(2026, 10, 13, 9, 5).getTime())).toBe('09:05');
    expect(heureReprise(new Date(2026, 10, 13, 23, 59).getTime())).toBe('23:59');
    expect(heureReprise(fin)).toBe('14:35');
  });

  it('SC-016 : « Reprise possible à HH:MM » pendant la pause, null sinon', () => {
    expect(raisonPause(fin, MAINTENANT)).toBe('Reprise possible à 14:35');
    expect(raisonPause(fin, fin)).toBeNull();
    expect(raisonPause(null, MAINTENANT)).toBeNull();
  });
});

describe('décision 2 : Réessayer après résultat inconnu', () => {
  const entree = (surcharge: Partial<EntreeJournal>): EntreeJournal => ({
    id: 'e1',
    horodatage: '2026-11-13T14:00:00.000Z',
    idCarte: 'Rare|Carte fictive',
    titre: 'Carte fictive',
    type: 'defausse',
    parametre: null,
    resultat: 'inconnu',
    codeHttp: null,
    idLot: 'lot-1',
    rang: 2,
    total: 4,
    lot: 'defausses',
    cause: null,
    ...surcharge,
  });
  const action = { type: 'defausse' as const, parametre: null, idCarte: 'Rare|Carte fictive' };

  it('SC-005 : vrai si l’entrée de l’action a le résultat `inconnu`', () => {
    expect(resultatInconnu([entree({})], action, 'lot-1')).toBe(true);
  });

  it('faux pour tout autre résultat', () => {
    for (const resultat of ['echouee', 'reussie', 'passee', 'interrompue'] as const) {
      expect(resultatInconnu([entree({ resultat })], action, 'lot-1')).toBe(false);
    }
  });

  it('seule la dernière entrée de l’action compte', () => {
    const j = [entree({ id: 'e1', resultat: 'inconnu' }), entree({ id: 'e2', resultat: 'echouee', codeHttp: 500 })];
    expect(resultatInconnu(j, action, 'lot-1')).toBe(false);
  });

  it('ne confond ni l’exécution, ni la carte, ni le type, ni le paramètre', () => {
    expect(resultatInconnu([entree({ idLot: 'lot-0' })], action, 'lot-1')).toBe(false);
    expect(resultatInconnu([entree({ idCarte: 'Rare|Autre' })], action, 'lot-1')).toBe(false);
    expect(resultatInconnu([entree({ type: 'enchere', parametre: '10' })], action, 'lot-1')).toBe(false);
    expect(resultatInconnu([entree({ parametre: 'x' })], action, 'lot-1')).toBe(false);
  });

  it('journal vide : faux', () => {
    expect(resultatInconnu([], action, 'lot-1')).toBe(false);
  });

  it('le texte de désactivation est écrit', () => {
    expect(RAISON_RESULTAT_INCONNU).toBe('Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action');
  });
});

describe('D-33 : états des 5 choix du panneau d’erreur', () => {
  const fin = MAINTENANT + PAUSE_LOTS_MS;
  const base = { pauseJusqua: null, maintenant: MAINTENANT, repriseImpossible: false, resultatInconnu: false };
  const actif = { visible: true, actif: true, raison: null };

  it('SC-016 : erreur sans pause -> les cinq choix sont actifs', () => {
    const c = choixPanneau(base);
    expect(c.reessayer).toEqual(actif);
    expect(c.sauterAction).toEqual(actif);
    expect(c.sauterLot).toEqual(actif);
    expect(c.ignorer).toEqual(actif);
    expect(c.arreterTout).toEqual(actif);
    expect(c.fermer.visible).toBe(false);
    expect(c.preparerNouveauLot.visible).toBe(false);
  });

  it('SC-016 : pause de 30 min -> Réessayer désactivé avec « Reprise possible à HH:MM », le reste actif', () => {
    const c = choixPanneau({ ...base, pauseJusqua: fin });
    expect(c.reessayer).toEqual({ visible: true, actif: false, raison: 'Reprise possible à 14:35' });
    expect(c.sauterAction).toEqual(actif);
    expect(c.sauterLot).toEqual(actif);
    expect(c.ignorer).toEqual(actif);
    expect(c.arreterTout).toEqual(actif);
  });

  it('SC-016 : une pause échue ne désactive plus rien', () => {
    expect(choixPanneau({ ...base, pauseJusqua: fin, maintenant: fin }).reessayer).toEqual(actif);
  });

  it('décision 2 : résultat inconnu hors pause -> Réessayer désactivé avec la raison écrite, Sauter reste actif', () => {
    const c = choixPanneau({ ...base, resultatInconnu: true });
    expect(c.reessayer).toEqual({ visible: true, actif: false, raison: RAISON_RESULTAT_INCONNU });
    expect(c.sauterAction.actif).toBe(true);
    expect(c.sauterLot.actif).toBe(true);
    expect(c.ignorer.actif).toBe(true);
  });

  it('SC-017 : reprise impossible après rechargement -> plus de Réessayer, Sauter ni Ignorer', () => {
    const c = choixPanneau({ ...base, repriseImpossible: true });
    expect(c.reessayer.visible).toBe(false);
    expect(c.sauterAction.visible).toBe(false);
    expect(c.sauterLot.visible).toBe(false);
    expect(c.ignorer.visible).toBe(false);
  });

  it('SC-017 : « Arrêter tout » est remplacé par « Fermer », et « Préparer un nouveau lot » apparaît', () => {
    const c = choixPanneau({ ...base, repriseImpossible: true });
    expect(c.arreterTout.visible).toBe(false);
    expect(c.fermer).toEqual(actif);
    expect(c.preparerNouveauLot).toEqual(actif);
  });

  it('SC-017 : la reprise impossible l’emporte sur la pause (rien à reprendre)', () => {
    const c = choixPanneau({ ...base, repriseImpossible: true, pauseJusqua: fin });
    expect(c.reessayer.visible).toBe(false);
    expect(c.preparerNouveauLot.visible).toBe(true);
  });
});
