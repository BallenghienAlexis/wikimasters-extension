import { afterEach, describe, expect, it, vi } from 'vitest';
import { VERSION_SCHEMA, type Carte, type Collection } from '../../src/lib/collection';
import type { Horloge } from '../../src/lib/file';
import { etatInitial, type EtatOrdonnanceur, type ReponseApi } from '../../src/lib/ordonnanceur';
import type { StatutSynchro } from '../../src/lib/stockage';
import { fusionner } from '../../src/content/synchroAuto';
import {
  DELAI_SYNCHRO_MS,
  DELAI_RELANCE_MS,
  creerSynchroAuto,
  ecrireEvenementJournal,
  type EvenementSynchro,
  demarrerSynchroAuto,
  type DependancesSynchroAuto,
} from '../../src/content/synchroAuto';

// Toutes les données sont fictives (G7) ; aucun contact avec le vrai site (G1).
const T0 = 10_000_000_000;
const MIN = 60_000;

function horlogeSimulee(): Horloge & { t: number } {
  const h = {
    t: T0,
    now: () => h.t,
    attendreJusqua: (echeance: number) => {
      if (echeance > h.t) h.t = echeance;
      return Promise.resolve();
    },
  };
  return h;
}

const exemplaire = (n: number) => ({
  id: `ex-${n}`,
  card_id: `card-${n}`,
  obtained_at: new Date(Date.UTC(2026, 0, 1) - n * 60_000).toISOString(),
  count: 1,
  starred: false,
  tags: [],
  card: { rarity: 'R', wikipedia_title: `Carte ${n}` },
});

const siteFictif = (nCartes: number) => (chemin: string): ReponseApi => {
  if (chemin.startsWith('/api/my-collection/stats')) return { statut: 200, json: { total: nCartes, totalUnique: nCartes, tagOptions: [] } };
  const page = /\/api\/my-collection\?.*page=(\d+)/.exec(chemin);
  if (page) {
    const p = Number(page[1]);
    return { statut: 200, json: { collection: Array.from({ length: nCartes }, (_, i) => exemplaire(i + 1)).slice(p * 50, (p + 1) * 50) } };
  }
  if (/\/sales\?scope=summary$/.test(chemin)) return { statut: 200, json: { summary: { R: { average: 120 } }, isPro: false } };
  return { statut: 404, json: null };
};

const carteLocale = (n: number, surcharge: Partial<Carte> = {}): Carte => ({
  id: `R|Carte ${n}`,
  titre: `Carte ${n}`,
  rarete: 'R',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: [`ex-${n}`],
  etiquettesSite: [],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...surcharge,
});

interface Banc {
  deps: DependancesSynchroAuto;
  horloge: Horloge & { t: number };
  chemins: string[];
  statuts: StatutSynchro[];
  evenements: EvenementSynchro[];
  stockage: { actif: boolean; derniere: number | null; collection: Collection; etat: EtatOrdonnanceur | null; bail: number | null };
}

