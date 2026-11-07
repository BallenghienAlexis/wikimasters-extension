import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EtatExecution, ResultatAction } from '../../src/lib/actions';
import { creerExecution, creerHorloge, NOM_PORT, ORIGINE_SITE } from '../../src/app/execution';
import { ouvrirEntree, type Journal } from '../../src/lib/journal';

type Ecouteur<T> = (valeur: T) => void;

interface Sender {
  id?: string;
  url?: string;
  tab?: { id?: number };
}

function fauxPort(sender: Sender | undefined, name: string = NOM_PORT) {
  const surMessage: Ecouteur<unknown>[] = [];
  const surDeconnexion: Ecouteur<void>[] = [];
  const envoyes: unknown[] = [];
  const port = {
    sender,
    name,
    envoyes,
    deconnecte: false,
    postMessage: (m: unknown) => void envoyes.push(m),
    disconnect: () => {
      port.deconnecte = true;
    },
    onMessage: { addListener: (f: Ecouteur<unknown>) => void surMessage.push(f) },
    onDisconnect: { addListener: (f: Ecouteur<void>) => void surDeconnexion.push(f) },
    recevoir: (m: unknown) => surMessage.forEach((f) => f(m)),
    fermer: () => surDeconnexion.forEach((f) => f()),
  };
  return port;
}

const bon = (tab: number): Sender => ({ id: 'mon-extension', url: `${ORIGINE_SITE}/collection`, tab: { id: tab } });
const OK: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' };
const attendre = () => new Promise((r) => setTimeout(r, 0));

let connecter: (port: ReturnType<typeof fauxPort>) => void;
let verrouPris: boolean;
let stockage: { execution: EtatExecution | null; journal: Journal; signal: number | null };

function creer() {
  let ecouteur: Ecouteur<ReturnType<typeof fauxPort>> = () => {};
  const runtime = {
    id: 'mon-extension',
    onConnect: {
      addListener: (f: typeof ecouteur) => {
        ecouteur = f;
      },
      removeListener: vi.fn(),
    },
  };
  connecter = (p) => ecouteur(p);
  const verrous = {
    request: async (_nom: string, _opts: unknown, cb: (l: unknown) => Promise<unknown>) => {
      if (verrouPris) return cb(null);
      verrouPris = true;
      try {
        return await cb({});
      } finally {
        verrouPris = false;
      }
    },
  };
  const execution = creerExecution({
    runtime: runtime as never,
    verrous: verrous as never,
    chargerExecution: async () => stockage.execution,
    enregistrerExecution: async (e) => void (stockage.execution = e),
    chargerJournal: async () => stockage.journal,
    enregistrerJournal: async (j) => void (stockage.journal = j),
    enregistrerSignalSynchro: async (t) => void (stockage.signal = t),
    now: () => 42,
  });
  execution.ecouter();
  return execution;
}

beforeEach(() => {
  verrouPris = false;
  stockage = { execution: null, journal: [], signal: null };
});

describe('ports (AC2)', () => {
  it('compte 0, 1 puis 2 onglets', () => {
    const e = creer();
    expect(e.nbOngletsWikiMasters()).toBe(0);
    connecter(fauxPort(bon(1)));
    expect(e.nbOngletsWikiMasters()).toBe(1);
    connecter(fauxPort(bon(2)));
    expect(e.nbOngletsWikiMasters()).toBe(2);
  });

  it('deux ports du même onglet comptent pour un', () => {
    const e = creer();
    connecter(fauxPort(bon(1)));
    connecter(fauxPort(bon(1)));
    expect(e.nbOngletsWikiMasters()).toBe(1);
  });

  it('un port déconnecté n’est plus compté', () => {
    const e = creer();
    const p = fauxPort(bon(1));
    connecter(p);
    p.fermer();
    expect(e.nbOngletsWikiMasters()).toBe(0);
  });

  it.each([
    ['sender absent', undefined],
    ['id absent', { url: `${ORIGINE_SITE}/collection`, tab: { id: 1 } }],
    ['id étranger', { id: 'autre', url: `${ORIGINE_SITE}/collection`, tab: { id: 1 } }],
    ['url absente', { id: 'mon-extension', tab: { id: 1 } }],
    ['sous-domaine piégé', { id: 'mon-extension', url: 'https://www.wiki-masters.com.exemple.test/', tab: { id: 1 } }],
    ['http', { id: 'mon-extension', url: 'http://www.wiki-masters.com/collection', tab: { id: 1 } }],
    ['autre site', { id: 'mon-extension', url: 'https://exemple.test/', tab: { id: 1 } }],
    ['url illisible', { id: 'mon-extension', url: 'pas une url', tab: { id: 1 } }],
    ['onglet absent', { id: 'mon-extension', url: `${ORIGINE_SITE}/collection` }],
  ] as Array<[string, Sender | undefined]>)('refuse et ne compte pas : %s', (_n, sender) => {
    const e = creer();
    const p = fauxPort(sender);
    connecter(p);
    expect(p.deconnecte).toBe(true);
    expect(e.nbOngletsWikiMasters()).toBe(0);
  });

  it('refuse et ne compte pas : nom de port étranger', () => {
    const e = creer();
    const p = fauxPort(bon(1), 'autre-port');
    connecter(p);
    expect(p.deconnecte).toBe(true);
    expect(e.nbOngletsWikiMasters()).toBe(0);
  });
});

