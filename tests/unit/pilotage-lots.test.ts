/**
 * T-313 (AC4 à AC7, SC-004 à SC-006, SC-014, SC-016, SC-017) : API de pilotage de `src/app/pilotageLots.ts`.
 *
 * Aucun appel au vrai site : `chrome.storage.local` est une mémoire locale, l’exécution (ports, verrou) est simulée,
 * le transport est un espion, l’horloge de la file est maîtrisée et `Date` est figée (`vi.setSystemTime`).
 * `revision.ts` (revérification, application locale) et `avecIdEtiquette` sont neutralisés : ce fichier ne teste que
 * le câblage du moteur.
 *
 * Nommage fixé par ces tests (exports de `pilotageLots.ts`, tous typés et documentés) :
 *   lancerLot(actions, idLot)      existant ; relit `pauseJusqua` (état d’exécution stocké) avant tout : rejette avec
 *                                  « Reprise possible à HH:MM » pendant la pause de 30 min ; résout à la fin de l’exécution
 *   lancerSuppressionEtiquettes    existant ; passe par `lancerLot`, donc bloquée aussi
 *   reessayer()                    renvoie les restantes (action en erreur d’abord) dans la même exécution ; rejette
 *                                  pendant la pause, après un résultat inconnu (RAISON_RESULTAT_INCONNU), sans restante,
 *                                  ou si une condition de lancement manque (bail tenu, verrou pris)
 *   sauterAction()                 entrée de journal « passée » (cause `sautee`, rang/total/lot), aucun transport, puis reprise ;
 *                                  pendant la pause : effet local seulement (reprise différée, résout sans rien envoyer)
 *   sauterLot()                    idem pour l’action en erreur et les N - 1 autres actions du lot, comptées « sautées »
 *                                  sans entrée de journal supplémentaire
 *   ignorer()                      écrit `ignorees` ({ type, idCarte, parametre, portee: 'synchro', date: Date.now() }) puis
 *                                  agit comme sauterAction (cause `ignoree`) ; écriture refusée ou clé illisible : rejette,
 *                                  rien d’ignoré, rien de sauté
 *   pause(), reprendre(), arreterTout()   synchrones ; arreterTout vide les restantes mais ne lève jamais la pause de 30 min
 *   enPause(): boolean ; restantes(): readonly Action[]   (mémoire seulement, vides après rechargement)
 * L’état publié (clé `execution`, v2) porte `lots`, `pauseJusqua` et `erreur` (voir etatExecution.ts) ;
 * `traitees` global compte aussi les actions sautées.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Action, ResultatAction } from '../../src/lib/actions';

const OK: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' };
const RAISON_RESULTAT_INCONNU = 'Résultat inconnu : vérifiez sur WikiMasters, puis sautez l’action';
const echec = (codeHttp: number): ResultatAction => ({ classe: 'echec', codeHttp, cause: 'échec' });

const banc = vi.hoisted(() => {
  const b = {
    stockage: new Map<string, unknown>(),
    refus: new Set<string>(),
    verrou: false,
    demarrages: 0,
    appels: [] as Action[],
    lectures: 0,
    ventes: undefined as { enCours: number; max: number } | undefined,
    lectureResultat: undefined as ResultatAction | undefined,
    lecture: (): ResultatAction => { banc.lectures++; if (banc.lectureResultat) return banc.lectureResultat; return { classe: 'reussie', codeHttp: 200, cause: 'action réussie', ...(banc.ventes ? { ventes: banc.ventes } : {}) }; },
    reponse: ((): unknown => null) as (a: Action, n: number) => unknown,
    t: 1_000_000,
    attentes: [] as Array<{ echeance: number; resoudre: () => void }>,
    avancer: (async () => undefined) as (ms: number) => Promise<void>,
    horloge: {
      now: (): number => b.t,
      attendreJusqua: (echeance: number): Promise<void> => {
        if (echeance <= b.t) return Promise.resolve();
        if (echeance - b.t <= 5_000) {
          b.t = echeance;
          return Promise.resolve();
        }
        return new Promise<void>((resoudre) => b.attentes.push({ echeance, resoudre }));
      },
    },
    execution: {} as Record<string, unknown>,
  };
  b.avancer = async (ms: number): Promise<void> => {
    b.t += ms;
    for (const a of b.attentes.splice(0)) {
      if (a.echeance <= b.t) a.resoudre();
      else b.attentes.push(a);
    }
    for (let i = 0; i < 30; i++) await Promise.resolve();
    await new Promise<void>((r) => setTimeout(r, 0));
    for (let i = 0; i < 30; i++) await Promise.resolve();
  };
  b.execution = {
    ecouter: () => () => undefined,
    signaler: async () => undefined,
    nbOngletsWikiMasters: () => 1,
    raisonsDesactivation: () => [],
    abonner: () => () => undefined,
    cloreInterrompues: async () => undefined,
    transport: async (ordre: Action) => {
      // La lecture des enchères en cours (avant un lot d'enchères) n'est pas une action du lot.
      if (ordre.type === 'lecture') return b.lecture();
      b.appels.push(ordre);
      return b.reponse(ordre, b.appels.length);
    },
    demarrer: async (corps: (signal: AbortSignal) => Promise<unknown>) => {
      if (b.verrou) throw new Error('Une exécution est déjà en cours dans un autre onglet.');
      b.verrou = true;
      b.demarrages++;
      try {
        return await corps(new AbortController().signal);
      } finally {
        b.verrou = false;
      }
    },
  };
  return b;
});

vi.mock('../../src/app/execution', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/app/execution')>()),
  horlogeReelle: banc.horloge,
  creerExecutionReelle: () => banc.execution,
}));
vi.mock('../../src/lib/revision', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/revision')>()),
  reverifierAction: () => 'ok',
  appliquerResultat: (collection: unknown, registre: unknown) => ({ collection, registre }),
}));
vi.mock('../../src/lib/registre', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/registre')>()),
  avecIdEtiquette: <T>(action: T) => action,
}));

const defausse = (n: number): Action => ({ type: 'defausse', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}` });
const enchere = (n: number): Action => ({ type: 'enchere', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}`, prix: 10 });
const creation = (carte: string, nom: string): Action => ({ type: 'creation-etiquette', idCarte: `Rare|Carte ${carte}`, nomEtiquette: nom });
const pose = (carte: string, ex: string, nom: string): Action => ({
  type: 'pose-etiquette',
  idCarte: `Rare|Carte ${carte}`,
  idExemplaire: ex,
  nomEtiquette: nom,
});
const quatreDefausses = (): Action[] => [1, 2, 3, 4].map(defausse);

const hhmm = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

async function vide(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

/** Charge des modules neufs (état en mémoire vierge, comme après un rechargement de la page ou dans un autre onglet). */
async function frais() {
  vi.resetModules();
  const pilotage = await import('../../src/app/pilotageLots');
  const stockage = await import('../../src/lib/stockage');
  return { ...pilotage, ...stockage };
}
type Api = Awaited<ReturnType<typeof frais>>;

