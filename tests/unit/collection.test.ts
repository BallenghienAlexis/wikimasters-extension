import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  VERSION_ECHANGE,
  VERSION_SCHEMA,
  ajouterIdSite,
  analyserImport,
  analyserStockage,
  appliquerEdition,
  collectionVide,
  definirIdsSite,
  excedent,
  filtrerCartes,
  fusionnerImport,
  idsSiteDe,
  migrerCollection,
  resumer,
  retirerCarte,
  retirerIdSite,
  terminerEnchere,
  type Collection,
  type Carte,
  type Filtres,
} from '../../src/lib/collection';

const carte = (surcharge: Partial<Carte> = {}): Carte => ({
  id: 'c1',
  titre: 'Écureuil fictif',
  rarete: null,
  quantite: 1,
  url: null,
  favori: false,
  idsSite: null,
  description: '',
  ami: null,
  valeurMarchande: null,
  decidePar: null,
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ...surcharge,
});

const FILTRES: Filtres = { recherche: '', statut: 'tous', doublonsSeulement: false };

const erreurDe = (cartes: unknown[]): string => {
  const r = analyserImport({ version: 1, cartes });
  if (r.ok) throw new Error('Import accepté à tort');
  return r.erreur;
};

describe('analyserImport', () => {
  it('accepte un fichier minimal et pose les valeurs par défaut', () => {
    const r = analyserImport({ version: 1, cartes: [{ id: 'a', titre: 'A' }] });
    expect(r).toEqual({ ok: true, cartes: [{ id: 'a', titre: 'A', rarete: null, quantite: 1, url: null }] });
  });

  it.each([
    ['pas un objet', 'texte'],
    ['un tableau', []],
    ['une version inconnue', { version: 2, cartes: [] }],
    ['sans liste de cartes', { version: 1 }],
  ])('refuse %s', (_nom, brut) => {
    expect(analyserImport(brut).ok).toBe(false);
  });

  it('refuse un identifiant manquant ou en double', () => {
    expect(erreurDe([{ titre: 'A' }])).toContain('identifiant manquant');
    expect(erreurDe([{ id: 'a', titre: 'A' }, { id: 'a', titre: 'B' }])).toContain('identifiant en double');
  });

  it('refuse une quantité, un statut ou un prix invalides', () => {
    expect(erreurDe([{ id: 'a', titre: 'A', quantite: 0 }])).toContain('quantité');
    expect(erreurDe([{ id: 'a', titre: 'A', quantite: 1.5 }])).toContain('quantité');
    expect(erreurDe([{ id: 'a', titre: 'A', statut: 'brûler' }])).toContain('statut');
    expect(erreurDe([{ id: 'a', titre: 'A', prixCible: -1 }])).toContain('prix');
  });

  it.each(['javascript:alert(1)', 'http://exemple.test/a', 'pas une url'])('refuse le lien %s', (url) => {
    expect(erreurDe([{ id: 'a', titre: 'A', url }])).toContain('https://');
  });

  it('accepte un lien https', () => {
    expect(analyserImport({ version: 1, cartes: [{ id: 'a', titre: 'A', url: 'https://exemple.test/a' }] }).ok).toBe(true);
  });
});