describe('raisons de désactivation (AC4)', () => {
  it('aucun onglet, plusieurs onglets, exécution en cours', async () => {
    const e = creer();
    expect(e.raisonsDesactivation()).toEqual(['aucun-onglet']);
    connecter(fauxPort(bon(1)));
    expect(e.raisonsDesactivation()).toEqual([]);
    connecter(fauxPort(bon(2)));
    expect(e.raisonsDesactivation()).toEqual(['plusieurs-onglets']);

    const e2 = creer();
    connecter(fauxPort(bon(1)));
    let fin: () => void = () => {};
    const run = e2.demarrer(() => new Promise<void>((r) => (fin = r)));
    await attendre();
    expect(e2.raisonsDesactivation()).toEqual(['execution-en-cours']);
    fin();
    await run;
    expect(e2.raisonsDesactivation()).toEqual([]);
  });
});

describe('transport (AC4)', () => {
  const ordre = { type: 'lecture', idCarte: 'Rare|C' } as const;

  it('envoie l’ordre au port et renvoie le résultat validé', async () => {
    const e = creer();
    const p = fauxPort(bon(1));
    connecter(p);
    const r = e.transport(ordre);
    expect(p.envoyes).toEqual([{ message: 'ordre', ordre }]);
    p.recevoir({ message: 'resultat', resultat: OK });
    await expect(r).resolves.toEqual(OK);
  });

  it('refuse sans onglet ou avec plusieurs onglets', async () => {
    const e = creer();
    await expect(e.transport(ordre)).rejects.toThrow();
    connecter(fauxPort(bon(1)));
    connecter(fauxPort(bon(2)));
    await expect(e.transport(ordre)).rejects.toThrow();
  });

  it('ignore un résultat invalide et un « bonjour »', async () => {
    const e = creer();
    const p = fauxPort(bon(1));
    connecter(p);
    const r = e.transport(ordre);
    p.recevoir({ message: 'bonjour' });
    p.recevoir({ message: 'resultat', resultat: { classe: 'x' } });
    p.recevoir({ message: 'resultat', resultat: OK });
    await expect(r).resolves.toEqual(OK);
  });

  it('déconnexion pendant l’attente du résultat → transport rejeté', async () => {
    const e = creer();
    const p = fauxPort(bon(1));
    connecter(p);
    const r = e.transport(ordre);
    p.fermer();
    await expect(r).rejects.toThrow();
  });
});