/** Réponses du transport : la n-ième requête reçoit `sur[n]`, les autres réussissent. */
const reponses = (sur: Record<number, ResultatAction | Error>) => (_a: Action, n: number): unknown => {
  const r = sur[n];
  if (r instanceof Error) throw r;
  return r ?? OK;
};

beforeEach(() => {
  banc.stockage.clear();
  banc.refus.clear();
  banc.verrou = false;
  banc.demarrages = 0;
  banc.appels = [];
  banc.lectures = 0;
  banc.ventes = undefined;
  banc.lectureResultat = undefined;
  banc.attentes = [];
  banc.t = 1_000_000;
  banc.reponse = reponses({});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 13, 14, 5, 0));
  const lire = (cles: string | string[] | null): Record<string, unknown> => {
    const liste = cles === null ? [...banc.stockage.keys()] : Array.isArray(cles) ? cles : [cles];
    return Object.fromEntries(liste.filter((k) => banc.stockage.has(k)).map((k) => [k, structuredClone(banc.stockage.get(k))]));
  };
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (cles: string | string[] | null) => lire(cles),
        set: async (valeurs: Record<string, unknown>) => {
          for (const k of Object.keys(valeurs)) if (banc.refus.has(k)) throw new Error('Écriture refusée.');
          for (const [k, v] of Object.entries(valeurs)) banc.stockage.set(k, structuredClone(v));
        },
        remove: async (cle: string) => void banc.stockage.delete(cle),
      },
      onChanged: { addListener: () => undefined, removeListener: () => undefined },
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lance un lot qui s’arrête sur la n-ième requête avec `resultat`. */
async function lotArreteSur(api: Api, actions: Action[], n: number, resultat: ResultatAction | Error, idLot = 'lot-1'): Promise<void> {
  banc.reponse = reponses({ [n]: resultat });
  await api.lancerLot(actions, idLot);
}

describe('AC2 : état v2 publié (SC-004)', () => {
  it('SC-004 : un 429 sur la 2e défausse -> lots, pause de 30 min et contexte d’erreur stockés', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(429));
    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({
      version: 2,
      idLot: 'lot-1',
      etat: 'arretee',
      traitees: 1,
      total: 4,
      lots: [{ famille: 'defausses', total: 4, traitees: 1, sautees: 0 }],
      pauseJusqua: Date.now() + 30 * 60_000,
    });
    expect(etat?.erreur).toMatchObject({
      type: 'defausse',
      parametre: null,
      idCarte: 'Rare|Carte 2',
      famille: 'defausses',
      indexLot: 1,
      nbLots: 1,
      rang: 2,
      totalLot: 4,
      codeHttp: 429,
      cause: 'code-http',
      le: Date.now(),
      reussies: 1,
      autresEchecsEnVol: 0,
    });
    expect(typeof etat?.erreur?.titre).toBe('string');
    expect(JSON.stringify(etat)).not.toContain('ex-2');
  });

  it('SC-004 : une exécution terminée porte des lots complets, ni pause ni erreur', async () => {
    const api = await frais();
    await api.lancerLot([defausse(1), enchere(2)], 'lot-1');
    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({
      etat: 'terminee',
      traitees: 2,
      total: 2,
      lots: [
        { famille: 'defausses', total: 1, traitees: 1, sautees: 0 },
        { famille: 'encheres', total: 1, traitees: 1, sautees: 0 },
      ],
      pauseJusqua: null,
      erreur: null,
    });
    expect(api.restantes()).toEqual([]);
  });

  it('SC-004 : les entrées de journal portent rang, total et famille', async () => {
    const api = await frais();
    await api.lancerLot([defausse(1), defausse(2), enchere(3)], 'lot-1');
    const journal = await api.chargerJournal();
    expect(journal.map((e) => [e.rang, e.total, e.lot, e.idLot])).toEqual([
      [1, 2, 'defausses', 'lot-1'],
      [2, 2, 'defausses', 'lot-1'],
      [1, 1, 'encheres', 'lot-1'],
    ]);
  });

  it('restantes() : l’action en erreur puis les actions non parties, en mémoire', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    expect(api.restantes()).toEqual([defausse(2), defausse(3), defausse(4)]);
  });
});