function banc(options: { actif?: boolean; derniere?: number | null; cartes?: Carte[]; reponse?: (c: string, n: number) => ReponseApi } = {}): Banc {
  const horloge = horlogeSimulee();
  const chemins: string[] = [];
  const statuts: StatutSynchro[] = [];
  const evenements: EvenementSynchro[] = [];
  const reponse = options.reponse ?? siteFictif(2);
  const stockage: Banc['stockage'] = {
    actif: options.actif ?? true,
    derniere: options.derniere ?? null,
    collection: { version: VERSION_SCHEMA, cartes: options.cartes ?? [] },
    etat: null,
    bail: null,
  };
  const deps: DependancesSynchroAuto = {
    horloge,
    transport: async (chemin) => {
      chemins.push(chemin);
      return reponse(chemin, chemins.length);
    },
    actif: async () => stockage.actif,
    derniereSynchro: async () => stockage.derniere,
    noterDerniereSynchro: async (t) => {
      stockage.derniere = t;
    },
    chargerCollection: async () => structuredClone(stockage.collection),
    enregistrerCollection: async (c) => {
      stockage.collection = structuredClone(c);
    },
    chargerEtat: async () => (stockage.etat === null ? null : structuredClone(stockage.etat)),
    enregistrerEtat: async (e) => {
      stockage.etat = structuredClone(e);
    },
    bail: {
      lire: async () => stockage.bail,
      ecrire: async (v) => {
        stockage.bail = v;
      },
    },
    noterStatut: async (statut) => {
      statuts.push(structuredClone(statut));
    },
    journaliser: async (e) => {
      evenements.push(structuredClone(e));
    },
    journal: () => undefined,
  };
  return { deps, horloge, chemins, statuts, evenements, stockage };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('T-205 AC3 / G6 : option désactivée = 0 requête', () => {
  it('ne contacte pas le site et n’écrit rien', async () => {
    const b = banc({ actif: false });
    const resultat = await creerSynchroAuto(b.deps).declencher();
    expect(resultat).toBeNull();
    expect(b.chemins).toEqual([]);
    expect(b.stockage.bail).toBeNull();
    expect(b.stockage.etat).toBeNull();
    expect(b.stockage.derniere).toBeNull();
  });
});

describe('T-205 AC1 : déclenchement', () => {
  it('première synchro : lit stats, pages et prix, fusionne les cartes et note la date', async () => {
    const b = banc();
    const resultat = await creerSynchroAuto(b.deps).declencher();
    expect(resultat?.issue).toBe('termine');
    expect(b.chemins[0]).toBe('/api/my-collection/stats?sort=added');
    expect(b.chemins[1]).toBe('/api/my-collection?sort=added&page=0&stats=0');
    expect(b.chemins.some((c) => c.endsWith('/sales?scope=summary'))).toBe(true);
    expect(b.stockage.collection.cartes.map((c) => c.id).sort()).toEqual(['R|Carte 1', 'R|Carte 2']);
    expect(b.stockage.etat?.derniereComplete).not.toBeNull();
    expect(b.stockage.derniere).not.toBeNull();
    expect(b.stockage.bail).toBeNull();
  });

  it('ne part pas si la dernière synchro a moins de 30 min', async () => {
    const b = banc({ derniere: T0 - 29 * MIN });
    expect(await creerSynchroAuto(b.deps).declencher()).toBeNull();
    expect(b.chemins).toEqual([]);
  });

  it('part si la dernière synchro a plus de 30 min', async () => {
    const b = banc({ derniere: T0 - 31 * MIN });
    expect((await creerSynchroAuto(b.deps).declencher())?.issue).toBe('termine');
    expect(b.chemins.length).toBeGreaterThan(0);
  });

  it('un second déclenchement dans la même page, avant 30 min, ne refait rien', async () => {
    const b = banc();
    const synchro = creerSynchroAuto(b.deps);
    await synchro.declencher();
    const n = b.chemins.length;
    b.stockage.derniere = null; // même si l’écriture a été perdue
    expect(await synchro.declencher()).toBeNull();
    expect(b.chemins).toHaveLength(n);
  });

  it('un arrêt du site (403) n’est pas retenté et ne note pas de synchro terminée', async () => {
    const b = banc({ reponse: () => ({ statut: 403, json: null }) });
    const synchro = creerSynchroAuto(b.deps);
    const resultat = await synchro.declencher();
    expect(resultat?.issue).toBe('arret');
    expect(resultat?.codeHttp).toBe(403);
    expect(b.chemins).toHaveLength(1);
    expect(b.stockage.derniere).toBeNull();
    expect(b.stockage.etat?.arretJusqua).toBe(b.horloge.t + 30 * MIN);
    await synchro.declencher();
    expect(b.chemins).toHaveLength(1);
  });

  it('une lecture de stockage illisible ne déclenche aucune requête', async () => {
    const b = banc();
    b.deps.chargerEtat = async () => {
      throw new Error('illisible');
    };
    expect(await creerSynchroAuto(b.deps).declencher()).toBeNull();
    expect(b.chemins).toEqual([]);
  });
});

describe('T-205 : édition locale préservée', () => {
  it('une modification faite pendant la synchro n’est pas écrasée', async () => {
    const b = banc({ cartes: [carteLocale(1, { })] });
    const enregistrer = b.deps.enregistrerCollection;
    // Le joueur écrit une note sur la carte 1 pendant que la synchro tourne.
    let modifie = false;
    b.deps.transport = ((transport) => async (chemin: string) => {
      if (!modifie && chemin.includes('page=0')) {
        modifie = true;
        b.stockage.collection = { version: VERSION_SCHEMA, cartes: [carteLocale(1, { note: 'ma note', })] };
      }
      return transport(chemin);
    })(b.deps.transport);
    b.deps.enregistrerCollection = enregistrer;
    await creerSynchroAuto(b.deps).declencher();
    const carte = b.stockage.collection.cartes.find((c) => c.id === 'R|Carte 1');
    expect(carte?.note).toBe('ma note');
    expect(carte?.valeurMarchande).toBe(120);
  });

  it('ne remplace pas une valeur saisie à la main pendant la synchro', async () => {
    const b = banc({ cartes: [carteLocale(1)] });
    let saisi = false;
    b.deps.transport = ((transport) => async (chemin: string) => {
      if (!saisi && chemin.includes('page=0')) {
        saisi = true;
        b.stockage.collection = { version: VERSION_SCHEMA, cartes: [carteLocale(1, { valeurMarchande: 999 })] };
      }
      return transport(chemin);
    })(b.deps.transport);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.stockage.collection.cartes.find((c) => c.id === 'R|Carte 1')?.valeurMarchande).toBe(999);
  });
});