describe('exécution et verrou (AC3, AC5)', () => {
  it('refuse un second demarrer pendant une exécution', async () => {
    const e = creer();
    let fin: () => void = () => {};
    const run = e.demarrer(() => new Promise<void>((r) => (fin = r)));
    await attendre();
    await expect(e.demarrer(async () => undefined)).rejects.toThrow(/déjà en cours/);
    fin();
    await run;
    await expect(e.demarrer(async () => 'ok')).resolves.toBe('ok');
  });

  it('refuse si le verrou est tenu par un autre onglet', async () => {
    const e = creer();
    verrouPris = true;
    await expect(e.demarrer(async () => undefined)).rejects.toThrow();
  });

  it('déconnexion du port pendant l’exécution → signal d’interruption', async () => {
    const e = creer();
    const p = fauxPort(bon(1));
    connecter(p);
    let signal!: AbortSignal;
    let fin: () => void = () => {};
    const run = e.demarrer((s) => {
      signal = s;
      return new Promise<void>((r) => (fin = r));
    });
    await attendre();
    expect(signal.aborted).toBe(false);
    p.fermer();
    expect(signal.aborted).toBe(true);
    fin();
    await run;
  });

  it('déconnexion hors exécution : pas d’interruption', async () => {
    const e = creer();
    const p = fauxPort(bon(1));
    connecter(p);
    p.fermer();
    let signal!: AbortSignal;
    await e.demarrer(async (s) => void (signal = s));
    expect(signal.aborted).toBe(false);
  });

  it('signaler écrit un horodatage de reconnexion', async () => {
    const e = creer();
    await e.signaler();
    expect(stockage.signal).toBe(42);
  });

  it('à l’ouverture, « en cours » sans verrou → exécution arrêtée et journal clos « interrompue »', async () => {
    const e = creer();
    stockage.execution = { version: 1, idLot: 'lot-1', etat: 'en-cours', traitees: 1, total: 3 };
    stockage.journal = ouvrirEntree(
      [],
      { idCarte: 'Rare|C', titre: 'C', type: 'lecture', parametre: null, idLot: 'lot-1' },
      () => new Date('2026-11-08T10:00:00.000Z'),
    ).journal;
    await e.cloreInterrompues();
    expect(stockage.execution?.etat).toBe('arretee');
    expect(stockage.journal.map((x) => x.resultat)).toEqual(['interrompue']);
  });

  it('à l’ouverture avec verrou tenu : rien n’est clos', async () => {
    const e = creer();
    stockage.execution = { version: 1, idLot: 'lot-1', etat: 'en-cours', traitees: 1, total: 3 };
    verrouPris = true;
    await e.cloreInterrompues();
    expect(stockage.execution.etat).toBe('en-cours');
  });

  it('à l’ouverture sans état « en cours » : rien ne change', async () => {
    const e = creer();
    stockage.execution = { version: 1, idLot: 'lot-1', etat: 'terminee', traitees: 3, total: 3 };
    await e.cloreInterrompues();
    expect(stockage.execution.etat).toBe('terminee');
  });
});

describe('fin d’exécution (revue)', () => {
  it('rejette l’ordre en attente quand l’exécution se termine', async () => {
    const e = creer();
    connecter(fauxPort(bon(1)));
    let transport!: Promise<ResultatAction>;
    await e.demarrer(async () => {
      transport = e.transport({ type: 'lecture', idCarte: 'Rare|C' });
    });
    await expect(transport).rejects.toThrow(/terminée/);
  });
});

describe('horloge réelle (monotone)', () => {
  it('now suit performance.now, pas Date.now', () => {
    const perf = { t: 5 , now: () => perf.t };
    expect(creerHorloge(perf, vi.fn() as never).now()).toBe(5);
  });

  it('attendreJusqua respecte l’échéance absolue : pas de retour anticipé, délai fixe', async () => {
    const perf = { t: 0, now: () => perf.t };
    const delais: number[] = [];
    // Minuteur imprécis : le premier réveil arrive 10 ms trop tôt.
    const minuteur = ((rappel: () => void, delai: number) => {
      delais.push(delai);
      perf.t += delais.length === 1 ? delai - 10 : delai;
      rappel();
    }) as unknown as typeof setTimeout;
    const h = creerHorloge(perf, minuteur);
    await h.attendreJusqua(100);
    expect(perf.t).toBeGreaterThanOrEqual(100);
    expect(delais).toEqual([100, 10]);
  });

  it('échéance déjà passée : aucun minuteur', async () => {
    const perf = { t: 200, now: () => perf.t };
    const minuteur = vi.fn();
    await creerHorloge(perf, minuteur as never).attendreJusqua(100);
    expect(minuteur).not.toHaveBeenCalled();
  });
});