describe('AC6 : les restantes ne vivent qu’en mémoire (SC-017)', () => {
  it('SC-017 : après rechargement, plus de restantes ; la reprise est refusée ; le détail stocké reste lisible', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    const detail = await api.chargerExecution();

    const apres = await frais();
    expect(apres.restantes()).toEqual([]);
    await expect(apres.reessayer()).rejects.toThrow();
    await expect(apres.sauterAction()).rejects.toThrow();
    await expect(apres.sauterLot()).rejects.toThrow();
    expect(await apres.chargerExecution()).toEqual(detail);
    expect(banc.appels).toHaveLength(2);
  });
});

describe('AC4 : reprise (Réessayer) et conditions de lancement', () => {
  it('SC-005 : Réessayer renvoie l’action en erreur puis le reste, dans la même exécution', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    banc.reponse = reponses({});
    await api.reessayer();
    expect(banc.appels).toEqual([defausse(1), defausse(2), defausse(2), defausse(3), defausse(4)]);
    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({ idLot: 'lot-1', etat: 'terminee', traitees: 4, total: 4, erreur: null, pauseJusqua: null });
    expect(etat?.lots).toEqual([{ famille: 'defausses', total: 4, traitees: 4, sautees: 0 }]);
    expect((await api.chargerJournal()).every((e) => e.idLot === 'lot-1')).toBe(true);
    expect(api.restantes()).toEqual([]);
  });

  it('SC-005 : la reprise prend le bail pendant l’envoi et le libère ensuite', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    expect(await api.chargerBailSynchro()).toBeNull();
    let bailPendant: number | null = null;
    banc.reponse = async () => {
      bailPendant = await api.chargerBailSynchro();
      return OK;
    };
    await api.reessayer();
    expect(bailPendant).not.toBeNull();
    expect(await api.chargerBailSynchro()).toBeNull();
  });

  it('SC-005 : bail tenu par la synchro -> la reprise est refusée et les restantes sont gardées', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    await api.enregistrerBailSynchro(Date.now() + 60_000);
    await expect(api.reessayer()).rejects.toThrow(/en cours/);
    expect(api.restantes()).toHaveLength(3);
    expect(banc.appels).toHaveLength(2);
  });

  it('SC-005 : verrou d’exécution pris par un autre onglet -> la reprise est refusée', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    banc.verrou = true;
    await expect(api.reessayer()).rejects.toThrow(/en cours/);
    expect(banc.appels).toHaveLength(2);
    expect(api.restantes()).toHaveLength(3);
  });

  it('SC-005 : la reprise refait la revérification, la cadence et les arrêts (un nouvel arrêt rouvre le panneau)', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    banc.reponse = reponses({ 3: echec(409) });
    await api.reessayer();
    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({ etat: 'arretee', traitees: 1 });
    expect(etat?.erreur).toMatchObject({ idCarte: 'Rare|Carte 2', rang: 2, codeHttp: 409 });
    expect(api.restantes()).toEqual([defausse(2), defausse(3), defausse(4)]);
  });
});

describe('décision 2 : Réessayer après résultat inconnu', () => {
  it('SC-005 : refusé avec la raison écrite, sans requête ; Sauter reste possible', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, { classe: 'inconnu', codeHttp: null, cause: 'délai dépassé' });
    expect((await api.chargerExecution())?.pauseJusqua).toBeNull();

    await expect(api.reessayer()).rejects.toThrow(RAISON_RESULTAT_INCONNU);
    expect(banc.appels).toHaveLength(2);

    banc.reponse = reponses({});
    await api.sauterAction();
    expect(banc.appels.slice(2)).toEqual([defausse(3), defausse(4)]);
  });
});

describe('décision 2 : erreur de transport', () => {
  it('SC-016 : pas de pause (Réessayer sans attente), mais le résultat est inconnu : Réessayer refusé, Sauter possible', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, new Error('coupure'));
    expect((await api.chargerExecution())?.pauseJusqua).toBeNull();
    expect((await api.chargerExecution())?.erreur).toMatchObject({ cause: 'transport', codeHttp: null });
    await expect(api.reessayer()).rejects.toThrow(RAISON_RESULTAT_INCONNU);
    expect(banc.appels).toHaveLength(2);
  });
});