describe('T-205 AC4 : arrêt immédiat', () => {
  it('arreter() interrompt avant la requête suivante', async () => {
    const b = banc();
    const synchro = creerSynchroAuto(b.deps);
    b.deps.transport = ((transport) => async (chemin: string) => {
      const r = await transport(chemin);
      synchro.arreter();
      return r;
    })(b.deps.transport);
    const resultat = await synchro.declencher();
    expect(resultat?.issue).toBe('arret');
    expect(resultat?.raison).toBe('manuel');
    expect(b.chemins).toHaveLength(1);
    expect(b.stockage.bail).toBeNull();
    expect(b.stockage.derniere).toBeNull();
  });

  it('un arrêt demandé hors synchro n’empêche pas la suivante', async () => {
    const b = banc();
    const synchro = creerSynchroAuto(b.deps);
    synchro.arreter();
    expect((await synchro.declencher())?.issue).toBe('termine');
  });
});

describe('relance explicite du joueur', () => {
  it('relance après un 403, malgré la pause de 30 min et les 30 min depuis le dernier essai', async () => {
    const b = banc({ reponse: (c, n) => (n === 2 ? { statut: 403, json: null } : siteFictif(2)(c)) });
    const synchro = creerSynchroAuto(b.deps);
    expect((await synchro.declencher())?.issue).toBe('arret');
    expect(await synchro.declencher()).toBeNull();
    const avant = b.chemins.length;
    b.deps.transport = async (c) => {
      b.chemins.push(c);
      return siteFictif(2)(c);
    };
    expect((await synchro.relancer())?.issue).toBe('termine');
    expect(b.chemins.length).toBeGreaterThan(avant);
    expect(b.stockage.etat?.arretJusqua).toBeNull();
    expect(b.evenements.map((e) => e.titre)).toContain('Synchronisation automatique : relance demandée');
  });

  it('relance après un arrêt manuel, sans attendre 30 min', async () => {
    const b = banc({ derniere: T0 - MIN });
    const synchro = creerSynchroAuto(b.deps);
    expect(await synchro.declencher()).toBeNull();
    expect((await synchro.relancer())?.issue).toBe('termine');
  });

  it('option désactivée : aucune requête, même relancée', async () => {
    const b = banc({ actif: false });
    expect(await creerSynchroAuto(b.deps).relancer()).toBeNull();
    expect(b.chemins).toEqual([]);
  });

  it('bail tenu par un autre onglet : pas de requête', async () => {
    const b = banc();
    b.stockage.bail = T0 + MIN;
    expect((await creerSynchroAuto(b.deps).relancer())?.issue).toBe('bail-occupe');
    expect(b.chemins).toEqual([]);
  });

  it('un nouveau refus pendant la relance arrête tout de suite et rouvre la pause', async () => {
    const b = banc({ reponse: () => ({ statut: 429, json: null }) });
    b.stockage.etat = { ...etatInitial(), arretJusqua: T0 + 10 * MIN };
    const r = await creerSynchroAuto(b.deps).relancer();
    expect(r?.issue).toBe('arret');
    expect(b.chemins).toHaveLength(1);
    expect(b.stockage.etat?.arretJusqua).toBe(b.horloge.t + 30 * MIN);
  });

  it('deux relances à moins d’une minute : la seconde est ignorée', async () => {
    const b = banc({ reponse: () => ({ statut: 403, json: null }) });
    const synchro = creerSynchroAuto(b.deps);
    expect((await synchro.relancer())?.issue).toBe('arret');
    expect(await synchro.relancer()).toBeNull();
    expect(b.chemins).toHaveLength(1);
    b.horloge.t += DELAI_RELANCE_MS;
    expect((await synchro.relancer())?.issue).toBe('arret');
    expect(b.chemins).toHaveLength(2);
  });

  it.each([
    ['429', { etat: 'arret', raison: 'code-http', codeHttp: 429 }],
    ['401', { etat: 'arret', raison: 'code-http', codeHttp: 401 }],
    ['échecs', { etat: 'arret', raison: 'echecs', codeHttp: null }],
  ] as const)('après %s : relancer() ne fait aucune requête (pause gardée)', async (_nom, partiel) => {
    const b = banc();
    b.deps.chargerStatut = async () => ({ version: 1, page: null, pages: null, le: T0, ajoutees: 0, etiquettes: 0, prix: 0, ...partiel });
    b.stockage.etat = { ...etatInitial(), arretJusqua: T0 + 10 * MIN };
    expect(await creerSynchroAuto(b.deps).relancer()).toBeNull();
    expect(b.chemins).toEqual([]);
  });

  it('après un 403 ou un arrêt manuel : la relance passe la pause', async () => {
    for (const partiel of [{ raison: 'code-http', codeHttp: 403 }, { raison: 'manuel', codeHttp: null }] as const) {
      const b = banc();
      b.deps.chargerStatut = async () => ({ version: 1, etat: 'arret', page: null, pages: null, le: T0, ajoutees: 0, etiquettes: 0, prix: 0, ...partiel });
      b.stockage.etat = { ...etatInitial(), arretJusqua: T0 + 10 * MIN };
      expect((await creerSynchroAuto(b.deps).relancer())?.issue).toBe('termine');
    }
  });

  it('la limite d’une relance par minute est commune aux onglets (stockage)', async () => {
    const b = banc();
    let stockee: number | null = b.horloge.t - 10_000;
    b.deps.derniereRelance = { lire: async () => stockee, ecrire: async (t) => { stockee = t; } };
    expect(await creerSynchroAuto(b.deps).relancer()).toBeNull();
    expect(b.chemins).toEqual([]);
    stockee = b.horloge.t - DELAI_RELANCE_MS;
    expect((await creerSynchroAuto(b.deps).relancer())?.issue).toBe('termine');
    expect(stockee).toBeGreaterThanOrEqual(T0);
  });

  it('relancer() pendant une synchro en cours ne démarre rien de plus', async () => {
    const b = banc();
    const synchro = creerSynchroAuto(b.deps);
    const premiere = synchro.declencher();
    expect(await synchro.relancer()).toBeNull();
    await premiere;
  });
});

