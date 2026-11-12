import { describe, expect, it } from 'vitest';
import type { Action, ResultatAction } from '../../src/lib/actions';
import { creerFile, type DependancesFile, type Horloge } from '../../src/lib/file';

const OK: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' };
const echec = (codeHttp = 500): ResultatAction => ({ classe: 'echec', codeHttp, cause: 'échec' });
const arret = (codeHttp: number | null, cause = 'arrêt'): ResultatAction => ({ classe: 'arret', codeHttp, cause });
const INCONNU: ResultatAction = { classe: 'inconnu', codeHttp: null, cause: 'délai dépassé' };

const lecture = (n: number): Action => ({ type: 'lecture', idCarte: `Rare|Carte ${n}` });
const pose = (n: number): Action => ({
  type: 'pose-etiquette',
  idCarte: `Rare|Carte ${n}`,
  idExemplaire: `ex-${n}`,
  nomEtiquette: 'Garder',
});
const defausse = (n: number): Action => ({
  type: 'defausse',
  idCarte: `Rare|Carte ${n}`,
  idExemplaire: `ex-${n}`,
});
const lot = (n: number): Action[] => Array.from({ length: n }, (_, i) => lecture(i + 1));

/** Horloge simulée : attendre avance le temps virtuel instantanément. */
function horlogeSimulee(): Horloge & { t: number } {
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

interface Banc {
  deps: DependancesFile;
  horloge: Horloge & { t: number };
  departs: number[];
  requetes: Action[];
  appliquees: Array<[Action, ResultatAction]>;
  journal: string[];
}

function banc(
  surcharge: Partial<DependancesFile> = {},
  reponses: (n: number, action: Action) => ResultatAction = () => OK,
  latence = 0,
): Banc {
  const horloge = horlogeSimulee();
  const departs: number[] = [];
  const requetes: Action[] = [];
  const appliquees: Array<[Action, ResultatAction]> = [];
  const journal: string[] = [];
  let compteur = 0;
  const deps: DependancesFile = {
    horloge,
    transport: async (action) => {
      departs.push(horloge.t);
      requetes.push(action);
      const r = reponses(requetes.length, action);
      horloge.t += latence;
      return r;
    },
    confirmer: () => 'defausser',
    reverifier: () => 'ok',
    appliquer: (action, resultat) => {
      appliquees.push([action, resultat]);
    },
    journal: {
      ouvrir: (action) => {
        const id = `e${++compteur}`;
        journal.push(`ouvrir:${id}:${action.type}`);
        return id;
      },
      completer: (id, resultat) => {
        journal.push(`completer:${id}:${resultat.classe}`);
      },
      passer: (id) => {
        journal.push(`passer:${id}`);
      },
    },
    ...surcharge,
  };
  return { deps, horloge, departs, requetes, appliquees, journal };
}

describe('délai supplémentaire variable (décision du 2026-11-11)', () => {
  it('ajoute le supplément tiré à l’intervalle de 200 ms, jamais en dessous', async () => {
    const tirages = [0, 1500, 4000, 2500]
    let i = 0
    const b = banc({ delaiSupplementaire: () => tirages[i++ % tirages.length]! })
    await creerFile(b.deps).demarrer(lot(5), 'lot-1')
    // Le supplément tiré après la requête n s'applique avant la requête n + 1.
    expect(b.departs.slice(1).map((d, n) => d - b.departs[n]!)).toEqual([200, 300, 300, 300])
  })

  it('borne un tirage hors limites, négatif ou non numérique', async () => {
    const tirages = [99_999, -5, Number.NaN, 4000.9]
    let i = 0
    const b = banc({ delaiSupplementaire: () => tirages[i++]! })
    await creerFile(b.deps).demarrer(lot(5), 'lot-1')
    expect(b.departs.slice(1).map((d, n) => d - b.departs[n]!)).toEqual([300, 200, 200, 300])
  })

  it('reste à 200 ms si la source lève une exception', async () => {
    const b = banc({
      delaiSupplementaire: () => {
        throw new Error('x')
      },
    })
    await creerFile(b.deps).demarrer(lot(3), 'lot-1')
    expect(b.departs[1]! - b.departs[0]!).toBe(200)
  })

  it('n’impose aucun plafond par minute : seul l’intervalle minimal limite le débit', async () => {
    const b = banc({ delaiSupplementaire: () => 0 })
    await creerFile(b.deps).demarrer(lot(400), 'lot-1')
    expect(b.requetes).toHaveLength(400)
    expect(b.departs[399]! - b.departs[0]!).toBe(399 * 200)
  })
})

describe('cadence fixe (AC2)', () => {
  it('espace les débuts de requête de 200 ms quand tout répond vite', async () => {
    const b = banc();
    const file = creerFile(b.deps);
    await file.demarrer(lot(5), 'lot-1');
    expect(b.requetes).toHaveLength(5);
    for (let i = 1; i < b.departs.length; i++) {
      const ecart = b.departs[i]! - b.departs[i - 1]!;
      expect(ecart).toBeGreaterThanOrEqual(180);
      expect(ecart).toBeLessThanOrEqual(220);
    }
  });

  it('attend la réponse précédente quand elle dépasse 6 000 ms', async () => {
    const b = banc({}, () => OK, 9000);
    const file = creerFile(b.deps);
    await file.demarrer(lot(3), 'lot-1');
    expect(b.departs[1]! - b.departs[0]!).toBe(9000);
    expect(b.departs[2]! - b.departs[1]!).toBe(9000);
  });

  it('attend la confirmation (défausse) avant de partir', async () => {
    const b = banc();
    b.deps.confirmer = async (): Promise<'defausser'> => {
      b.horloge.t += 20_000;
      return 'defausser';
    };
    const file = creerFile(b.deps);
    await file.demarrer([lecture(1), defausse(2)], 'lot-1');
    expect(b.departs[1]! - b.departs[0]!).toBeGreaterThanOrEqual(20_000);
  });

  it('une action passée n’avance pas la date de cadence', async () => {
    const b = banc({ reverifier: (a) => (a.idCarte === 'Rare|Carte 2' ? 'passee' : 'ok') });
    const file = creerFile(b.deps);
    await file.demarrer(lot(3), 'lot-1');
    expect(b.requetes.map((a) => a.idCarte)).toEqual(['Rare|Carte 1', 'Rare|Carte 3']);
    expect(b.departs[1]! - b.departs[0]!).toBe(200);
  });

  it('une action arrêtée faute de jeton n’est pas comptée et la file s’arrête', async () => {
    const b = banc({}, (n) => (n === 2 ? arret(null, 'jeton-absent') : OK));
    const file = creerFile(b.deps);
    const etat = await file.demarrer(lot(4), 'lot-1');
    expect(b.requetes).toHaveLength(2);
    expect(etat.etat).toBe('arretee');
  });

  it('après un arrêt faute de jeton, l’écart se calcule depuis la dernière requête réellement émise', async () => {
    const b = banc({}, (n) => (n === 2 ? arret(null, 'jeton-absent') : OK));
    const file = creerFile(b.deps);
    await file.demarrer(lot(2), 'lot-1');
    await file.demarrer(lot(1), 'lot-2');
    expect(b.departs).toHaveLength(3);
    expect(b.departs[2]! - b.departs[0]!).toBe(200);
  });

  it('une requête dont le transport lève une exception compte pour la cadence', async () => {
    const b = banc();
    let appels = 0;
    b.deps.transport = async (action) => {
      b.departs.push(b.horloge.t);
      b.requetes.push(action);
      if (++appels === 1) throw new Error('boom');
      return OK;
    };
    const file = creerFile(b.deps);
    const etat = await file.demarrer(lot(2), 'lot-1');
    expect(etat.etat).toBe('arretee');
    await file.demarrer(lot(1), 'lot-2');
    expect(b.departs[1]! - b.departs[0]!).toBe(200);
  });

  it('n’utilise aucun aléa : deux exécutions identiques donnent les mêmes écarts', async () => {
    const a = banc();
    const c = banc();
    await creerFile(a.deps).demarrer(lot(4), 'lot-1');
    await creerFile(c.deps).demarrer(lot(4), 'lot-1');
    const ecarts = (d: number[]) => d.map((x, i) => (i === 0 ? 0 : x - d[i - 1]!));
    expect(ecarts(a.departs)).toEqual(ecarts(c.departs));
  });
});

describe('une seule exécution, une seule requête en vol (AC3)', () => {
  it('refuse un second demarrer tant qu’une exécution est en cours', async () => {
    const b = banc();
    const file = creerFile(b.deps);
    const premiere = file.demarrer(lot(2), 'lot-1');
    let refus: Promise<unknown> | undefined;
    expect(() => {
      refus = file.demarrer(lot(1), 'lot-2');
    }).not.toThrow();
    await expect(refus).rejects.toThrow();
    await premiere;
    await expect(file.demarrer(lot(1), 'lot-3')).resolves.toBeDefined();
  });

  it('n’a jamais deux requêtes en vol', async () => {
    const b = banc();
    let enVol = 0;
    let maxEnVol = 0;
    b.deps.transport = async () => {
      enVol++;
      maxEnVol = Math.max(maxEnVol, enVol);
      await Promise.resolve();
      enVol--;
      return OK;
    };
    await creerFile(b.deps).demarrer(lot(4), 'lot-1');
    expect(maxEnVol).toBe(1);
  });
});

describe('arrêts (AC4)', () => {
  it('s’arrête au 3e échec cumulé (non consécutif)', async () => {
    const reps = [echec(), OK, echec(), OK, echec(), OK];
    const b = banc({}, (n) => reps[n - 1]!);
    const etat = await creerFile(b.deps).demarrer(lot(6), 'lot-1');
    expect(b.requetes).toHaveLength(5);
    expect(etat.etat).toBe('arretee');
  });

  it('deux échecs ne suffisent pas', async () => {
    const reps = [echec(), echec(), OK, OK];
    const b = banc({}, (n) => reps[n - 1]!);
    const etat = await creerFile(b.deps).demarrer(lot(4), 'lot-1');
    expect(b.requetes).toHaveLength(4);
    expect(etat.etat).toBe('terminee');
  });

  it('les actions passées ne comptent pas comme échecs', async () => {
    const b = banc({ reverifier: (a) => (a.idCarte !== 'Rare|Carte 1' ? 'passee' : 'ok') });
    const etat = await creerFile(b.deps).demarrer(lot(6), 'lot-1');
    expect(etat.etat).toBe('terminee');
  });

  it.each([
    ['401', echec(401)],
    ['403', echec(403)],
    ['429', echec(429)],
    ['forme hors contrat', arret(200, 'forme hors contrat')],
    ['redirection', arret(302, 'redirection')],
    ['erreur réseau', arret(null, 'erreur réseau')],
    ['délai de 30 s', INCONNU],
  ])('s’arrête à la première occurrence : %s', async (_nom, resultat) => {
    const b = banc({}, (n) => (n === 2 ? resultat : OK));
    const etat = await creerFile(b.deps).demarrer(lot(5), 'lot-1');
    expect(b.requetes).toHaveLength(2);
    expect(etat.etat).toBe('arretee');
  });

  it('409 : arrête le lot pour une enchère ou une défausse, pas pour une étiquette', async () => {
    const e = (n: number): Action => ({ type: 'enchere', idCarte: `Rare|Carte ${n}`, idExemplaire: 'x', prix: 5 });
    for (const [fab, arrete] of [[e, true], [defausse, true], [pose, false]] as const) {
      const b = banc({}, (n) => (n === 1 ? echec(409) : OK));
      const etat = await creerFile(b.deps).demarrer(Array.from({ length: 4 }, (_, i) => fab(i + 1)), 'lot-409');
      expect(b.requetes).toHaveLength(arrete ? 1 : 4);
      expect(etat.etat).toBe(arrete ? 'arretee' : 'terminee');
    }
  });

  it('s’arrête quand l’écriture locale échoue (appliquer)', async () => {
    const b = banc({
      appliquer: () => {
        throw new Error('quota');
      },
    });
    const etat = await creerFile(b.deps).demarrer(lot(5), 'lot-1');
    expect(b.requetes).toHaveLength(1);
    expect(etat.etat).toBe('arretee');
  });

  it('s’arrête quand l’écriture du journal échoue', async () => {
    const b = banc();
    b.deps.journal.ouvrir = () => {
      throw new Error('quota');
    };
    const etat = await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(b.requetes).toHaveLength(0);
    expect(etat.etat).toBe('arretee');
  });

  it('s’arrête quand le transport lève une exception', async () => {
    const b = banc();
    b.deps.transport = () => Promise.reject(new Error('boom'));
    const etat = await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(etat.etat).toBe('arretee');
  });

  it('un résultat inconnu ne modifie pas l’état local', async () => {
    const b = banc({}, () => INCONNU);
    await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(b.appliquees).toHaveLength(0);
    expect(b.journal).toContain('completer:e1:inconnu');
  });

  it('applique l’état local seulement pour une réussite', async () => {
    const b = banc({}, (n) => (n === 2 ? echec() : OK));
    await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(b.appliquees).toHaveLength(2);
  });

  it('n’émet jamais de relance après un délai dépassé', async () => {
    const b = banc({}, () => INCONNU);
    await creerFile(b.deps).demarrer([lecture(1)], 'lot-1');
    expect(b.requetes).toHaveLength(1);
  });

  it('arrêt manuel : aucune requête après arreter(), même pendant l’attente', async () => {
    const b = banc();
    let liberer: () => void = () => {};
    // L’attente d’échéance ne se termine jamais d’elle-même.
    b.horloge.attendreJusqua = () => new Promise<void>((r) => (liberer = r));
    const file = creerFile(b.deps);
    const fin = file.demarrer(lot(3), 'lot-1');
    // La 1re requête part sans attente (aucun départ précédent) ; la 2e attend.
    await new Promise((r) => setTimeout(r, 10));
    expect(b.requetes).toHaveLength(1);
    const avant = Date.now();
    file.arreter();
    const etat = await fin;
    expect(Date.now() - avant).toBeLessThan(100);
    liberer();
    expect(b.requetes).toHaveLength(1);
    expect(etat.etat).toBe('arretee');
  });

  it('arrêt manuel pendant une requête en vol : la réponse est journalisée, aucune suivante', async () => {
    const b = banc();
    let repondre: (r: ResultatAction) => void = () => {};
    b.deps.transport = (action) => {
      b.requetes.push(action);
      return new Promise<ResultatAction>((r) => (repondre = r));
    };
    const file = creerFile(b.deps);
    const fin = file.demarrer(lot(3), 'lot-1');
    await new Promise((r) => setTimeout(r, 10));
    file.arreter();
    repondre(OK);
    const etat = await fin;
    expect(b.requetes).toHaveLength(1);
    expect(b.journal).toContain('completer:e1:reussie');
    expect(etat.etat).toBe('arretee');
  });
});

describe('ajout en fin de file (AC5)', () => {
  it('traite les actions ajoutées pendant l’exécution', async () => {
    const b = banc();
    const transportInitial = b.deps.transport;
    let ajoute = false;
    b.deps.transport = async (a) => {
      if (!ajoute) {
        ajoute = true;
        expect(file.ajouter([lecture(9)])).toBe(true);
      }
      return transportInitial(a);
    };
    const file = creerFile(b.deps);
    const etat = await file.demarrer(lot(2), 'lot-1');
    expect(b.requetes.map((a) => a.idCarte)).toEqual(['Rare|Carte 1', 'Rare|Carte 2', 'Rare|Carte 9']);
    expect(etat.total).toBe(3);
    expect(etat.traitees).toBe(3);
  });

  it('refuse un ajout quand aucune exécution n’est en cours', () => {
    const file = creerFile(banc().deps);
    expect(file.ajouter([lecture(1)])).toBe(false);
  });
});

describe('revérification (AC6)', () => {
  it('appelle reverifier avant chaque requête', async () => {
    const b = banc();
    const vues: string[] = [];
    b.deps.reverifier = (a) => {
      vues.push(`${a.idCarte}@${b.requetes.length}`);
      return 'ok';
    };
    await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(vues).toEqual([
      'Rare|Carte 1@0', 'Rare|Carte 1@0',
      'Rare|Carte 2@1', 'Rare|Carte 2@1',
      'Rare|Carte 3@2', 'Rare|Carte 3@2',
    ]);
  });

  it('action passée : aucune requête, journal « passée »', async () => {
    const b = banc({ reverifier: () => 'passee' });
    const etat = await creerFile(b.deps).demarrer([pose(1)], 'lot-1');
    expect(b.requetes).toHaveLength(0);
    expect(b.journal).toEqual(['ouvrir:e1:pose-etiquette', 'passer:e1']);
    expect(etat.etat).toBe('terminee');
    expect(etat.traitees).toBe(1);
  });
});

describe('revérification tardive', () => {
  it('carte modifiée pendant l’attente de cadence : aucune requête pour elle', async () => {
    const b = banc();
    let modifiee = false;
    b.deps.reverifier = () => (modifiee ? 'passee' : 'ok');
    const attendre = b.horloge.attendreJusqua;
    b.horloge.attendreJusqua = (e) => {
      modifiee = true;
      return attendre(e);
    };
    const etat = await creerFile(b.deps).demarrer(lot(2), 'lot-1');
    expect(b.requetes.map((a) => a.idCarte)).toEqual(['Rare|Carte 1']);
    expect(b.journal.slice(-2)).toEqual(['ouvrir:e2:lecture', 'passer:e2']);
    expect(etat.etat).toBe('terminee');
  });

  it('carte modifiée pendant la confirmation de défausse : aucune requête', async () => {
    const b = banc();
    let modifiee = false;
    b.deps.reverifier = () => (modifiee ? 'passee' : 'ok');
    b.deps.confirmer = () => {
      modifiee = true;
      return 'defausser';
    };
    await creerFile(b.deps).demarrer([defausse(1)], 'lot-1');
    expect(b.requetes).toHaveLength(0);
    expect(b.journal).toEqual(['ouvrir:e1:defausse', 'passer:e1']);
  });
});

describe('robustesse', () => {
  it('reboucle tant que l’échéance n’est pas atteinte', async () => {
    const b = banc();
    b.horloge.attendreJusqua = (e) => {
      b.horloge.t = Math.min(e, b.horloge.t + 1000);
      return Promise.resolve();
    };
    await creerFile(b.deps).demarrer(lot(2), 'lot-1');
    expect(b.departs[1]! - b.departs[0]!).toBeGreaterThanOrEqual(200);
  });

  it('ajouter renvoie false après arreter()', async () => {
    const b = banc();
    const t = b.deps.transport;
    let resultat: boolean | undefined;
    b.deps.transport = async (a) => {
      file.arreter();
      resultat = file.ajouter([lecture(9)]);
      return t(a);
    };
    const file = creerFile(b.deps);
    await file.demarrer(lot(2), 'lot-1');
    expect(resultat).toBe(false);
  });

  it('une exception de reverifier n’est pas classée comme échec d’écriture', async () => {
    const b = banc({
      reverifier: () => {
        throw new Error('lecture');
      },
    });
    const etat = await creerFile(b.deps).demarrer(lot(2), 'lot-1');
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('verification');
    expect(b.requetes).toHaveLength(0);
  });

  it('une exception de confirmer n’est pas classée comme échec d’écriture', async () => {
    const b = banc({
      confirmer: () => {
        throw new Error('fenêtre');
      },
    });
    const etat = await creerFile(b.deps).demarrer([defausse(1)], 'lot-1');
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('confirmation-indisponible');
    expect(b.requetes).toHaveLength(0);
  });

  it('s’arrête quand journal.completer échoue', async () => {
    const b = banc();
    b.deps.journal.completer = () => {
      throw new Error('quota');
    };
    const etat = await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(b.requetes).toHaveLength(1);
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('ecriture');
  });

  it('s’arrête quand journal.passer échoue', async () => {
    const b = banc({ reverifier: () => 'passee' });
    b.deps.journal.passer = () => {
      throw new Error('quota');
    };
    const etat = await creerFile(b.deps).demarrer(lot(3), 'lot-1');
    expect(b.requetes).toHaveLength(0);
    expect(etat.etat).toBe('arretee');
    expect(etat.raison).toBe('ecriture');
  });
});

describe('défausse (AC7)', () => {
  it('appelle confirmer avant toute requête de défausse', async () => {
    const b = banc();
    const ordre: string[] = [];
    b.deps.confirmer = () => {
      ordre.push('confirmer');
      return 'defausser';
    };
    const t = b.deps.transport;
    b.deps.transport = (a) => {
      ordre.push('transport');
      return t(a);
    };
    await creerFile(b.deps).demarrer([defausse(1)], 'lot-1');
    expect(ordre).toEqual(['confirmer', 'transport']);
  });

  it('ne demande pas de confirmation pour une autre action', async () => {
    let appels = 0;
    const b = banc({
      confirmer: () => {
        appels++;
        return 'defausser';
      },
    });
    await creerFile(b.deps).demarrer([lecture(1), pose(2)], 'lot-1');
    expect(appels).toBe(0);
  });

  it('« passer » : aucune requête, journal « passée »', async () => {
    const b = banc({ confirmer: () => 'passer' });
    const etat = await creerFile(b.deps).demarrer([defausse(1), lecture(2)], 'lot-1');
    expect(b.requetes.map((a) => a.type)).toEqual(['lecture']);
    expect(b.journal[0]).toBe('ouvrir:e1:defausse');
    expect(b.journal[1]).toBe('passer:e1');
    expect(etat.etat).toBe('terminee');
  });

  it('« arreter » : fin comme un arrêt manuel, rien d’autre n’est émis', async () => {
    const b = banc({ confirmer: () => 'arreter' });
    const etat = await creerFile(b.deps).demarrer([lecture(1), defausse(2), lecture(3)], 'lot-1');
    expect(b.requetes.map((a) => a.idCarte)).toEqual(['Rare|Carte 1']);
    expect(etat.etat).toBe('arretee');
  });
});

describe('état observable', () => {
  it('compte les actions traitées et se termine', async () => {
    const b = banc();
    const file = creerFile(b.deps);
    expect(file.etat()).toBeNull();
    const etat = await file.demarrer(lot(3), 'lot-7');
    expect(etat).toMatchObject({ idLot: 'lot-7', etat: 'terminee', traitees: 3, total: 3 });
    expect(file.etat()).toEqual(etat);
  });

  it('notifie les abonnés à chaque changement', async () => {
    const b = banc();
    const file = creerFile(b.deps);
    const vus: number[] = [];
    file.abonner((e) => vus.push(e.traitees));
    await file.demarrer(lot(2), 'lot-1');
    expect(vus).toEqual([0, 1, 2, 2]);
  });
});

describe('cadence unique pour toutes les actions (2026-11-12)', () => {
  it('espace de 0,2 s une pose, une enchère et une défausse', async () => {
    const e = (n: number): Action => ({ type: 'enchere', idCarte: `Rare|Carte ${n}`, idExemplaire: 'x', prix: 5 })
    const b = banc({ delaiSupplementaire: () => 0, confirmer: () => 'defausser' })
    await creerFile(b.deps).demarrer([pose(1), e(2), defausse(3)], 'lot-1')
    expect(b.departs.slice(1).map((d, n) => d - b.departs[n]!)).toEqual([200, 200])
  })
})

describe('parallélisme (poses et retraits, décision du 2026-11-12)', () => {
  it('lance jusqu’à 3 poses en vol en même temps, départs espacés d’au moins 200 ms', async () => {
    let enVol = 0;
    let maxVol = 0;
    const b = banc({ concurrence: 3 });
    const echeances: number[] = [];
    const attendre = b.horloge.attendreJusqua;
    b.horloge.attendreJusqua = (e: number) => {
      echeances.push(e);
      return attendre(e);
    };
    const base = b.deps.transport;
    b.deps.transport = async (a) => {
      enVol++;
      maxVol = Math.max(maxVol, enVol);
      await Promise.resolve();
      await Promise.resolve();
      const r = await base(a);
      enVol--;
      return r;
    };
    const f = creerFile(b.deps);
    await f.demarrer([pose(1), pose(2), pose(3), pose(4), pose(5)], 'lot');
    expect(b.requetes).toHaveLength(5);
    expect(maxVol).toBeLessThanOrEqual(3);
    const tries = [...echeances].sort((x, y) => x - y);
    for (let i = 1; i < tries.length; i++) expect(tries[i]! - tries[i - 1]!).toBeGreaterThanOrEqual(200);
  });

  it('sans concurrence, une seule requête en vol', async () => {
    let enVol = 0;
    let maxVol = 0;
    const b = banc();
    const base = b.deps.transport;
    b.deps.transport = async (a) => {
      enVol++;
      maxVol = Math.max(maxVol, enVol);
      await Promise.resolve();
      const r = await base(a);
      enVol--;
      return r;
    };
    await creerFile(b.deps).demarrer([pose(1), pose(2), pose(3)], 'lot');
    expect(maxVol).toBe(1);
  });

  it('une défausse n’est jamais lancée en parallèle', async () => {
    let enVol = 0;
    let maxVol = 0;
    const b = banc({ concurrence: 3 });
    const base = b.deps.transport;
    b.deps.transport = async (a) => {
      enVol++;
      maxVol = Math.max(maxVol, enVol);
      await Promise.resolve();
      const r = await base(a);
      enVol--;
      return r;
    };
    await creerFile(b.deps).demarrer([defausse(1), defausse(2), defausse(3)], 'lot');
    expect(maxVol).toBe(1);
  });

  it('un arrêt (429) dans un lot parallèle arrête la file : aucune requête ensuite', async () => {
    const b = banc({ concurrence: 3 }, (n) => (n === 2 ? arret(429) : OK));
    const f = creerFile(b.deps);
    await f.demarrer([pose(1), pose(2), pose(3), pose(4), pose(5), pose(6)], 'lot').catch(() => undefined);
    expect(b.requetes.length).toBeLessThanOrEqual(3);
    expect(f.etat()?.etat).not.toBe('terminee');
  });

  it('garde 200 ms entre deux envois réels même si le journal retarde un départ', async () => {
    const b = banc({ concurrence: 3 });
    const ouvrir = b.deps.journal.ouvrir;
    let n = 0;
    b.deps.journal.ouvrir = async (a) => {
      if (n++ === 0) b.horloge.t += 300;
      return ouvrir(a);
    };
    const envois: number[] = [];
    const base = b.deps.transport;
    b.deps.transport = (a) => {
      envois.push(b.horloge.now());
      return base(a);
    };
    await creerFile(b.deps).demarrer([pose(1), pose(2), pose(3)], 'lot');
    expect(envois).toHaveLength(3);
    for (let i = 1; i < envois.length; i++) expect(envois[i]! - envois[i - 1]!).toBeGreaterThanOrEqual(200);
  });

  it('avec une horloge réelle et une réponse lente, plusieurs requêtes sont en vol en même temps (3 au plus)', async () => {
    let enVol = 0;
    let maxVol = 0;
    const b = banc({
      concurrence: 3,
      horloge: {
        now: () => Date.now(),
        attendreJusqua: (e: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, e - Date.now()))),
      },
      delaiSupplementaire: () => 0,
    });
    b.deps.transport = async () => {
      enVol++;
      maxVol = Math.max(maxVol, enVol);
      await new Promise((r) => setTimeout(r, 450));
      enVol--;
      return OK;
    };
    await creerFile(b.deps).demarrer([pose(1), pose(2), pose(3), pose(4)], 'lot');
    expect(maxVol).toBeGreaterThan(1);
    expect(maxVol).toBeLessThanOrEqual(3);
  });

  it.each([401, 403, 429])('un %i en parallèle : un ordre dont le journal s’écrit encore n’est pas envoyé', async (code) => {
    const b = banc({ concurrence: 3 }, (n) => (n === 1 ? arret(code) : OK));
    const ouvrir = b.deps.journal.ouvrir;
    b.deps.journal.ouvrir = async (a) => {
      await new Promise((r) => setTimeout(r, 5));
      return ouvrir(a);
    };
    const f = creerFile(b.deps);
    await f.demarrer([pose(1), pose(2), pose(3)], 'lot');
    expect(b.requetes).toHaveLength(1);
    expect(f.etat()).toMatchObject({ etat: 'arretee', raison: 'resultat' });
    expect(b.journal.some((j) => j.startsWith('passer:'))).toBe(true);
  });

  it('3 échecs en parallèle arrêtent la file avec la raison « echecs »', async () => {
    const b = banc({ concurrence: 3 }, () => echec());
    const f = creerFile(b.deps);
    await f.demarrer([pose(1), pose(2), pose(3), pose(4), pose(5), pose(6)], 'lot');
    expect(b.requetes).toHaveLength(3);
    expect(f.etat()).toMatchObject({ etat: 'arretee', raison: 'echecs' });
  });
});