describe('AC4 : sauterAction (SC-005)', () => {
  it('SC-005 : journal « passée » (cause sautee), aucun transport pour la sautée, reprise à la suivante', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    banc.reponse = reponses({});
    await api.sauterAction();

    expect(banc.appels).toEqual([defausse(1), defausse(2), defausse(3), defausse(4)]);
    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({ idLot: 'lot-1', etat: 'terminee', traitees: 4, total: 4, erreur: null });
    expect(etat?.lots).toEqual([{ famille: 'defausses', total: 4, traitees: 3, sautees: 1 }]);

    const entrees = (await api.chargerJournal()).filter((e) => e.idCarte === 'Rare|Carte 2');
    expect(entrees.map((e) => e.resultat)).toEqual(['echouee', 'passee']);
    expect(entrees[1]).toMatchObject({ cause: 'sautee', type: 'defausse', lot: 'defausses', rang: 2, total: 4, idLot: 'lot-1' });
  });

  it('SC-005 : sans restante (rien à sauter), la demande est refusée', async () => {
    const api = await frais();
    await api.lancerLot([defausse(1)], 'lot-1');
    await expect(api.sauterAction()).rejects.toThrow();
  });
});

describe('Lecture des enchères en cours avant un lot d’enchères (Alexis, 2026-11-15)', () => {
  it('sans enchère : aucune lecture', async () => {
    const api = await frais();
    banc.ventes = { enCours: 5, max: 5 };
    await api.lancerLot([defausse(1)], 'lot-1');
    expect(banc.lectures).toBe(0);
    expect(banc.appels).toEqual([defausse(1)]);
  });

  it('ne garde que les places libres, les plus chères d’abord', async () => {
    const api = await frais();
    banc.ventes = { enCours: 3, max: 5 };
    await api.lancerLot([defausse(1), enchere(2), enchere(3), enchere(4)], 'lot-1');
    expect(banc.lectures).toBe(1);
    expect(banc.appels).toEqual([defausse(1), enchere(2), enchere(3)]);
  });

  it('les enchères écartées sont notées « Passée » dans le journal avec la raison, sans requête', async () => {
    const api = await frais();
    banc.ventes = { enCours: 4, max: 5 };
    await api.lancerLot([enchere(1), enchere(2), enchere(3)], 'lot-1');
    expect(banc.appels).toEqual([enchere(1)]);
    const journal = await api.chargerJournal();
    const passees = journal.filter((e) => e.resultat === 'passee');
    expect(passees.map((e) => e.idCarte)).toEqual(['Rare|Carte 2', 'Rare|Carte 3']);
    expect(passees[0]?.diagnostic).toContain('Aucune place d’enchère libre : 4 en cours sur 5');
  });

  it('lecture sans résultat exploitable : le lot part tel quel', async () => {
    const api = await frais();
    banc.ventes = undefined;
    await api.lancerLot([enchere(1), enchere(2)], 'lot-1');
    expect(banc.appels).toEqual([enchere(1), enchere(2)]);
  });

  it('la première enchère part au moins 0,2 s après la lecture', async () => {
    const api = await frais();
    banc.ventes = { enCours: 0, max: 5 };
    const avant = banc.t;
    await api.lancerLot([enchere(1)], 'lot-1');
    expect(banc.t - avant).toBeGreaterThanOrEqual(200);
  });

  it('403 anti-bot sur la lecture : lancement refusé avec le libellé dédié, rien d’envoyé', async () => {
    const api = await frais();
    banc.lectureResultat = { classe: 'echec', codeHttp: 403, cause: 'vérification anti-bot requise' };
    await expect(api.lancerLot([enchere(1)], 'lot-1')).rejects.toThrow('Vérification anti-bot du site requise');
    expect(banc.appels).toEqual([]);
  });

  it('403 ordinaire sur la lecture : lancement refusé, sans pause', async () => {
    const api = await frais();
    banc.lectureResultat = { classe: 'echec', codeHttp: 403, cause: 'action non disponible' };
    await expect(api.lancerLot([enchere(1)], 'lot-1')).rejects.toThrow('Le site a refusé la lecture');
    banc.lectureResultat = undefined;
    banc.ventes = { enCours: 0, max: 5 };
    await api.lancerLot([enchere(1)], 'lot-2');
    expect(banc.appels).toEqual([enchere(1)]);
  });

  it.each([401, 429])('%i sur la lecture : lancement refusé et pause de 30 min', async (code) => {
    const api = await frais();
    banc.lectureResultat = { classe: 'echec', codeHttp: code, cause: 'action non disponible' };
    await expect(api.lancerLot([enchere(1)], 'lot-1')).rejects.toThrow('Le site a refusé la lecture');
    banc.lectureResultat = undefined;
    await expect(api.lancerLot([defausse(2)], 'lot-2')).rejects.toThrow(/Reprise possible à/);
    expect(banc.appels).toEqual([]);
  });

  it('aucune place libre : lancement refusé avec un libellé fixe, rien d’envoyé', async () => {
    const api = await frais();
    banc.ventes = { enCours: 5, max: 5 };
    await expect(api.lancerLot([enchere(1), enchere(2)], 'lot-1')).rejects.toThrow('Limite d’enchères actives atteinte');
    expect(banc.appels).toEqual([]);
  });
});

