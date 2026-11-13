/**
 * T-313 (AC2, AC4 côté file, AC5) : état v2 publié par la file, contexte d’erreur, actions restantes et reprise
 * de la même exécution (`src/lib/file.ts`, transport simulé, horloge injectée).
 *
 * Nommage fixé par ces tests :
 *   EtatFile.lots       LotExecution[] : un lot par famille (T-302 `decouperEnLots`), dans l’ordre de première
 *                       apparition ; `traitees` = actions terminées (réussies, échouées sans arrêt, passées par la
 *                       revérification) ; `sautees` = actions écartées par l’appelant (suite) ; l’action en erreur
 *                       n’est pas traitée
 *   EtatFile.reussies   nombre d’actions réussies de l’exécution (suite comprise)
 *   EtatFile.restantes  Action[] dans l’ordre d’origine : action en erreur, ordres parallèles abandonnés (jamais
 *                       envoyés), actions non parties ; vide si l’exécution est terminée. Les ordres déjà envoyés
 *                       (même en échec) ne sont jamais restantes (jamais de relance d’une requête envoyée)
 *   EtatFile.erreur     ContexteErreur | null, renseigné pour un arrêt autre que `manuel` :
 *                       { action, famille, indexLot (1 à nbLots), nbLots, rang (1 dans le lot), totalLot,
 *                         codeHttp, cause (RaisonArret), reussies, autresEchecsEnVol }
 *   demarrer(actions, idLot, suite?)   suite = { traitees, total, lots, reussies } : `idLot` et compteurs conservés,
 *                       `total` vient de la suite, le rang d’une action = traitees + sautees de son lot + position
 *                       parmi les actions restantes de la même famille
 *   JournalFile.ouvrir(action, { rang, total, lot })
 */
/* eslint-disable prefer-const -- la file est créée après les rappels de transport qui l’utilisent */
import { describe, expect, it } from 'vitest';
import type { Action, ResultatAction } from '../../src/lib/actions';
import { creerFile, type DependancesFile, type EtatFile, type Horloge, type SuiteExecution } from '../../src/lib/file';

const OK: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' };
const echec = (codeHttp: number): ResultatAction => ({ classe: 'echec', codeHttp, cause: 'échec' });