describe('T-205 AC1 : déclencheurs de page', () => {
  function visibilite(depart: boolean) {
    const etat = { visible: depart, rappel: null as null | (() => void) };
    return {
      etat,
      source: {
        visible: () => etat.visible,
        ecouter: (rappel: () => void) => {
          etat.rappel = rappel;
          return () => {
            etat.rappel = null;
          };
        },
      },
      changer: (v: boolean) => {
        etat.visible = v;
        etat.rappel?.();
      },
    };
  }
  const options = (declencher = vi.fn(async () => null), arreter = vi.fn()) => {
    let arret: (() => void) | null = null;
    return {
      synchro: { declencher, arreter, relancer: vi.fn(async () => null) },
      declencherArret: () => arret?.(),
      ecouterArret: (rappel: () => void) => {
        arret = rappel;
        return () => {
          arret = null;
        };
      },
      declencher,
      arreter,
    };
  };

  it('déclenche au chargement puis toutes les 30 min tant que l’onglet est visible', () => {
    vi.useFakeTimers();
    const v = visibilite(true);
    const o = options();
    demarrerSynchroAuto({ synchro: o.synchro, visibilite: v.source, ecouterArret: o.ecouterArret, ecouterRelance: () => () => undefined });
    expect(o.declencher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(DELAI_SYNCHRO_MS);
    expect(o.declencher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(DELAI_SYNCHRO_MS);
    expect(o.declencher).toHaveBeenCalledTimes(3);
  });

  it('ne planifie rien tant que l’onglet est masqué, et reprend à son retour', () => {
    vi.useFakeTimers();
    const v = visibilite(false);
    const o = options();
    demarrerSynchroAuto({ synchro: o.synchro, visibilite: v.source, ecouterArret: o.ecouterArret, ecouterRelance: () => () => undefined });
    vi.advanceTimersByTime(3 * DELAI_SYNCHRO_MS);
    expect(o.declencher).toHaveBeenCalledTimes(1); // chargement de la page seulement
    v.changer(true);
    expect(o.declencher).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(DELAI_SYNCHRO_MS);
    expect(o.declencher).toHaveBeenCalledTimes(3);
    v.changer(false);
    vi.advanceTimersByTime(3 * DELAI_SYNCHRO_MS);
    expect(o.declencher).toHaveBeenCalledTimes(3);
  });

  it('la demande d’arrêt de l’interface appelle arreter()', () => {
    vi.useFakeTimers();
    const o = options();
    demarrerSynchroAuto({ synchro: o.synchro, visibilite: visibilite(true).source, ecouterArret: o.ecouterArret, ecouterRelance: () => () => undefined });
    o.declencherArret();
    expect(o.arreter).toHaveBeenCalledTimes(1);
  });

  it('la demande de relance de l’interface appelle relancer()', () => {
    const o = options();
    let relance: (() => void) | null = null;
    const stop = demarrerSynchroAuto({
      synchro: o.synchro,
      visibilite: visibilite(true).source,
      ecouterArret: o.ecouterArret,
      ecouterRelance: (rappel) => {
        relance = rappel;
        return () => {
          relance = null;
        };
      },
    });
    (relance as unknown as () => void)();
    expect(o.synchro.relancer).toHaveBeenCalledTimes(1);
    stop();
    expect(relance).toBeNull();
  });

  it('la fonction d’arrêt renvoyée supprime minuteur et écouteurs', () => {
    vi.useFakeTimers();
    const v = visibilite(true);
    const o = options();
    const stop = demarrerSynchroAuto({ synchro: o.synchro, visibilite: v.source, ecouterArret: o.ecouterArret, ecouterRelance: () => () => undefined });
    stop();
    vi.advanceTimersByTime(3 * DELAI_SYNCHRO_MS);
    expect(o.declencher).toHaveBeenCalledTimes(1);
    expect(v.etat.rappel).toBeNull();
  });
});

describe('T-205 : état initial', () => {
  it('l’état de départ est celui de l’ordonnanceur', async () => {
    const b = banc();
    await creerSynchroAuto(b.deps).declencher();
    expect(b.stockage.etat?.version).toBe(etatInitial().version);
  });
});

describe('T-206 : statut détaillé pour l’interface', () => {
  it('désactivée : aucun statut écrit', async () => {
    const b = banc({ actif: false });
    await creerSynchroAuto(b.deps).declencher();
    expect(b.statuts).toEqual([]);
  });

  it('écrit « en cours » avec la page lue et le nombre de pages, puis « terminée » avec les comptes', async () => {
    const b = banc({ reponse: siteFictif(120) });
    await creerSynchroAuto(b.deps).declencher();
    const enCours = b.statuts.filter((s) => s.etat === 'en-cours');
    expect(enCours[0]?.page).toBeNull();
    const pages = enCours.map((s) => s.page).filter((p) => p !== null);
    expect(pages).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(Math.max(...(pages as number[]))).toBeLessThanOrEqual(3);
    expect(enCours.some((s) => s.pages === 3)).toBe(true);
    const dernier = b.statuts.at(-1) as StatutSynchro;
    expect(dernier.etat).toBe('termine');
    expect(dernier.raison).toBeNull();
    expect(dernier.ajoutees).toBe(120);
    expect(dernier.prix).toBeGreaterThan(0);
    expect(dernier.le).toBeGreaterThanOrEqual(T0);
  });

  it('compte les étiquettes distinctes lues sur le site', async () => {
    const reponse = (chemin: string, n: number): ReponseApi => {
      const r = siteFictif(2)(chemin);
      if (/page=0/.test(chemin)) {
        const j = r.json as { collection: Array<{ tags: unknown[] }> };
        j.collection[0]!.tags = [{ id: 't1', name: 'Statut · Garder' }];
        j.collection[1]!.tags = [{ id: 't1', name: 'Statut · Garder' }, { id: 't2', name: '#Espace' }];
      }
      void n;
      return r;
    };
    const b = banc({ reponse });
    await creerSynchroAuto(b.deps).declencher();
    expect((b.statuts.at(-1) as StatutSynchro).etiquettes).toBe(2);
  });

  it('un 403 écrit « arrêt » avec le code et la raison', async () => {
    const b = banc({ reponse: () => ({ statut: 403, json: null }) });
    await creerSynchroAuto(b.deps).declencher();
    const dernier = b.statuts.at(-1) as StatutSynchro;
    expect(dernier.etat).toBe('arret');
    expect(dernier.raison).toBe('code-http');
    expect(dernier.codeHttp).toBe(403);
  });

  it('un arrêt demandé écrit la raison « manuel »', async () => {
    const b = banc({ reponse: siteFictif(120) });
    const synchro = creerSynchroAuto(b.deps);
    const transport = b.deps.transport;
    b.deps.transport = async (chemin) => {
      synchro.arreter();
      return transport(chemin);
    };
    await synchro.declencher();
    const dernier = b.statuts.at(-1) as StatutSynchro;
    expect(dernier.etat).toBe('arret');
    expect(dernier.raison).toBe('manuel');
    expect(dernier.codeHttp).toBeNull();
  });

  it('pause après arrêt (repos) : le statut précédent est conservé', async () => {
    const b = banc();
    b.stockage.etat = { ...etatInitial(), arretJusqua: T0 + 10 * MIN };
    await creerSynchroAuto(b.deps).declencher();
    expect(b.statuts).toEqual([]);
  });

  it('une erreur d’écriture du statut n’interrompt pas la synchro', async () => {
    const b = banc();
    b.deps.noterStatut = async () => {
      throw new Error('stockage indisponible');
    };
    const resultat = await creerSynchroAuto(b.deps).declencher();
    expect(resultat?.issue).toBe('termine');
    expect(b.stockage.derniere).not.toBeNull();
  });
});

describe('T-206 D-03 : événements dans le journal', () => {
  it('désactivée ou en pause : rien n’est journalisé', async () => {
    const b = banc({ actif: false });
    await creerSynchroAuto(b.deps).declencher();
    expect(b.evenements).toEqual([]);
    const c = banc();
    c.stockage.etat = { ...etatInitial(), arretJusqua: T0 + 10 * MIN };
    await creerSynchroAuto(c.deps).declencher();
    expect(c.evenements).toEqual([]);
  });

  it('début puis fin, avec des libellés fixes', async () => {
    const b = banc();
    await creerSynchroAuto(b.deps).declencher();
    expect(b.evenements.map((e) => [e.titre, e.resultat, e.parametre, e.codeHttp])).toEqual([
      ['Synchronisation automatique : début', 'reussie', null, null],
      ['Synchronisation automatique : fin', 'reussie', null, null],
    ]);
  });

  it.each([401, 403, 429])('un %i du site est journalisé avec son code', async (code) => {
    const b = banc({ reponse: () => ({ statut: code, json: null }) });
    await creerSynchroAuto(b.deps).declencher();
    expect(b.evenements.at(-1)).toEqual({ titre: 'Synchronisation automatique : arrêt', resultat: 'interrompue', parametre: 'le site a refusé', codeHttp: code });
  });

  it('3 échecs : cause « 3 échecs »', async () => {
    const b = banc({ reponse: () => ({ statut: 500, json: null }) });
    await creerSynchroAuto(b.deps).declencher();
    expect(b.evenements.at(-1)).toMatchObject({ titre: 'Synchronisation automatique : arrêt', parametre: '3 échecs consécutifs', codeHttp: null });
  });

  it('arrêt manuel : cause « arrêt demandé »', async () => {
    const b = banc({ reponse: siteFictif(120) });
    const synchro = creerSynchroAuto(b.deps);
    const transport = b.deps.transport;
    b.deps.transport = async (chemin) => {
      synchro.arreter();
      return transport(chemin);
    };
    await synchro.declencher();
    expect(b.evenements.at(-1)).toMatchObject({ resultat: 'interrompue', parametre: 'arrêt demandé', codeHttp: null });
  });

  it('page courte avec moins d’exemplaires qu’annoncé : cause « lecture incomplète »', async () => {
    // Le site annonce 2 exemplaires mais n’en livre qu’un sur une page courte : la lecture est incomplète.
    const reponse = (chemin: string): ReponseApi => {
      if (chemin.startsWith('/api/my-collection/stats')) return { statut: 200, json: { total: 2, totalUnique: 2, tagOptions: [] } };
      if (/page=/.test(chemin)) return { statut: 200, json: { collection: [exemplaire(1)] } };
      return { statut: 404, json: null };
    };
    const b = banc({ reponse });
    await creerSynchroAuto(b.deps).declencher();
    expect(b.evenements.at(-1)).toMatchObject({ titre: 'Synchronisation automatique : arrêt', parametre: 'lecture incomplète' });
  });

  it('une erreur d’écriture du journal n’interrompt pas la synchro', async () => {
    const b = banc();
    b.deps.journaliser = async () => {
      throw new Error('stockage indisponible');
    };
    expect((await creerSynchroAuto(b.deps).declencher())?.issue).toBe('termine');
  });

  it('aucun événement ne contient de corps de réponse, d’identifiant ni de jeton', async () => {
    const b = banc({ reponse: (c, n) => (n === 1 ? { statut: 403, json: { token: 'secret', session: 'abc' } } : siteFictif(2)(c)) });
    await creerSynchroAuto(b.deps).declencher();
    expect(JSON.stringify(b.evenements)).not.toMatch(/secret|abc|token|session/i);
  });
});

describe('T-206 D-03 : écriture dans le journal existant', () => {
  const installer = () => {
    const donnees = new Map<string, unknown>();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: async (cle: string) => (donnees.has(cle) ? { [cle]: structuredClone(donnees.get(cle)) } : {}),
          set: async (o: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(o)) donnees.set(k, structuredClone(v));
          },
        },
      },
    };
    return donnees;
  };
  afterEach(() => {
    delete (globalThis as { chrome?: unknown }).chrome;
  });

  it('ajoute une entrée valide, à la suite des entrées existantes, sans identifiant de carte', async () => {
    const donnees = installer();
    await ecrireEvenementJournal({ titre: 'Synchronisation automatique : début', resultat: 'reussie', parametre: null, codeHttp: null }, () => new Date('2026-11-09T16:00:00.000Z'));
    await ecrireEvenementJournal({ titre: 'Synchronisation automatique : arrêt', resultat: 'interrompue', parametre: 'le site a refusé', codeHttp: 403 }, () => new Date('2026-11-09T16:01:00.000Z'));
    const { entrees, version } = donnees.get('journal') as { version: number; entrees: Array<Record<string, unknown>> };
    expect(version).toBe(2);
    expect(entrees).toHaveLength(2);
    expect(entrees[1]).toMatchObject({ type: 'lecture', idCarte: '', titre: 'Synchronisation automatique : arrêt', parametre: 'le site a refusé', resultat: 'interrompue', codeHttp: 403, idLot: 'synchro-auto' });
    expect(entrees[0]).toMatchObject({ resultat: 'reussie', codeHttp: null });
  });
});