describe('Vérification des étiquettes du site avant un lot d’étiquettes (Alexis, 2026-11-23)', () => {
  const U1 = '0a1b2c3d-0000-4000-8000-000000000001';
  const U2 = '0a1b2c3d-0000-4000-8000-000000000002';
  const lue = (...e: Array<{ id: string; nom: string }>): ResultatAction => ({ classe: 'reussie', codeHttp: 200, cause: 'action réussie', etiquettes: e.map((x) => ({ ...x, nbCartes: 1 })) });
  const registreDe = (noms: Record<string, string>) => ({ version: 2, etiquettes: noms, couples: [{ ex: 'ex-1', nom: '#Musique' }] });

  it('une seule lecture par lot d’étiquettes, aucune pour un lot sans étiquette', async () => {
    const api = await frais();
    await api.lancerLot([defausse(1)], 'lot-1');
    expect(banc.lectures).toBe(0);
    await api.lancerLot([pose('1', 'ex-1', '#Musique')], 'lot-2');
    expect(banc.lectures).toBe(1);
  });

  it('étiquette disparue du site : création en tête du lot', async () => {
    const api = await frais();
    await api.enregistrerPreferences({ ...(await api.chargerPreferences()), modeEtiquettes: 'poser' });
    await api.enregistrerRegistre(registreDe({ '#Musique': U1 }));
    banc.lectureResultat = lue({ id: U2, nom: '#Autre' });
    await api.lancerLot([pose('2', 'ex-2', '#Musique')], 'lot-1');
    expect(banc.appels[0]).toMatchObject({ type: 'creation-etiquette', nomEtiquette: '#Musique' });
    expect(banc.appels.at(-1)).toMatchObject({ type: 'pose-etiquette', nomEtiquette: '#Musique' });
    expect((await api.chargerRegistre()).etiquettes['#Musique']).toBeUndefined();
  });

  it('liste vide relue : registre inchangé, aucune création', async () => {
    const api = await frais();
    await api.enregistrerRegistre(registreDe({ '#Musique': U1 }));
    banc.lectureResultat = lue();
    await api.lancerLot([pose('2', 'ex-2', '#Musique')], 'lot-1');
    expect(banc.appels.map((a) => a.type)).toEqual(['pose-etiquette']);
    expect((await api.chargerRegistre()).etiquettes['#Musique']).toBe(U1);
  });

  it('réponse sans liste (réseau, hors contrat) : le lot part tel quel', async () => {
    const api = await frais();
    await api.enregistrerRegistre(registreDe({ '#Musique': U1 }));
    banc.lectureResultat = { classe: 'inconnu', codeHttp: null, cause: 'erreur réseau' };
    await api.lancerLot([pose('2', 'ex-2', '#Musique')], 'lot-1');
    expect(banc.appels.map((a) => a.type)).toEqual(['pose-etiquette']);
  });

  it('403 anti-bot : lancement refusé avec le libellé dédié, rien d’envoyé', async () => {
    const api = await frais();
    banc.lectureResultat = { classe: 'echec', codeHttp: 403, cause: 'vérification anti-bot requise' };
    await expect(api.lancerLot([pose('1', 'ex-1', '#Musique')], 'lot-1')).rejects.toThrow('Vérification anti-bot');
    expect(banc.appels).toEqual([]);
  });

  it.each([401, 429])('%i sur la lecture : lancement refusé et pause de 30 min', async (code) => {
    const api = await frais();
    banc.lectureResultat = { classe: 'echec', codeHttp: code, cause: 'action non disponible' };
    await expect(api.lancerLot([pose('1', 'ex-1', '#Musique')], 'lot-1')).rejects.toThrow('Le site a refusé la lecture de tes étiquettes');
    banc.lectureResultat = undefined;
    await expect(api.lancerLot([defausse(2)], 'lot-2')).rejects.toThrow(/Reprise possible à/);
    expect(banc.appels).toEqual([]);
  });
});

describe('AC4 : sauterLot (SC-005, H10)', () => {
  it('SC-005 : une seule entrée de journal, les N - 1 autres comptées sautées, reprise au lot suivant', async () => {
    const api = await frais();
    await lotArreteSur(api, [defausse(1), defausse(2), defausse(3), enchere(4), enchere(5)], 2, echec(409));
    banc.reponse = reponses({});
    await api.sauterLot();

    expect(banc.appels).toEqual([defausse(1), defausse(2), enchere(4), enchere(5)]);
    expect(banc.appels).not.toContainEqual(defausse(3));
    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({ idLot: 'lot-1', etat: 'terminee', traitees: 5, total: 5, erreur: null });
    expect(etat?.lots).toEqual([
      { famille: 'defausses', total: 3, traitees: 1, sautees: 2 },
      { famille: 'encheres', total: 2, traitees: 2, sautees: 0 },
    ]);
    const journal = await api.chargerJournal();
    const sautees = journal.filter((e) => e.cause === 'sautee');
    expect(sautees).toHaveLength(1);
    expect(sautees[0]).toMatchObject({ idCarte: 'Rare|Carte 2', resultat: 'passee' });
    expect(journal.some((e) => e.idCarte === 'Rare|Carte 3')).toBe(false);
  });
});

