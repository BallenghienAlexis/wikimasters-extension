/**
 * T-313 (AC1, SC-014, H18) : pause et reprise de la file (`src/lib/file.ts`), horloge injectée.
 *
 * Nommage fixé par ces tests :
 *   File.pause()            cesse tout nouveau départ ; sans effet si aucune exécution n’est en cours ou déjà en pause
 *   File.reprendre()        reprend la même exécution avec la cadence existante ; sans effet hors pause
 *   EtatFile.enPause        booléen publié aux abonnés et lu par `etat()`
 *   DUREE_PAUSE_MAX_MS      15 min (H18) : au-delà, arrêt `manuel` (l’appelant libère alors le bail)
 *
 * Contrat d’horloge : la pause attend l’échéance (`horloge.now()` au moment de `pause()` + DUREE_PAUSE_MAX_MS)
 * par `horloge.attendreJusqua(echeance)` mis en concurrence avec `reprendre()` et `arreter()` ; la durée de pause
 * est comptée avec `horloge.now()` (monotone), jamais avec `Date.now`.
 */
/* eslint-disable prefer-const -- la file est créée après les rappels de transport qui l’utilisent */
import { describe, expect, it } from 'vitest';
import type { Action, ResultatAction } from '../../src/lib/actions';
import { DUREE_PAUSE_MAX_MS, creerFile, type DependancesFile, type EtatFile, type File, type Horloge } from '../../src/lib/file';