describe('relevé d’affluence du marché', () => {
  const ROUTE = '/api/marketplace?status=active';
  const annonces = { items: [{ created_at: '2026-11-10T20:05:00Z', seller: 'x', amount: 5 }, { created_at: 'illisible' }] };
  const avecReleve = (b: Banc, depart: { le: number | null; echecs: number } = { le: null, echecs: 0 }): { courant: { le: number | null; echecs: number } } => {
    const suivi = { courant: depart };
    b.deps.releve = { lire: async () => suivi.courant, ecrire: async (r) => { suivi.courant = r; } };
    return suivi;
  };
  const reponseMarche = (chemin: string): ReponseApi =>
    chemin === ROUTE ? { statut: 200, json: annonces } : siteFictif(2)(chemin);

  it('sans route configurée : aucune requête vers le marché', async () => {
    const b = banc({ reponse: reponseMarche });
    b.deps.noterAffluence = async () => undefined;
    avecReleve(b);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.chemins).not.toContain(ROUTE);
  });

  it('avec une route : un GET, 0,2 s après la précédente, et seuls les horodatages sont notés', async () => {
    const b = banc({ reponse: reponseMarche });
    const notes: number[][] = [];
    b.deps.routeMarche = ROUTE;
    b.deps.noterAffluence = async (h) => {
      notes.push(h);
    };
    avecReleve(b);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.chemins.filter((c) => c === ROUTE)).toHaveLength(1);
    expect(b.chemins[b.chemins.length - 1]).toBe(ROUTE);
    expect(notes).toEqual([[Date.parse('2026-11-10T20:05:00Z')]]);
    const dernieres = b.stockage.etat?.requetes ?? [];
    expect(dernieres[dernieres.length - 1]! - dernieres[dernieres.length - 2]!).toBeGreaterThanOrEqual(200);
  });

  it('borne à 20 entrées l’historique des requêtes conservé après le relevé du marché', async () => {
    const b = banc({ reponse: reponseMarche });
    b.deps.routeMarche = ROUTE;
    b.deps.noterAffluence = async () => {};
    avecReleve(b);
    b.stockage.etat = { ...etatInitial(), requetes: Array.from({ length: 30 }, (_, i) => i + 1) };
    await creerSynchroAuto(b.deps).declencher();
    expect(b.chemins).toContain(ROUTE);
    expect((b.stockage.etat?.requetes ?? []).length).toBeLessThanOrEqual(20);
  });

  it('sur 403 : rien n’est noté et la reprise est repoussée de 30 min', async () => {
    const b = banc({ reponse: (c) => (c === ROUTE ? { statut: 403, json: null } : siteFictif(2)(c)) });
    const notes: number[][] = [];
    b.deps.routeMarche = ROUTE;
    b.deps.noterAffluence = async (h) => {
      notes.push(h);
    };
    avecReleve(b);
    await creerSynchroAuto(b.deps).declencher();
    expect(notes).toEqual([]);
    expect(b.stockage.etat?.arretJusqua).toBe(b.horloge.t + 30 * 60_000);
  });

  it('refuse une route hors du marché ou l’historique complet des ventes', async () => {
    for (const route of ['/api/my-collection', '/api/marketplace/cards/c1/sales', 'https://exemple.fr/api/marketplace']) {
      const b = banc({ reponse: reponseMarche });
      b.deps.routeMarche = route;
      b.deps.noterAffluence = async () => undefined;
      avecReleve(b);
      await creerSynchroAuto(b.deps).declencher();
      expect(b.chemins).not.toContain(route);
    }
  });

  it('pendant la pause après un arrêt : aucune requête vers le marché', async () => {
    const b = banc({ reponse: reponseMarche });
    b.stockage.etat = { ...etatInitial(), arretJusqua: T0 + 10 * 60_000 };
    b.deps.routeMarche = ROUTE;
    b.deps.noterAffluence = async () => undefined;
    avecReleve(b);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.chemins).toEqual([]);
  });

  it('bail tenu par un autre onglet : aucune requête vers le marché', async () => {
    const b = banc({ reponse: reponseMarche });
    b.stockage.bail = T0 + 60_000;
    b.deps.routeMarche = ROUTE;
    b.deps.noterAffluence = async () => undefined;
    avecReleve(b);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.chemins).toEqual([]);
  });

  it('relevé récent (autre onglet) : pas de nouvelle requête ; 3 échecs consécutifs : pause de 30 min', async () => {
    const recent = banc({ reponse: reponseMarche });
    recent.deps.routeMarche = ROUTE;
    recent.deps.noterAffluence = async () => undefined;
    avecReleve(recent, { le: T0 - 60_000, echecs: 0 });
    await creerSynchroAuto(recent.deps).declencher();
    expect(recent.chemins).not.toContain(ROUTE);

    const b = banc({ reponse: (c) => (c === ROUTE ? { statut: 500, json: null } : siteFictif(2)(c)) });
    b.deps.routeMarche = ROUTE;
    b.deps.noterAffluence = async () => undefined;
    const suivi = avecReleve(b, { le: null, echecs: 2 });
    await creerSynchroAuto(b.deps).declencher();
    expect(suivi.courant.echecs).toBe(0);
    expect(b.stockage.etat?.arretJusqua).toBe(b.horloge.t + 30 * 60_000);
  });
});