describe('AC4 : ignorer (SC-006)', () => {
  it('SC-006 : écrit `ignorees` puis agit comme Sauter (cause ignoree), sans requête pour l’action', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    banc.reponse = reponses({});
    await api.ignorer();

    expect(await api.chargerIgnorees()).toEqual([
      { type: 'defausse', idCarte: 'Rare|Carte 2', parametre: null, portee: 'synchro', date: Date.now() },
    ]);
    expect(banc.appels).toEqual([defausse(1), defausse(2), defausse(3), defausse(4)]);
    const journal = await api.chargerJournal();
    expect(journal.filter((e) => e.cause === 'ignoree')).toHaveLength(1);
    expect((await api.chargerExecution())?.lots).toEqual([{ famille: 'defausses', total: 4, traitees: 3, sautees: 1 }]);
  });

  it('SC-006 : écriture du stockage refusée -> message d’erreur, rien d’ignoré, rien de sauté', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    const avant = await api.chargerExecution();
    const journalAvant = await api.chargerJournal();
    banc.refus.add('ignorees');

    await expect(api.ignorer()).rejects.toThrow();
    expect(await api.chargerIgnorees()).toEqual([]);
    expect(api.restantes()).toEqual([defausse(2), defausse(3), defausse(4)]);
    expect(await api.chargerJournal()).toEqual(journalAvant);
    expect(await api.chargerExecution()).toEqual(avant);
    expect(banc.appels).toHaveLength(2);
  });

  it('retouche T-307 : un refus d’écriture de `execution` à l’arrêt est signalé, pas avalé', async () => {
    const api = await frais();
    const messages: string[] = [];
    api.abonnerEchecEcriture((m) => messages.push(m));
    banc.refus.add('execution');
    await lotArreteSur(api, quatreDefausses(), 2, echec(429));
    await api.contexteExecution().ecritures;
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toMatch(/état d’exécution/i);
  });

  it('retouche T-307 : un lot dont l’écriture réussit ne signale rien', async () => {
    const api = await frais();
    const messages: string[] = [];
    api.abonnerEchecEcriture((m) => messages.push(m));
    await lotArreteSur(api, quatreDefausses(), 2, echec(429));
    await api.contexteExecution().ecritures;
    expect(messages).toEqual([]);
  });

  it('retouche T-303 : une clé `ignorees` illisible (version inconnue) n’est jamais écrasée ; rien d’ignoré', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    const illisible = { version: 99, entrees: [{ inconnu: true }] };
    banc.stockage.set('ignorees', illisible);

    await expect(api.ignorer()).rejects.toThrow();
    expect(banc.stockage.get('ignorees')).toEqual(illisible);
    expect(api.restantes()).toEqual([defausse(2), defausse(3), defausse(4)]);
    expect(banc.appels).toHaveLength(2);
  });
});

describe('AC5 : sauter ou ignorer une création d’étiquette (décision 4)', () => {
  const lotCreation = (): Action[] => [
    creation('A', '#X'),
    pose('A', 'ex-1', '#X'),
    pose('B', 'ex-2', '#X'),
    pose('B', 'ex-3', '#Y'),
    defausse(5),
  ];

  async function creationRefusee(): Promise<Api> {
    const api = await frais();
    // 429 sur une création d’étiquette : pause de 30 min (le 403 n'en déclenche plus, Alexis 2026-11-15), nous sautons en local.
    await lotArreteSur(api, lotCreation(), 1, echec(429));
    return api;
  }

  it.each([
    ['sauterAction', 'sautee'],
    ['ignorer', 'ignoree'],
  ] as const)('SC-006 : %s retire des restantes les poses de la même étiquette, comptées sautées', async (methode, cause) => {
    const api = await creationRefusee();
    await api[methode]();

    expect(api.restantes()).toEqual([pose('B', 'ex-3', '#Y'), defausse(5)]);
    const etat = await api.chargerExecution();
    expect(etat?.lots[0]).toEqual({ famille: 'etiquettes', total: 4, traitees: 0, sautees: 3 });
    expect(etat?.traitees).toBe(3);
    expect(banc.appels).toEqual([creation('A', '#X')]);
    // Une seule entrée « passée » pour la création ; les poses retirées n’ont pas d’entrée propre.
    expect((await api.chargerJournal()).filter((e) => e.cause === cause)).toHaveLength(1);
    if (methode === 'ignorer') {
      expect(await api.chargerIgnorees()).toEqual([
        { type: 'creation-etiquette', idCarte: 'Rare|Carte A', parametre: '#X', portee: 'synchro', date: Date.now() },
      ]);
    }
  });

  it('SC-006 : à la fin de la pause, seules les poses d’une autre étiquette et la défausse partent', async () => {
    const api = await creationRefusee();
    await api.sauterAction();
    vi.setSystemTime(Date.now() + 30 * 60_000 + 1);
    banc.reponse = reponses({});
    await api.reessayer();
    expect(banc.appels).toEqual([creation('A', '#X'), pose('B', 'ex-3', '#Y'), defausse(5)]);
    expect((await api.chargerExecution())?.etat).toBe('terminee');
  });
});

