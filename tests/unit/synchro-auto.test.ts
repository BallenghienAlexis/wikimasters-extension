import { afterEach, describe, expect, it, vi } from 'vitest';
import { VERSION_SCHEMA, type Carte, type Collection } from '../../src/lib/collection';
import type { Horloge } from '../../src/lib/file';
import { etatInitial, type EtatOrdonnanceur, type ReponseApi } from '../../src/lib/ordonnanceur';
import { preferencesParDefaut } from '../../src/lib/tri';
import {
  DELAI_SYNCHRO_MS,
  creerSynchroAuto,
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
  statut: 'garder',
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  ...surcharge,
});

interface Banc {
  deps: DependancesSynchroAuto;
  horloge: Horloge & { t: number };
  chemins: string[];
  stockage: { actif: boolean; derniere: number | null; collection: Collection; etat: EtatOrdonnanceur | null; bail: number | null };
}

function banc(options: { actif?: boolean; derniere?: number | null; cartes?: Carte[]; reponse?: (c: string, n: number) => ReponseApi } = {}): Banc {
  const horloge = horlogeSimulee();
  const chemins: string[] = [];
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
    chargerPreferences: async () => preferencesParDefaut(),
    journal: () => undefined,
  };
  return { deps, horloge, chemins, stockage };
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
    expect(b.chemins[0]).toBe('/api/my-collection/stats?sort=rarity');
    expect(b.chemins[1]).toBe('/api/my-collection?sort=rarity&page=0&stats=0');
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
    const b = banc({ cartes: [carteLocale(1, { statut: 'garder' })] });
    const enregistrer = b.deps.enregistrerCollection;
    // Le joueur passe la carte 1 en « vendre » pendant que la synchro tourne.
    let modifie = false;
    b.deps.transport = ((transport) => async (chemin: string) => {
      if (!modifie && chemin.includes('page=0')) {
        modifie = true;
        b.stockage.collection = { version: VERSION_SCHEMA, cartes: [carteLocale(1, { statut: 'vendre', note: 'ma note', decidePar: 'moi' })] };
      }
      return transport(chemin);
    })(b.deps.transport);
    b.deps.enregistrerCollection = enregistrer;
    await creerSynchroAuto(b.deps).declencher();
    const carte = b.stockage.collection.cartes.find((c) => c.id === 'R|Carte 1');
    expect(carte?.statut).toBe('vendre');
    expect(carte?.note).toBe('ma note');
    expect(carte?.decidePar).toBe('moi');
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
      synchro: { declencher, arreter },
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
    demarrerSynchroAuto({ synchro: o.synchro, visibilite: v.source, ecouterArret: o.ecouterArret });
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
    demarrerSynchroAuto({ synchro: o.synchro, visibilite: v.source, ecouterArret: o.ecouterArret });
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
    demarrerSynchroAuto({ synchro: o.synchro, visibilite: visibilite(true).source, ecouterArret: o.ecouterArret });
    o.declencherArret();
    expect(o.arreter).toHaveBeenCalledTimes(1);
  });

  it('la fonction d’arrêt renvoyée supprime minuteur et écouteurs', () => {
    vi.useFakeTimers();
    const v = visibilite(true);
    const o = options();
    const stop = demarrerSynchroAuto({ synchro: o.synchro, visibilite: v.source, ecouterArret: o.ecouterArret });
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