describe('fusionnerImport', () => {
  it('initialise une nouvelle carte à trier', () => {
    const c = fusionnerImport(collectionVide(), [{ id: 'a', titre: 'A', rarete: null, quantite: 1, url: null }]);
    expect(c.cartes[0]).toMatchObject({ statut: 'a-trier', prixCible: null, note: '' });
  });

  it('met à jour les données du jeu sans perdre l’édition locale', () => {
    const avant = { version: 2 as const, cartes: [carte({ statut: 'vendre', prixCible: 50, note: 'à garder en tête' })] };
    const apres = fusionnerImport(avant, [{ id: 'c1', titre: 'Nouveau titre', rarete: null, quantite: 3, url: null }]);
    expect(apres.cartes[0]).toMatchObject({ titre: 'Nouveau titre', quantite: 3, statut: 'vendre', prixCible: 50, note: 'à garder en tête' });
  });

  it('applique l’édition fournie par le fichier', () => {
    const avant = { version: 2 as const, cartes: [carte({ statut: 'vendre' })] };
    const apres = fusionnerImport(avant, [{ id: 'c1', titre: 'T', rarete: null, quantite: 1, url: null, statut: 'garder' }]);
    expect(apres.cartes[0]?.statut).toBe('garder');
  });

  it('garde les cartes absentes du fichier', () => {
    const avant = { version: 2 as const, cartes: [carte()] };
    const apres = fusionnerImport(avant, [{ id: 'c2', titre: 'B', rarete: null, quantite: 1, url: null }]);
    expect(apres.cartes.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('appliquerEdition', () => {
  it('ne modifie que la carte visée, sans muter l’original', () => {
    const avant = { version: 2 as const, cartes: [carte(), carte({ id: 'c2' })] };
    const apres = appliquerEdition(avant, 'c2', { statut: 'echanger' });
    expect(apres.cartes[1]?.statut).toBe('echanger');
    expect(apres.cartes[0]?.statut).toBe('a-trier');
    expect(avant.cartes[1]?.statut).toBe('a-trier');
  });
});

describe('filtrerCartes', () => {
  const cartes = [
    carte({ id: 'a', titre: 'Écureuil', quantite: 2, statut: 'vendre' }),
    carte({ id: 'b', titre: 'Loutre', statut: 'garder' }),
  ];
  const ids = (f: Partial<Filtres>): string[] => filtrerCartes(cartes, { ...FILTRES, ...f }).map((c) => c.id);

  it('cherche sans tenir compte de la casse ni des accents', () => {
    expect(ids({ recherche: 'ecur' })).toEqual(['a']);
  });
  it('filtre par statut', () => {
    expect(ids({ statut: 'garder' })).toEqual(['b']);
  });
  it('repère les doublons', () => {
    expect(ids({ doublonsSeulement: true })).toEqual(['a']);
  });
  it('rend tout sans filtre', () => {
    expect(ids({})).toEqual(['a', 'b']);
  });
});

describe('doublons et résumé', () => {
  it('excedent compte les exemplaires au-delà du premier', () => {
    expect(excedent({ quantite: 1 })).toBe(0);
    expect(excedent({ quantite: 4 })).toBe(3);
  });

  it('resumer additionne exemplaires, doublons et statuts', () => {
    const r = resumer([carte({ quantite: 3, statut: 'vendre' }), carte({ id: 'c2', statut: 'vendre' }), carte({ id: 'c3' })]);
    expect(r.exemplaires).toBe(5);
    expect(r.doublons).toBe(2);
    expect(r.parStatut).toEqual({ 'a-trier': 1, garder: 0, echanger: 0, vendre: 2, 'en-vente': 0, defausser: 0 });
  });
});

describe('terminerEnchere', () => {
  const base = (quantite: number): Collection => ({
    version: 2,
    cartes: [{ id: 'C|x', titre: 'x', rarete: 'C', description: '', quantite, url: null, favori: false, idsSite: null, statut: 'en-vente', prixCible: 5, note: 'n', ami: 'a', valeurMarchande: 20, decidePar: 'moi' }],
  });
  it('retire la carte quand il n’y a qu’un exemplaire', () => {
    expect(terminerEnchere(base(1), 'C|x').cartes).toHaveLength(0);
  });
  it('garde l’édition des exemplaires restants et les remet à trier', () => {
    const [carte] = terminerEnchere(base(2), 'C|x').cartes;
    expect(carte).toMatchObject({ quantite: 1, statut: 'a-trier', note: 'n', ami: 'a', valeurMarchande: 20, decidePar: null });
  });
  it('ne perd pas l’URL d’un import lors d’une lecture du site', () => {
    const avecUrl = { ...base(1), cartes: [{ ...base(1).cartes[0]!, url: 'https://exemple.test/c' }] };
    const lue = { id: 'C|x', titre: 'x', rarete: 'C', quantite: 1, url: null };
    expect(fusionnerImport(avecUrl, [lue]).cartes[0]?.url).toBe('https://exemple.test/c');
  });
});

const col = (...cartes: Carte[]): Collection => ({ version: 2, cartes });
const v1 = (cartes: Record<string, unknown>[]) => ({ version: 1, cartes });
const CARTE_V1 = {
  id: 'Rare|Loutre fictive',
  titre: 'Loutre fictive',
  rarete: 'Rare',
  description: 'Une loutre',
  quantite: 3,
  url: 'https://exemple.test/loutre',
  favori: true,
  statut: 'vendre',
  prixCible: 40,
  note: 'note',
  ami: 'Ami fictif',
  valeurMarchande: 55,
  decidePar: 'moi',
};
const LONG = 'x'.repeat(201);

describe('schéma v2 : versions', () => {
  it('SC-019 : VERSION_SCHEMA vaut 2 et VERSION_ECHANGE vaut 1', () => {
    expect(VERSION_SCHEMA).toBe(2);
    expect(VERSION_ECHANGE).toBe(1);
    expect(collectionVide()).toEqual({ version: 2, cartes: [] });
  });
});

describe('migrerCollection', () => {
  it('SC-019 : conserve chaque champ existant et met idsSite à null', () => {
    const r = migrerCollection(v1([CARTE_V1]));
    expect(r.version).toBe(2);
    expect(r.cartes).toHaveLength(1);
    for (const [cle, valeur] of Object.entries(CARTE_V1)) {
      expect((r.cartes[0] as unknown as Record<string, unknown>)[cle], cle).toEqual(valeur);
    }
    expect(r.cartes[0]?.idsSite).toBeNull();
  });

  it('SC-019 : est idempotente (une v2 reste inchangée)', () => {
    const v2 = col(carte({ idsSite: ['a', 'b'] }), carte({ id: 'c2' }));
    expect(migrerCollection(v2)).toEqual(v2);
    const une = migrerCollection(v1([CARTE_V1]));
    expect(migrerCollection(une)).toEqual(une);
  });
});

describe('analyserStockage', () => {
  it('SC-019 : accepte une v1 (migrée) et une v2', () => {
    const a = analyserStockage(v1([CARTE_V1]));
    expect(a.ok).toBe(true);
    if (a.ok) {
      expect(a.collection.version).toBe(2);
      expect(a.collection.cartes[0]?.idsSite).toBeNull();
      expect(a.collection.cartes[0]?.prixCible).toBe(40);
    }
    const b = analyserStockage(col(carte({ idsSite: ['x1'] })));
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.collection.cartes[0]?.idsSite).toEqual(['x1']);
  });

  it('SC-019 : refuse une version inconnue ou un contenu illisible sans lever d’exception', () => {
    expect(analyserStockage({ version: 3, cartes: [] }).ok).toBe(false);
    expect(analyserStockage('texte').ok).toBe(false);
    expect(analyserStockage({ version: 2 }).ok).toBe(false);
    expect(analyserStockage({ version: 2, cartes: [{ titre: 'sans id' }] }).ok).toBe(false);
  });

  it('SC-024 : refuse un idsSite vide, en double ou invalide en v2', () => {
    for (const idsSite of [[], ['a', 'a'], [''], [LONG], [3]]) {
      expect(analyserStockage({ version: 2, cartes: [{ ...CARTE_V1, idsSite }] }).ok, JSON.stringify(idsSite)).toBe(false);
    }
  });
});

describe('analyserImport : fichier d’échange', () => {
  it('SC-019 : refuse version 2 et ignore tout idsSite présent', () => {
    expect(analyserImport({ version: 2, cartes: [] }).ok).toBe(false);
    const r = analyserImport({ version: 1, cartes: [{ id: 'a', titre: 'A', idsSite: ['s1'] }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cartes[0]).not.toHaveProperty('idsSite');
  });
});

describe('fusionnerImport et idsSite', () => {
  it('SC-019 : conserve idsSite de la carte existante', () => {
    const r = analyserImport({ version: 1, cartes: [{ id: 'c1', titre: 'Nouveau titre', quantite: 2 }] });
    if (!r.ok) throw new Error('import refusé');
    const f = fusionnerImport(col(carte({ idsSite: ['s1', 's2'] })), r.cartes);
    expect(f.cartes[0]?.idsSite).toEqual(['s1', 's2']);
    expect(f.cartes[0]?.titre).toBe('Nouveau titre');
  });

  it('SC-019 : une carte nouvelle reçoit idsSite null, la version reste 2', () => {
    const f = fusionnerImport(collectionVide(), [{ id: 'n', titre: 'N', rarete: null, quantite: 1, url: null }]);
    expect(f.version).toBe(2);
    expect(f.cartes[0]?.idsSite).toBeNull();
  });

  it('SC-024 : appliquerEdition, terminerEnchere et retirerCarte conservent idsSite', () => {
    const c = col(carte({ quantite: 2, idsSite: ['s1', 's2'] }), carte({ id: 'c2', idsSite: ['z'] }));
    expect(appliquerEdition(c, 'c1', { note: 'x' }).cartes[0]?.idsSite).toEqual(['s1', 's2']);
    expect(terminerEnchere(c, 'c1').cartes[0]?.idsSite).toEqual(['s1', 's2']);
    expect(retirerCarte(c, 'c1').cartes[0]?.idsSite).toEqual(['z']);
  });
});

describe('accesseurs idsSite', () => {
  it('SC-024 : idsSiteDe renvoie les identifiants ou null', () => {
    expect(idsSiteDe(carte())).toBeNull();
    expect(idsSiteDe(carte({ idsSite: ['a'] }))).toEqual(['a']);
  });

  it('SC-024 : definirIdsSite pose la liste, un tableau vide donne null', () => {
    const c = col(carte(), carte({ id: 'c2' }));
    const d = definirIdsSite(c, 'c1', ['a', 'b']);
    expect(d.cartes[0]?.idsSite).toEqual(['a', 'b']);
    expect(d.cartes[1]?.idsSite).toBeNull();
    expect(definirIdsSite(d, 'c1', []).cartes[0]?.idsSite).toBeNull();
  });

  it('SC-024 : definirIdsSite rejette doublon et identifiant invalide (collection inchangée)', () => {
    const c = col(carte({ idsSite: ['a'] }));
    expect(definirIdsSite(c, 'c1', ['b', 'b'])).toEqual(c);
    expect(definirIdsSite(c, 'c1', [''])).toEqual(c);
    expect(definirIdsSite(c, 'c1', [LONG])).toEqual(c);
  });

  it('SC-024 : identifiant de 200 caractères accepté', () => {
    const id = 'x'.repeat(200);
    expect(definirIdsSite(col(carte()), 'c1', [id]).cartes[0]?.idsSite).toEqual([id]);
  });

  it('SC-024 : ajouterIdSite ajoute, refuse doublon et invalide', () => {
    const a = ajouterIdSite(col(carte()), 'c1', 'a');
    expect(a.cartes[0]?.idsSite).toEqual(['a']);
    const b = ajouterIdSite(a, 'c1', 'b');
    expect(b.cartes[0]?.idsSite).toEqual(['a', 'b']);
    expect(ajouterIdSite(b, 'c1', 'a')).toEqual(b);
    expect(ajouterIdSite(b, 'c1', '')).toEqual(b);
    expect(ajouterIdSite(b, 'c1', LONG)).toEqual(b);
  });

  it('SC-024 : retirerIdSite retire un identifiant et remet null au dernier', () => {
    const un = retirerIdSite(col(carte({ idsSite: ['a', 'b'] })), 'c1', 'a');
    expect(un.cartes[0]?.idsSite).toEqual(['b']);
    expect(retirerIdSite(un, 'c1', 'b').cartes[0]?.idsSite).toBeNull();
    expect(retirerIdSite(un, 'c1', 'inconnu')).toEqual(un);
  });

  it('SC-024 : une carte inconnue laisse la collection inchangée', () => {
    const c = col(carte({ idsSite: ['a'] }));
    expect(definirIdsSite(c, 'absente', ['z'])).toEqual(c);
    expect(ajouterIdSite(c, 'absente', 'z')).toEqual(c);
    expect(retirerIdSite(c, 'absente', 'a')).toEqual(c);
  });
});

describe('stockage : migration à la lecture (faux chrome.storage)', () => {
  const installer = (contenu: Record<string, unknown>) => {
    const set = vi.fn(async (_: Record<string, unknown>) => undefined);
    const get = vi.fn(async (cle: string) => (cle in contenu ? { [cle]: contenu[cle] } : {}));
    vi.stubGlobal('chrome', { storage: { local: { get, set }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } });
    return { set };
  };
  afterEach(() => vi.unstubAllGlobals());

  it('SC-019 : migre une v1 stockée en v2 à la lecture, sans perte', async () => {
    installer({ collection: v1([CARTE_V1]) });
    const { chargerCollection } = await import('../../src/lib/stockage');
    const c = await chargerCollection();
    expect(c.version).toBe(2);
    expect(c.cartes[0]).toMatchObject({ ...CARTE_V1, idsSite: null });
  });

  it('SC-019 : relit une v2 avec ses idsSite', async () => {
    installer({ collection: col(carte({ idsSite: ['s1'] })) });
    const { chargerCollection } = await import('../../src/lib/stockage');
    expect((await chargerCollection()).cartes[0]?.idsSite).toEqual(['s1']);
  });

  it('SC-019 : une collection absente donne une collection vide v2', async () => {
    installer({});
    const { chargerCollection } = await import('../../src/lib/stockage');
    expect(await chargerCollection()).toEqual({ version: 2, cartes: [] });
  });

  it('SC-019 : une donnée illisible lève une erreur et n’est jamais écrasée', async () => {
    const { set } = installer({ collection: { version: 3, cartes: [{ id: 'x' }] } });
    const { chargerCollection, fusionnerDansStockage } = await import('../../src/lib/stockage');
    await expect(chargerCollection()).rejects.toThrow(/illisibles/);
    await expect(fusionnerDansStockage([{ id: 'n', titre: 'N', rarete: null, quantite: 1, url: null }])).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
  });
});