describe('AC1, SC-014 : pause, reprise et arrêt du lot', () => {
  it('SC-014 : en pause, aucun nouveau départ ; verrou et bail gardés ; Reprendre continue la même exécution', async () => {
    const api = await frais();
    banc.reponse = (_a, n) => {
      if (n === 1) api.pause();
      return OK;
    };
    const fin = api.lancerLot(quatreDefausses(), 'lot-1');
    await vide();

    expect(banc.appels).toHaveLength(1);
    expect(api.enPause()).toBe(true);
    expect(banc.verrou).toBe(true);
    expect(await api.chargerBailSynchro()).toBeGreaterThan(Date.now());

    api.reprendre();
    await fin;
    expect(api.enPause()).toBe(false);
    expect(banc.appels).toHaveLength(4);
    expect(banc.demarrages).toBe(1);
    expect((await api.chargerExecution())?.etat).toBe('terminee');
    expect(banc.verrou).toBe(false);
    expect(await api.chargerBailSynchro()).toBeNull();
  });

  it('H18 : au-delà de 15 min de pause, arrêt manuel, bail et verrou libérés, restantes gardées', async () => {
    const api = await frais();
    banc.reponse = (_a, n) => {
      if (n === 1) api.pause();
      return OK;
    };
    const fin = api.lancerLot(quatreDefausses(), 'lot-1');
    await vide();
    await banc.avancer(15 * 60_000);
    await fin;

    const etat = await api.chargerExecution();
    expect(etat).toMatchObject({ etat: 'arretee', traitees: 1, total: 4, pauseJusqua: null, erreur: null });
    expect(banc.verrou).toBe(false);
    expect(await api.chargerBailSynchro()).toBeNull();
    expect(api.restantes()).toEqual([defausse(2), defausse(3), defausse(4)]);
    expect(banc.appels).toHaveLength(1);
  });

  it('pause() et reprendre() sans exécution ne lèvent rien', async () => {
    const api = await frais();
    expect(() => {
      api.pause();
      api.reprendre();
    }).not.toThrow();
    expect(api.enPause()).toBe(false);
  });

  it('arreterTout() pendant l’exécution arrête (raison manuel) ; pendant la pause aussi', async () => {
    const api = await frais();
    banc.reponse = (_a, n) => {
      if (n === 1) api.pause();
      return OK;
    };
    const fin = api.lancerLot(quatreDefausses(), 'lot-1');
    await vide();
    api.arreterTout();
    await fin;
    expect((await api.chargerExecution())?.etat).toBe('arretee');
    expect(banc.appels).toHaveLength(1);
  });

  it('arreterTout() après une erreur vide les restantes : plus de reprise', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    api.arreterTout();
    expect(api.restantes()).toEqual([]);
    await expect(api.reessayer()).rejects.toThrow();
    expect(banc.appels).toHaveLength(2);
  });
});

describe('AC7 : aucun chemin ne contourne la pause de 30 min (SC-016)', () => {
  async function enPause(): Promise<{ api: Api; message: string }> {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(429));
    return { api, message: `Reprise possible à ${hhmm(Date.now() + 30 * 60_000)}` };
  }

  it('Réessayer est refusé', async () => {
    const { api, message } = await enPause();
    await expect(api.reessayer()).rejects.toThrow(message);
    expect(banc.appels).toHaveLength(2);
  });

  it('Lancer (nouveau lot) est refusé', async () => {
    const { api, message } = await enPause();
    await expect(api.lancerLot([defausse(9)], 'lot-2')).rejects.toThrow(message);
    expect(banc.appels).toHaveLength(2);
    expect(banc.demarrages).toBe(1);
  });

  it('la suppression d’étiquettes est refusée', async () => {
    const { api, message } = await enPause();
    await api.enregistrerEtiquettesSite([{ id: '0a1b2c3d-0000-4000-8000-000000000001', nom: 'Ancienne étiquette fictive', nbCartes: 2 }]);
    await expect(
      api.lancerSuppressionEtiquettes([{ id: '0a1b2c3d-0000-4000-8000-000000000001', nom: 'Ancienne étiquette fictive' }]),
    ).rejects.toThrow(message);
    expect(banc.appels).toHaveLength(2);
    expect(banc.demarrages).toBe(1);
  });

  it('un autre onglet (modules neufs, même stockage) est refusé aussi', async () => {
    const { message } = await enPause();
    const autre = await frais();
    await expect(autre.lancerLot([defausse(9)], 'lot-2')).rejects.toThrow(message);
    expect(banc.appels).toHaveLength(2);
  });

  it('la reprise après Sauter est différée : effet local seulement, rien n’est envoyé', async () => {
    const { api } = await enPause();
    const avant = await api.chargerExecution();
    await api.sauterAction();
    expect(banc.appels).toHaveLength(2);
    expect(banc.demarrages).toBe(1);
    expect(api.restantes()).toEqual([defausse(3), defausse(4)]);
    const apres = await api.chargerExecution();
    expect(apres?.pauseJusqua).toBe(avant?.pauseJusqua);
    expect(apres?.lots).toEqual([{ famille: 'defausses', total: 4, traitees: 1, sautees: 1 }]);
    const sautee = (await api.chargerJournal()).filter((e) => e.cause === 'sautee');
    expect(sautee).toHaveLength(1);
  });

  it('Sauter le lot et Ignorer restent possibles pendant la pause, sans rien envoyer', async () => {
    const { api } = await enPause();
    await api.ignorer();
    expect(banc.appels).toHaveLength(2);
    expect(await api.chargerIgnorees()).toHaveLength(1);
    await api.sauterLot();
    expect(banc.appels).toHaveLength(2);
    expect(api.restantes()).toEqual([]);
    expect((await api.chargerExecution())?.pauseJusqua).not.toBeNull();
  });

  it('Réessayer reste refusé après Sauter tant que la pause dure', async () => {
    const { api, message } = await enPause();
    await api.sauterAction();
    await expect(api.reessayer()).rejects.toThrow(message);
    expect(banc.appels).toHaveLength(2);
  });

  it('Arrêter tout ne lève jamais la pause', async () => {
    const { api, message } = await enPause();
    api.arreterTout();
    await expect(api.lancerLot([defausse(9)], 'lot-2')).rejects.toThrow(message);
    expect((await api.chargerExecution())?.pauseJusqua).not.toBeNull();
  });

  it.each([
    ['401', quatreDefausses(), { 1: echec(401) }],
    ['429', quatreDefausses(), { 1: echec(429) }],
  ] as Array<[string, Action[], Record<number, ResultatAction>]>)('%s : la pause de 30 min est stockée', async (_nom, actions, sur) => {
    const api = await frais();
    banc.reponse = reponses(sur);
    await api.lancerLot(actions, 'lot-1');
    expect((await api.chargerExecution())?.pauseJusqua).toBe(Date.now() + 30 * 60_000);
  });

  it.each([
    ['3 échecs', quatreDefausses(), { 1: echec(500), 2: echec(500), 3: echec(500) }],
    ['refus hors exemplaire (403 sur une création d’étiquette)', [creation('A', '#X'), defausse(2)], { 1: echec(403) }],
  ] as Array<[string, Action[], Record<number, ResultatAction>]>)('Alexis 2026-11-15 : %s -> aucune pause, Réessayer immédiat', async (_nom, actions, sur) => {
    const api = await frais();
    banc.reponse = reponses(sur);
    await api.lancerLot(actions, 'lot-1');
    expect((await api.chargerExecution())?.etat).toBe('arretee');
    expect((await api.chargerExecution())?.pauseJusqua).toBeNull();
  });

  it('refus par carte (403 sur des défausses) : le lot continue, sans arrêt ni pause en dessous du seuil', async () => {
    const api = await frais();
    banc.reponse = reponses({ 1: echec(403), 2: echec(403), 3: echec(403) });
    await api.lancerLot(quatreDefausses(), 'lot-1');
    const etat = await api.chargerExecution();
    expect(etat?.etat).toBe('terminee');
    expect(etat?.pauseJusqua).toBeNull();
    expect(banc.appels).toHaveLength(4);
  });

  it('à l’heure dite (30 min), Lancer et Réessayer repartent', async () => {
    const { api } = await enPause();
    vi.setSystemTime(Date.now() + 30 * 60_000);
    banc.reponse = reponses({});
    await api.reessayer();
    expect(banc.appels.slice(2)).toEqual([defausse(2), defausse(3), defausse(4)]);
    const etat = await api.chargerExecution();
    expect(etat?.pauseJusqua).toBeNull();
    await expect(api.lancerLot([defausse(9)], 'lot-2')).resolves.toBeUndefined();
  });

  it.each([
    ['409', echec(409)],
    ['résultat inattendu', { classe: 'arret', codeHttp: null, cause: 'arrêt' } as ResultatAction],
  ] as Array<[string, ResultatAction | Error]>)('%s : aucune pause, Réessayer est immédiat', async (_nom, resultat) => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, resultat);
    expect((await api.chargerExecution())?.pauseJusqua).toBeNull();
    banc.reponse = reponses({});
    await api.reessayer();
    expect(banc.appels.slice(2)).toEqual([defausse(2), defausse(3), defausse(4)]);
    expect((await api.chargerExecution())?.etat).toBe('terminee');
  });
});