describe('fusionner : cartes retirées par la synchro', () => {
  const carte = (id: string, surcharge: Partial<Carte> = {}): Carte => ({
    id,
    titre: id,
    rarete: 'R',
    description: '',
    quantite: 1,
    url: null,
    favori: false,
    idsSite: [`ex-${id}`],
    etiquettesSite: [],
    prixCible: null,
    note: '',
    ami: null,
    valeurMarchande: null,
    ...surcharge,
  });
  const col = (cartes: Carte[]): Collection => ({ version: VERSION_SCHEMA, cartes });

  it('retire une carte présente au départ et absente du résultat, garde celle ajoutée pendant la synchro', () => {
    const a = carte('R|a');
    const b = carte('R|b');
    const ajoutee = carte('R|ajoutee');
    const depart = new Map([[a.id, a], [b.id, b]]);
    const r = fusionner(col([a, b, ajoutee]), col([a]), depart);
    expect(r.cartes.map((c) => c.id)).toEqual(['R|a', 'R|ajoutee']);
  });

  it('garde une carte retirée que le joueur a éditée pendant la synchro', () => {
    const b = carte('R|b');
    const depart = new Map([[b.id, b]]);
    const editee = { ...b, note: 'à voir' };
    const r = fusionner(col([editee]), col([]), depart);
    expect(r.cartes.map((c) => c.id)).toEqual(['R|b']);
  });
});