const OK: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' };
const defausse = (n: number): Action => ({ type: 'defausse', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}` });
const pose = (n: number): Action => ({ type: 'pose-etiquette', idCarte: `Rare|Carte ${n}`, idExemplaire: `ex-${n}`, nomEtiquette: 'Garder' });

/**
 * Horloge maîtrisée : une attente courte (cadence, moins de 5 s) saute le temps aussitôt ; une attente longue
 * (la pause) reste en suspens jusqu’à `avancer`.
 */
function horlogeMaitrisee(): Horloge & { t: number; avancer: (ms: number) => Promise<void>; enAttente: () => number } {
  const attentes: Array<{ echeance: number; resoudre: () => void }> = [];
  const h = {
    t: 1_000_000,
    now: () => h.t,
    attendreJusqua(echeance: number): Promise<void> {
      if (echeance <= h.t) return Promise.resolve();
      if (echeance - h.t <= 5_000) {
        h.t = echeance;
        return Promise.resolve();
      }
      return new Promise<void>((resoudre) => attentes.push({ echeance, resoudre }));
    },
    async avancer(ms: number): Promise<void> {
      h.t += ms;
      for (const a of attentes.splice(0)) {
        if (a.echeance <= h.t) a.resoudre();
        else attentes.push(a);
      }
      await vide();
    },
    enAttente: () => attentes.length,
  };
  return h;
}

/** Laisse les microtâches et les minuteries réelles se vider. */
async function vide(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve();
  await new Promise<void>((r) => setTimeout(r, 0));
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

interface Banc {
  deps: DependancesFile;
  horloge: ReturnType<typeof horlogeMaitrisee>;
  requetes: Action[];
  departs: number[];
  journal: string[];
}

function banc(surcharge: Partial<DependancesFile> = {}): Banc {
  const horloge = horlogeMaitrisee();
  const requetes: Action[] = [];
  const departs: number[] = [];
  const journal: string[] = [];
  let compteur = 0;
  const deps: DependancesFile = {
    horloge,
    transport: async (a) => {
      requetes.push(a);
      departs.push(horloge.t);
      return OK;
    },
    reverifier: () => 'ok',
    appliquer: () => undefined,
    journal: {
      ouvrir: (a) => {
        const id = `e${++compteur}`;
        journal.push(`ouvrir:${id}:${a.type}`);
        return id;
      },
      completer: (id, r) => {
        journal.push(`completer:${id}:${r.classe}`);
      },
      passer: (id) => {
        journal.push(`passer:${id}`);
      },
    },
    ...surcharge,
  };
  return { deps, horloge, requetes, departs, journal };
}

/** Promesse résolue à la main. */
function differee<T>(): { promesse: Promise<T>; resoudre: (v: T) => void } {
  let resoudre!: (v: T) => void;
  const promesse = new Promise<T>((r) => (resoudre = r));
  return { promesse, resoudre };
}

describe('AC1 : pause d’une file séquentielle (SC-014)', () => {
  it('H18 : la pause maximale est de 15 minutes', () => {
    expect(DUREE_PAUSE_MAX_MS).toBe(15 * 60_000);
  });

  it('SC-014 : en pause, aucun nouveau départ ; la requête en vol va à son terme', async () => {
    const reponse1 = differee<ResultatAction>();
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        b.departs.push(b.horloge.t);
        return b.requetes.length === 1 ? reponse1.promesse : OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([defausse(1), defausse(2), defausse(3)], 'lot-1');
    await vide();
    expect(b.requetes).toHaveLength(1);

    file.pause();
    reponse1.resoudre(OK);
    await vide();

    // La requête 1 est terminée et comptée ; rien d’autre n’est parti.
    expect(b.requetes).toHaveLength(1);
    expect(file.etat()?.traitees).toBe(1);
    expect(file.etat()?.etat).toBe('en-cours');
    expect(file.etat()?.enPause).toBe(true);

    file.reprendre();
    const etat = await fin;
    expect(etat.etat).toBe('terminee');
    expect(etat.raison).toBeNull();
    expect(b.requetes).toEqual([defausse(1), defausse(2), defausse(3)]);
    expect(etat.enPause).toBe(false);
  });

  it('SC-014 : la reprise garde la cadence (200 ms au moins entre deux départs)', async () => {
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        b.departs.push(b.horloge.t);
        if (b.requetes.length === 1) file.pause();
        return OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([defausse(1), defausse(2), defausse(3)], 'lot-1');
    await vide();
    await b.horloge.avancer(60_000);
    file.reprendre();
    await fin;
    for (let i = 1; i < b.departs.length; i++) expect(b.departs[i]! - b.departs[i - 1]!).toBeGreaterThanOrEqual(200);
  });

  it('pause() et reprendre() sont sans effet hors exécution et hors pause', async () => {
    const b = banc();
    const file = creerFile(b.deps);
    expect(() => {
      file.pause();
      file.reprendre();
    }).not.toThrow();
    const etat = await file.demarrer([defausse(1), defausse(2)], 'lot-1');
    expect(etat.etat).toBe('terminee');
    expect(etat.enPause).toBe(false);
    file.reprendre();
    file.pause();
    expect(file.etat()?.enPause).toBe(false);
  });

  it('pause() deux fois de suite équivaut à une seule', async () => {
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        if (b.requetes.length === 1) {
          file.pause();
          file.pause();
        }
        return OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([defausse(1), defausse(2)], 'lot-1');
    await vide();
    expect(b.requetes).toHaveLength(1);
    file.reprendre();
    expect((await fin).etat).toBe('terminee');
    expect(b.requetes).toHaveLength(2);
  });

  it('les abonnés reçoivent l’état de pause puis de reprise', async () => {
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        if (b.requetes.length === 1) file.pause();
        return OK;
      },
    });
    file = creerFile(b.deps);
    const vus: boolean[] = [];
    file.abonner((e: EtatFile) => vus.push(e.enPause));
    const fin = file.demarrer([defausse(1), defausse(2)], 'lot-1');
    await vide();
    file.reprendre();
    await fin;
    expect(vus).toContain(true);
    expect(vus[vus.length - 1]).toBe(false);
    expect(vus.indexOf(true)).toBeLessThan(vus.lastIndexOf(false));
  });

  it('SC-014 : « Arrêter » pendant la pause termine aussitôt l’exécution (raison manuel)', async () => {
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        if (b.requetes.length === 1) file.pause();
        return OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([defausse(1), defausse(2), defausse(3)], 'lot-1');
    await vide();
    file.arreter();
    const etat = await fin;
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('manuel');
    expect(b.requetes).toHaveLength(1);
    expect(etat.enPause).toBe(false);
  });
});

describe('AC1 : pause d’un lot parallèle (créneaux réservés compris)', () => {
  it('SC-014 : aucun ordre du lot ne part en pause, même avec un créneau déjà réservé ; chacun part une fois à la reprise', async () => {
    let file!: File;
    let ouvertures = 0;
    const b = banc({
      concurrence: 3,
      journal: {
        ouvrir: (a) => {
          ouvertures++;
          // La pause survient pendant l’écriture du journal du premier ordre : les trois créneaux sont déjà pris.
          if (ouvertures === 1) file.pause();
          return `e${ouvertures}:${a.type}`;
        },
        completer: () => undefined,
        passer: () => undefined,
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([pose(1), pose(2), pose(3), pose(4), pose(5), pose(6)], 'lot-1');
    await vide();
    await b.horloge.avancer(1_000);
    expect(b.requetes).toHaveLength(0);
    expect(file.etat()?.enPause).toBe(true);

    file.reprendre();
    const etat = await fin;
    expect(etat.etat).toBe('terminee');
    expect(b.requetes).toHaveLength(6);
    expect(new Set(b.requetes.map((a) => (a.type === 'pose-etiquette' ? a.idExemplaire : '')))).toEqual(
      new Set(['ex-1', 'ex-2', 'ex-3', 'ex-4', 'ex-5', 'ex-6']),
    );
    const tries = [...b.departs].sort((x, y) => x - y);
    for (let i = 1; i < tries.length; i++) expect(tries[i]! - tries[i - 1]!).toBeGreaterThanOrEqual(200);
  });

  it('SC-014 : les requêtes déjà en vol se terminent pendant la pause et sont comptées', async () => {
    const reponses = [differee<ResultatAction>(), differee<ResultatAction>(), differee<ResultatAction>()];
    let file!: File;
    const b = banc({
      concurrence: 3,
      transport: async (a) => {
        const n = b.requetes.length;
        b.requetes.push(a);
        b.departs.push(b.horloge.t);
        return reponses[n] ? reponses[n]!.promesse : OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([pose(1), pose(2), pose(3), pose(4), pose(5), pose(6)], 'lot-1');
    await vide();
    expect(b.requetes).toHaveLength(3);

    file.pause();
    for (const r of reponses) r.resoudre(OK);
    await vide();
    expect(b.requetes).toHaveLength(3);
    expect(file.etat()?.traitees).toBe(3);

    file.reprendre();
    expect((await fin).etat).toBe('terminee');
    expect(b.requetes).toHaveLength(6);
  });
});

describe('H18 : au-delà de 15 minutes de pause, arrêt manuel', () => {
  async function enPause(): Promise<{ b: Banc; file: File; fin: Promise<EtatFile> }> {
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        if (b.requetes.length === 1) file.pause();
        return OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([defausse(1), defausse(2), defausse(3)], 'lot-1');
    await vide();
    return { b, file, fin };
  }

  it('SC-014 : à 15 min exactement, l’exécution s’arrête avec la raison `manuel` ; rien ne part', async () => {
    const { b, file, fin } = await enPause();
    await b.horloge.avancer(DUREE_PAUSE_MAX_MS - 1);
    expect(file.etat()?.etat).toBe('en-cours');
    expect(file.etat()?.enPause).toBe(true);

    await b.horloge.avancer(1);
    const etat = await fin;
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('manuel');
    expect(etat.enPause).toBe(false);
    expect(b.requetes).toHaveLength(1);
  });

  it('SC-014 : les actions non parties restent disponibles pour une reprise ultérieure', async () => {
    const { b, fin } = await enPause();
    await b.horloge.avancer(DUREE_PAUSE_MAX_MS);
    const etat = await fin;
    expect(etat.restantes).toEqual([defausse(2), defausse(3)]);
  });

  it('une reprise avant 15 min annule le délai ; une seconde pause repart de zéro', async () => {
    let file!: File;
    const b = banc({
      transport: async (a) => {
        b.requetes.push(a);
        if (b.requetes.length === 1 || b.requetes.length === 3) file.pause();
        return OK;
      },
    });
    file = creerFile(b.deps);
    const fin = file.demarrer([defausse(1), defausse(2), defausse(3), defausse(4)], 'lot-1');
    await vide();
    await b.horloge.avancer(10 * 60_000);
    file.reprendre();
    await vide();
    // Reprise : les requêtes 2 et 3 partent, la requête 3 remet en pause.
    expect(b.requetes).toHaveLength(3);
    expect(file.etat()?.enPause).toBe(true);

    // Dix minutes de plus : l’échéance de la première pause (15 min) est passée, la seconde n’est qu’à 10 min.
    await b.horloge.avancer(10 * 60_000);
    expect(file.etat()?.etat).toBe('en-cours');
    expect(file.etat()?.enPause).toBe(true);

    file.reprendre();
    expect((await fin).etat).toBe('terminee');
    expect(b.requetes).toHaveLength(4);
  });
});

describe('revérification après une pause attendue', () => {
  it('SC-014 : une action devenue « passée » pendant la pause n’est jamais envoyée à la reprise', async () => {
    let file!: File
    let passee = false
    const b = banc({
      reverifier: (a) => (passee && a.type === 'defausse' && a.idExemplaire === 'ex-2' ? 'passee' : 'ok'),
      transport: async (a) => {
        b.requetes.push(a)
        if (b.requetes.length === 1) file.pause()
        return OK
      },
    })
    file = creerFile(b.deps)
    const fin = file.demarrer([defausse(1), defausse(2)], 'lot-1')
    await vide()
    passee = true
    file.reprendre()
    const etat = await fin
    expect(etat.etat).toBe('terminee')
    expect(b.requetes).toEqual([defausse(1)])
    expect(b.journal.some((l) => l.startsWith('passer:'))).toBe(true)
  })

  it('SC-014 : pause pendant l’écriture du journal, carte devenue « passée » : entrée passée, aucune requête', async () => {
    let file!: File
    let ouvertures = 0
    let passee = false
    const passees: string[] = []
    const b = banc({
      reverifier: () => (passee ? 'passee' : 'ok'),
      journal: {
        ouvrir: () => {
          if (++ouvertures === 1) file.pause()
          return `e${ouvertures}`
        },
        completer: () => undefined,
        passer: (id) => void passees.push(id),
      },
    })
    file = creerFile(b.deps)
    const fin = file.demarrer([defausse(1)], 'lot-1')
    await vide()
    passee = true
    file.reprendre()
    expect((await fin).etat).toBe('terminee')
    expect(b.requetes).toHaveLength(0)
    expect(passees).toEqual(['e1'])
  })
})