describe('état d’exécution illisible : rien ne part', () => {
  it('Lancer, Réessayer et Sauter sont refusés avec un message lisible', async () => {
    const api = await frais();
    await lotArreteSur(api, quatreDefausses(), 2, echec(409));
    banc.stockage.set('execution', { version: 99 });
    await expect(api.lancerLot([defausse(9)], 'lot-2')).rejects.toThrow(/illisible/);
    await expect(api.reessayer()).rejects.toThrow(/illisible/);
    await expect(api.sauterAction()).rejects.toThrow(/illisible/);
    expect(banc.appels).toHaveLength(2);
  });
});

describe('retraits voulus par le joueur : registre.refus', () => {
  const retrait: Action = { type: 'retrait-etiquette', idCarte: 'Rare|Carte 1', idExemplaire: 'ex-1', nomEtiquette: '#Chien' };

  it('retrait marqué « manuel » et réussi : le couple entre dans registre.refus', async () => {
    const api = await frais();
    api.marquerRetraitsManuels([retrait]);
    await api.lancerLot([retrait], 'retrait-1');
    expect((await api.chargerRegistre()).refus).toEqual([{ ex: 'ex-1', nom: '#Chien' }]);
  });
  it('retrait produit par un lot (non marqué) : refus inchangé', async () => {
    const api = await frais();
    await api.lancerLot([retrait], 'lot-1');
    expect((await api.chargerRegistre()).refus).toBeUndefined();
  });
  it('retrait manuel en échec : refus inchangé', async () => {
    const api = await frais();
    banc.reponse = reponses({ 1: echec(500) });
    api.marquerRetraitsManuels([retrait]);
    await api.lancerLot([retrait], 'retrait-1').catch(() => undefined);
    expect((await api.chargerRegistre()).refus).toBeUndefined();
  });
  it('lancement refusé : la marque est oubliée, un retrait de lot ultérieur ne devient pas un refus', async () => {
    const api = await frais();
    api.marquerRetraitsManuels([retrait]);
    api.oublierRetraitsManuels([retrait]);
    await api.lancerLot([retrait], 'lot-2');
    expect((await api.chargerRegistre()).refus).toBeUndefined();
  });
});