const defausse = (n: number): Action => ({ type: 'defausse', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}` });
const enchere = (n: number): Action => ({ type: 'enchere', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}`, prix: 10 });
const pose = (n: number): Action => ({ type: 'pose-etiquette', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}`, nomEtiquette: 'Garder' });

function horloge(): Horloge & { t: number } {
  const h = {
    t: 1_000_000,
    now: () => h.t,
    attendreJusqua: (echeance: number) => {
      if (echeance > h.t) h.t = echeance;
      return Promise.resolve();
    },
  };
  return h;
}

async function vide(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

interface Contexte {
  rang: number;
  total: number;
  lot: string;
}

interface Banc {
  deps: DependancesFile;
  requetes: Action[];
  ouvertures: Array<{ action: Action; contexte: Contexte }>;
}

/** `reponse(action, n)` : résultat de la n-ième requête (à partir de 1). */
function banc(reponse: (a: Action, n: number) => ResultatAction | Promise<ResultatAction> = () => OK, surcharge: Partial<DependancesFile> = {}): Banc {
  const requetes: Action[] = [];
  const ouvertures: Banc['ouvertures'] = [];
  let compteur = 0;
  const deps: DependancesFile = {
    horloge: horloge(),
    transport: async (a) => {
      requetes.push(a);
      return reponse(a, requetes.length);
    },
    reverifier: () => 'ok',
    appliquer: () => undefined,
    journal: {
      ouvrir: (a, contexte) => {
        ouvertures.push({ action: a, contexte: contexte as Contexte });
        return `e${++compteur}`;
      },
      completer: () => undefined,
      passer: () => undefined,
    },
    ...surcharge,
  };
  return { deps, requetes, ouvertures };
}

const suiteDe = (e: EtatFile): SuiteExecution => ({ traitees: e.traitees, total: e.total, lots: e.lots, reussies: e.reussies });

function differee<T>(): { promesse: Promise<T>; resoudre: (v: T) => void } {
  let resoudre!: (v: T) => void;
  const promesse = new Promise<T>((r) => (resoudre = r));
  return { promesse, resoudre };
}

describe('AC2 : lots, contexte d’erreur et restantes', () => {
  it('SC-004 : exécution terminée -> lots complets, aucune erreur, aucune restante', async () => {
    const b = banc();
    const etat = await creerFile(b.deps).demarrer([defausse(1), defausse(2), enchere(3)], 'lot-1');
    expect(etat.etat).toBe('terminee');
    expect(etat.erreur).toBeNull();
    expect(etat.restantes).toEqual([]);
    expect(etat.reussies).toBe(3);
    expect(etat.lots).toEqual([
      { famille: 'defausses', total: 2, traitees: 2, sautees: 0 },
      { famille: 'encheres', total: 1, traitees: 1, sautees: 0 },
    ]);
  });

  it('SC-004 : un 409 sur la 3e défausse -> contexte complet, restantes dans l’ordre', async () => {
    const b = banc((_a, n) => (n === 3 ? echec(409) : OK));
    const etat = await creerFile(b.deps).demarrer([defausse(1), defausse(2), defausse(3), defausse(4), defausse(5)], 'lot-1');
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('code-http');
    expect(etat.traitees).toBe(2);
    expect(etat.erreur).toEqual({
      action: defausse(3),
      famille: 'defausses',
      indexLot: 1,
      nbLots: 1,
      rang: 3,
      totalLot: 5,
      codeHttp: 409,
      cause: 'code-http',
      reussies: 2,
      autresEchecsEnVol: 0,
    });
    expect(etat.restantes).toEqual([defausse(3), defausse(4), defausse(5)]);
    expect(etat.lots).toEqual([{ famille: 'defausses', total: 5, traitees: 2, sautees: 0 }]);
    expect(b.requetes).toHaveLength(3);
  });

  it('SC-004 : « Lot 2 / 2 » et rang dans le lot de la famille de l’action en erreur', async () => {
    const b = banc((a) => (a.type === 'enchere' && a.idCarte === 'Rare|Carte 7' ? echec(409) : OK));
    const etat = await creerFile(b.deps).demarrer([defausse(1), defausse(2), enchere(6), enchere(7), enchere(8)], 'lot-1');
    expect(etat.erreur).toMatchObject({ famille: 'encheres', indexLot: 2, nbLots: 2, rang: 2, totalLot: 3, codeHttp: 409 });
    expect(etat.restantes).toEqual([enchere(7), enchere(8)]);
  });

  it('SC-004 : le lot se découpe par appartenance à la famille, pas par position', async () => {
    const b = banc((_a, n) => (n === 3 ? echec(429) : OK));
    // pose 1, défausse, pose 2 : la 3e requête (pose 2) est la 2e du lot Étiquettes, qui est le lot 1.
    const etat = await creerFile(b.deps).demarrer([pose(1), defausse(2), pose(3)], 'lot-1');
    expect(etat.erreur).toMatchObject({ famille: 'etiquettes', indexLot: 1, nbLots: 2, rang: 2, totalLot: 2, codeHttp: 429 });
  });

  it('SC-004 : 3 échecs -> l’action en erreur est la troisième, les deux premières ne sont pas restantes', async () => {
    const b = banc((_a, n) => (n <= 3 ? echec(500) : OK));
    const etat = await creerFile(b.deps).demarrer([defausse(1), defausse(2), defausse(3), defausse(4)], 'lot-1');
    expect(etat.raison).toBe('echecs');
    expect(etat.erreur).toMatchObject({ action: defausse(3), cause: 'echecs', codeHttp: 500, rang: 3, autresEchecsEnVol: 0 });
    expect(etat.restantes).toEqual([defausse(3), defausse(4)]);
  });

  it('SC-004 : une erreur de transport -> cause `transport`, l’action est restante mais n’est jamais renvoyée seule', async () => {
    const b = banc((a) => {
      if (a.idCarte === 'Rare|Carte 2') throw new Error('coupure');
      return OK;
    });
    const etat = await creerFile(b.deps).demarrer([defausse(1), defausse(2), defausse(3)], 'lot-1');
    expect(etat.raison).toBe('transport');
    expect(etat.erreur).toMatchObject({ action: defausse(2), cause: 'transport', codeHttp: null });
    expect(etat.restantes).toEqual([defausse(2), defausse(3)]);
    expect(b.requetes).toHaveLength(2);
  });

  it('SC-014 : un arrêt manuel garde aussi les restantes (reprise possible), sans contexte d’erreur', async () => {
    let file!: ReturnType<typeof creerFile>;
    const b = banc((_a, n) => {
      if (n === 2) file.arreter();
      return OK;
    });
    file = creerFile(b.deps);
    const etat = await file.demarrer([defausse(1), defausse(2), defausse(3), defausse(4)], 'lot-1');
    expect(etat.raison).toBe('manuel');
    expect(etat.erreur).toBeNull();
    expect(etat.restantes).toEqual([defausse(3), defausse(4)]);
  });

  it('les actions ajoutées en fin de file sont comptées dans leur lot et restent restantes', async () => {
    let file!: ReturnType<typeof creerFile>;
    const b = banc((_a, n) => {
      if (n === 1) expect(file.ajouter([pose(9), defausse(8)])).toBe(true);
      return n === 2 ? echec(409) : OK;
    });
    file = creerFile(b.deps);
    const etat = await file.demarrer([defausse(1), defausse(2)], 'lot-1');
    expect(etat.total).toBe(4);
    expect(etat.lots).toEqual([
      { famille: 'defausses', total: 3, traitees: 1, sautees: 0 },
      { famille: 'etiquettes', total: 1, traitees: 0, sautees: 0 },
    ]);
    expect(etat.restantes).toEqual([defausse(2), pose(9), defausse(8)]);
  });
});

describe('AC2 : requêtes parallèles abandonnées ou en échec', () => {
  it('SC-004 : les ordres du lot parallèle jamais envoyés sont restantes, dans l’ordre', async () => {
    // Les ordres 2 et 3 attendent leur première revérification ; l’ordre 1 reçoit un 429 avant qu’elle ne se libère.
    const porte = differee<void>();
    let reverifs = 0;
    const b = banc(() => echec(429), {
      concurrence: 3,
      reverifier: async (a) => {
        if (a.type === 'pose-etiquette' && a.idExemplaire !== 'ex-1') {
          reverifs++;
          await porte.promesse;
        }
        return 'ok' as const;
      },
      journal: {
        ouvrir: () => 'e',
        completer: () => porte.resoudre(),
        passer: () => undefined,
      },
    });
    const etat = await creerFile(b.deps).demarrer([pose(1), pose(2), pose(3), pose(4)], 'lot-1');
    expect(reverifs).toBeGreaterThanOrEqual(2);
    expect(b.requetes).toEqual([pose(1)]);
    expect(etat.erreur).toMatchObject({ action: pose(1), codeHttp: 429, autresEchecsEnVol: 0 });
    expect(etat.restantes).toEqual([pose(1), pose(2), pose(3), pose(4)]);
    expect(etat.traitees).toBe(0);
  });

  it('SC-004 : les autres échecs parmi les requêtes déjà en vol sont comptés, sans être restantes', async () => {
    const reponses = [differee<ResultatAction>(), differee<ResultatAction>(), differee<ResultatAction>()];
    const b = banc((_a, n) => reponses[n - 1]!.promesse, { concurrence: 3 });
    const fin = creerFile(b.deps).demarrer([pose(1), pose(2), pose(3), pose(4)], 'lot-1');
    for (let i = 0; i < 50 && b.requetes.length < 3; i++) await vide();
    expect(b.requetes).toHaveLength(3);

    reponses[0]!.resoudre(echec(429));
    reponses[1]!.resoudre(echec(500));
    reponses[2]!.resoudre(echec(500));
    const etat = await fin;
    expect(etat.raison).toBe('code-http');
    expect(etat.erreur).toMatchObject({ action: pose(1), codeHttp: 429, autresEchecsEnVol: 2 });
    // Les deux ordres en échec ont été envoyés : ils ne repartent pas. Reste l’action en erreur et la non partie.
    expect(etat.restantes).toEqual([pose(1), pose(4)]);
  });
});

describe('AC2 : JournalFile.ouvrir(action, { rang, total, lot })', () => {
  it('SC-004 : chaque entrée reçoit le rang, la taille et la famille de son lot', async () => {
    const b = banc();
    await creerFile(b.deps).demarrer([defausse(1), defausse(2), enchere(3)], 'lot-1');
    expect(b.ouvertures.map((o) => o.contexte)).toEqual([
      { rang: 1, total: 2, lot: 'defausses' },
      { rang: 2, total: 2, lot: 'defausses' },
      { rang: 1, total: 1, lot: 'encheres' },
    ]);
  });
});

describe('AC2 et AC4 : reprise de la même exécution (`demarrer` avec une suite)', () => {
  it('SC-005 : reprendre les restantes garde l’identifiant, les compteurs et le rang', async () => {
    const b = banc((_a, n) => (n === 3 ? echec(409) : OK));
    const file = creerFile(b.deps);
    const premier = await file.demarrer([defausse(1), defausse(2), defausse(3), defausse(4), defausse(5)], 'lot-7');
    expect(premier.etat).toBe('arretee');

    b.ouvertures.length = 0;
    const second = await file.demarrer(premier.restantes, 'lot-7', suiteDe(premier));
    expect(second.idLot).toBe('lot-7');
    expect(second.etat).toBe('terminee');
    expect(second.erreur).toBeNull();
    expect(second.restantes).toEqual([]);
    expect(second.total).toBe(5);
    expect(second.traitees).toBe(5);
    expect(second.reussies).toBe(5);
    expect(second.lots).toEqual([{ famille: 'defausses', total: 5, traitees: 5, sautees: 0 }]);
    // La défausse en erreur repart avec son rang d’origine (3 / 5).
    expect(b.ouvertures.map((o) => o.contexte.rang)).toEqual([3, 4, 5]);
    expect(b.requetes.map((a) => a.idCarte)).toEqual([
      'Rare|Carte 1', 'Rare|Carte 2', 'Rare|Carte 3', 'Rare|Carte 3', 'Rare|Carte 4', 'Rare|Carte 5',
    ]);
  });

  it('SC-005 : sauter = reprendre sans l’action en erreur ; aucun appel transport pour la sautée', async () => {
    const b = banc((_a, n) => (n === 3 ? echec(409) : OK));
    const file = creerFile(b.deps);
    const premier = await file.demarrer([defausse(1), defausse(2), defausse(3), defausse(4), defausse(5)], 'lot-7');

    // L’appelant écarte l’action en erreur : une sautée de plus, comptée dans la progression.
    const suite: SuiteExecution = {
      traitees: premier.traitees + 1,
      total: premier.total,
      reussies: premier.reussies,
      lots: premier.lots.map((l) => ({ ...l, sautees: l.sautees + 1 })),
    };
    b.ouvertures.length = 0;
    const avant = b.requetes.length;
    const second = await file.demarrer(premier.restantes.slice(1), 'lot-7', suite);
    const envoyees = b.requetes.slice(avant);

    expect(envoyees).toEqual([defausse(4), defausse(5)]);
    expect(envoyees).not.toContainEqual(defausse(3));
    expect(second.etat).toBe('terminee');
    expect(second.traitees).toBe(5);
    expect(second.total).toBe(5);
    expect(second.lots).toEqual([{ famille: 'defausses', total: 5, traitees: 4, sautees: 1 }]);
    expect(b.ouvertures.map((o) => o.contexte.rang)).toEqual([4, 5]);
  });

  it('une reprise qui échoue de nouveau republie un contexte d’erreur et de nouvelles restantes', async () => {
    const b = banc((_a, n) => (n === 3 || n === 4 ? echec(409) : OK));
    const file = creerFile(b.deps);
    const premier = await file.demarrer([defausse(1), defausse(2), defausse(3)], 'lot-7');
    const second = await file.demarrer(premier.restantes, 'lot-7', suiteDe(premier));
    expect(second.etat).toBe('arretee');
    expect(second.erreur).toMatchObject({ action: defausse(3), rang: 3, totalLot: 3, reussies: 2 });
    expect(second.restantes).toEqual([defausse(3)]);
    expect(second.traitees).toBe(2);
  });

  it('sans suite, le comportement d’origine est inchangé (total = nombre d’actions)', async () => {
    const b = banc();
    const etat = await creerFile(b.deps).demarrer([defausse(1), defausse(2)], 'lot-1');
    expect(etat.total).toBe(2);
    expect(etat.traitees).toBe(2);
  });

  it('les restantes ne sont pas conservées d’une exécution terminée à la suivante', async () => {
    const b = banc((_a, n) => (n === 1 ? echec(409) : OK));
    const file = creerFile(b.deps);
    const premier = await file.demarrer([defausse(1), defausse(2)], 'lot-1');
    expect(premier.restantes).toEqual([defausse(1), defausse(2)]);
    const second = await file.demarrer([defausse(3)], 'lot-2');
    expect(second.restantes).toEqual([]);
    expect(second.erreur).toBeNull();
    expect(second.lots).toEqual([{ famille: 'defausses', total: 1, traitees: 1, sautees: 0 }]);
  });
});
