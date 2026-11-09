import { describe, expect, it } from 'vitest';
import { FENETRE_MS, INTERVALLE_MS, MAX_PAR_FENETRE, type Horloge } from '../../src/lib/file';
import type { Carte, Collection } from '../../src/lib/collection';
import { VERSION_SCHEMA } from '../../src/lib/collection';
import {
  PAUSE_APRES_ARRET_MS,
  ancienneteMaxPrixMs,
  etatInitial,
  synchroniser,
  type DependancesSynchro,
  type EtatOrdonnanceur,
  type ReponseApi,
} from '../../src/lib/ordonnanceur';

// Toutes les données sont fictives : aucun contenu du compte réel.
const T0 = 10_000_000_000;
const JOUR = 86_400_000;

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

const exemplaire = (n: number, extra: { tags?: string[]; count?: number; starred?: boolean } = {}) => ({
  id: `ex-${n}`,
  card_id: `card-${n}`,
  count: extra.count ?? 1,
  starred: extra.starred ?? false,
  tags: (extra.tags ?? []).map((nom, i) => ({ id: `t${i}`, name: nom })),
  card: { rarity: 'R', wikipedia_title: `Carte ${n}` },
});

const idCarte = (n: number) => `R|Carte ${n}`;

const carteLocale = (n: number, surcharge: Partial<Carte> = {}): Carte => ({
  id: idCarte(n),
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

const collectionDe = (cartes: Carte[]): Collection => ({ version: VERSION_SCHEMA, cartes });

const statsJson = (total: number, unique = total, tags: Array<[string, number]> = []) => ({
  total,
  totalUnique: unique,
  tagOptions: tags.map(([nom, n], i) => ({ id: `tag-${i}`, name: nom, color: '#abcdef', cardCount: n })),
});

/** Site fictif : pages de 2 exemplaires, prix fixes par carte. */
function siteFictif(nCartes: number, options: { prix?: (n: number) => number | null; tags?: Array<[string, number]> } = {}) {
  const exemplaires = Array.from({ length: nCartes }, (_, i) => exemplaire(i + 1));
  return (chemin: string): ReponseApi => {
    if (chemin.startsWith('/api/my-collection/stats')) return { statut: 200, json: statsJson(nCartes, nCartes, options.tags) };
    const page = /\/api\/my-collection\?.*page=(\d+)/.exec(chemin);
    if (page) {
      const p = Number(page[1]);
      return { statut: 200, json: { collection: exemplaires.slice((p - 1) * 2, p * 2) } };
    }
    const vente = /\/api\/marketplace\/cards\/card-(\d+)\/sales\?scope=summary$/.exec(chemin);
    if (vente) {
      const valeur = (options.prix ?? ((n) => 100 + n))(Number(vente[1]));
      return { statut: 200, json: { summary: valeur === null ? {} : { R: { average: valeur } }, isPro: false } };
    }
    return { statut: 404, json: null };
  };
}

interface Banc {
  deps: DependancesSynchro;
  horloge: Horloge & { t: number };
  departs: Array<{ t: number; chemin: string }>;
  journal: string[];
  bail: { valeur: number | null; ecritures: Array<number | null> };
  enregistrements: Array<{ collection: Collection; etat: EtatOrdonnanceur }>;
  enVolMax: () => number;
}

function banc(
  reponse: (chemin: string, n: number) => ReponseApi | Promise<ReponseApi>,
  collection: Collection = collectionDe([]),
  etat: EtatOrdonnanceur = etatInitial(),
  surcharge: Partial<DependancesSynchro> = {},
): Banc {
  const horloge = horlogeSimulee();
  const departs: Banc['departs'] = [];
  const bail = { valeur: null as number | null, ecritures: [] as Array<number | null> };
  const enregistrements: Banc['enregistrements'] = [];
  let enVol = 0;
  let enVolMax = 0;
  const deps: DependancesSynchro = {
    horloge,
    transport: async (chemin) => {
      enVol += 1;
      enVolMax = Math.max(enVolMax, enVol);
      departs.push({ t: horloge.now(), chemin });
      try {
        await Promise.resolve();
        return await reponse(chemin, departs.length);
      } finally {
        enVol -= 1;
      }
    },
    collection,
    etat,
    bail: {
      lire: async () => bail.valeur,
      ecrire: async (v) => {
        bail.valeur = v;
        bail.ecritures.push(v);
      },
    },
    enregistrer: async (c, e) => {
      enregistrements.push({ collection: c, etat: e });
    },
    journal: () => undefined,
    ...surcharge,
  };
  const journal: string[] = [];
  deps.journal = (m) => journal.push(m);
  return { deps, horloge, departs, journal, bail, enregistrements, enVolMax: () => enVolMax };
}

describe('ordonnanceur — critère 1 : total inchangé, une seule requête', () => {
  it('ne fait que `stats` quand total, doublons et étiquettes sont inchangés', async () => {
    const site = siteFictif(4);
    const premier = banc(site);
    const r1 = await synchroniser(premier.deps);
    expect(r1.issue).toBe('termine');
    expect(r1.complete).toBe(true);
    expect(r1.collection.cartes).toHaveLength(4);

    const second = banc(site, r1.collection, r1.etat);
    second.horloge.t = T0 + 1000 * 60 * 60;
    const r2 = await synchroniser({ ...second.deps, maxPrix: 0 });
    expect(r2.issue).toBe('termine');
    expect(second.departs.map((d) => d.chemin)).toEqual(['/api/my-collection/stats?sort=rarity']);
  });

  it('relit les pages si une étiquette change de effectif malgré un total identique', async () => {
    const premier = banc(siteFictif(2, { tags: [['Garder', 1]] }));
    const r1 = await synchroniser({ ...premier.deps, maxPrix: 0 });
    const second = banc(siteFictif(2, { tags: [['Garder', 2]] }), r1.collection, r1.etat);
    await synchroniser({ ...second.deps, maxPrix: 0 });
    expect(second.departs.length).toBeGreaterThan(1);
  });

  it('relit les pages tant qu’aucune synchro complète n’a eu lieu', async () => {
    const b = banc(siteFictif(2));
    await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(b.departs.length).toBe(1 + 2); // stats, page 1, page vide
  });
});

describe('ordonnanceur — critère 2 : pages dans l’ordre jusqu’à collection: []', () => {
  it('lit les pages 1, 2, … puis la page vide, dans l’ordre, et enregistre étiquettes et favoris', async () => {
    const exemplaires = [exemplaire(1, { tags: ['Garder'] }), exemplaire(2, { starred: true }), exemplaire(3)];
    const b = banc((chemin) => {
      if (chemin.includes('/stats')) return { statut: 200, json: statsJson(3) };
      const p = Number(/page=(\d+)/.exec(chemin)![1]);
      return { statut: 200, json: { collection: exemplaires.slice((p - 1) * 2, p * 2) } };
    });
    const r = await synchroniser({ ...b.deps, maxPrix: 0 });
    const pages = b.departs.map((d) => d.chemin).filter((c) => c.includes('page='));
    expect(pages.map((c) => /page=(\d+)/.exec(c)![1])).toEqual(['1', '2', '3']);
    expect(pages.every((c) => c.includes('stats=0'))).toBe(true);
    const c1 = r.collection.cartes.find((c) => c.id === idCarte(1))!;
    expect(c1.etiquettesSite).toEqual(['Garder']);
    expect(c1.idsSite).toEqual(['ex-1']);
    expect(r.collection.cartes.find((c) => c.id === idCarte(2))!.favori).toBe(true);
    expect(r.etat.derniereComplete).not.toBeNull();
  });

  it('sans tri stable : relecture complète même si la première page est identique au local', async () => {
    const site = siteFictif(6);
    const premier = banc(site);
    const r1 = await synchroniser({ ...premier.deps, maxPrix: 0 });
    const etat = { ...r1.etat, total: 5 }; // simule un total différent
    const b = banc(site, r1.collection, etat);
    await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(b.departs.filter((d) => d.chemin.includes('page=')).length).toBe(4); // 3 pages + page vide
  });

  it('avec tri stable : s’arrête dès la première page identique au local', async () => {
    const site = siteFictif(8);
    const premier = banc(site);
    const r1 = await synchroniser({ ...premier.deps, maxPrix: 0 });
    // une carte ajoutée en fin : seule la dernière page change ; tri stable déclaré → arrêt dès la page identique
    const etat = { ...r1.etat, total: 7 };
    const b = banc(site, r1.collection, etat, { triStable: true });
    await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(b.departs.filter((d) => d.chemin.includes('page=')).length).toBe(1);
  });

  it('ignore une carte de forme inattendue, continue et le note au journal', async () => {
    const b = banc((chemin) => {
      if (chemin.includes('/stats')) return { statut: 200, json: statsJson(2) };
      const p = Number(/page=(\d+)/.exec(chemin)![1]);
      return { statut: 200, json: { collection: p === 1 ? [exemplaire(1), { id: 'x' }] : [] } };
    });
    const r = await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(r.collection.cartes).toHaveLength(1);
    expect(r.ignorees).toBe(1);
    expect(b.journal.join('\n')).toMatch(/ignorée/);
  });
});

describe('ordonnanceur — critère 3 : prix', () => {
  const etatLu = (collection: Collection, ids: Record<string, string>): EtatOrdonnanceur => ({
    ...etatInitial(),
    total: collection.cartes.length,
    totalUnique: collection.cartes.length,
    signatureEtiquettes: '',
    derniereComplete: T0 - 1,
    cardIds: ids,
  });

  const cheminsPrix = (b: Banc) => b.departs.map((d) => d.chemin).filter((c) => c.includes('/sales'));

  it('relève d’abord les cartes à décider, puis valeur absente, puis périmée', async () => {
    const cartes = [
      carteLocale(1, { statut: 'garder', valeurMarchande: 50 }), // périmée (relevée il y a 40 j)
      carteLocale(2, { statut: 'garder' }), // absente
      carteLocale(3, { statut: 'a-trier' }), // à décider
      carteLocale(4, { statut: 'garder', valeurMarchande: 60 }), // fraîche : à ne pas relever
    ];
    const collection = collectionDe(cartes);
    const ids = Object.fromEntries(cartes.map((c, i) => [c.id, `card-${i + 1}`]));
    const etat = etatLu(collection, ids);
    etat.prix[idCarte(1)] = { valeur: 50, releveLe: T0 - 40 * JOUR };
    etat.prix[idCarte(4)] = { valeur: 60, releveLe: T0 - 2 * JOUR };
    const b = banc(siteFictif(4), collection, etat);
    const r = await synchroniser(b.deps);
    expect(cheminsPrix(b).map((c) => /card-(\d)/.exec(c)![1])).toEqual(['3', '2', '1']);
    expect(r.collection.cartes.find((c) => c.id === idCarte(3))!.valeurMarchande).toBe(103);
    expect(r.collection.cartes.find((c) => c.id === idCarte(4))!.valeurMarchande).toBe(60);
    expect(r.prixReleves).toBe(3);
  });

  it('la périodicité est de 30 jours', () => {
    expect(ancienneteMaxPrixMs).toBe(30 * JOUR);
  });

  it('ne réécrit pas une valeur saisie à la main et la signale', async () => {
    const cartes = [carteLocale(1, { statut: 'a-trier', valeurMarchande: 999 })];
    const etat = etatLu(collectionDe(cartes), { [idCarte(1)]: 'card-1' });
    const b = banc(siteFictif(1), collectionDe(cartes), etat);
    const r = await synchroniser(b.deps);
    expect(r.collection.cartes[0].valeurMarchande).toBe(999);
    expect(r.signalements).toEqual([{ idCarte: idCarte(1), saisie: 999, site: 101 }]);
  });

  it('ne relève pas une valeur saisie à la main hors des cartes à décider', async () => {
    const cartes = [carteLocale(1, { statut: 'garder', valeurMarchande: 999 })];
    const etat = etatLu(collectionDe(cartes), { [idCarte(1)]: 'card-1' });
    const b = banc(siteFictif(1), collectionDe(cartes), etat);
    await synchroniser(b.deps);
    expect(cheminsPrix(b)).toEqual([]);
  });

  it('écrase une valeur qu’elle avait elle-même relevée, sans signalement', async () => {
    const cartes = [carteLocale(1, { statut: 'garder', valeurMarchande: 50 })];
    const etat = etatLu(collectionDe(cartes), { [idCarte(1)]: 'card-1' });
    etat.prix[idCarte(1)] = { valeur: 50, releveLe: T0 - 40 * JOUR };
    const b = banc(siteFictif(1), collectionDe(cartes), etat);
    const r = await synchroniser(b.deps);
    expect(r.collection.cartes[0].valeurMarchande).toBe(101);
    expect(r.signalements).toEqual([]);
  });

  it('n’emploie jamais la route /sales sans ?scope=summary', async () => {
    const cartes = [1, 2, 3].map((n) => carteLocale(n, { statut: 'a-trier' }));
    const ids = Object.fromEntries(cartes.map((c, i) => [c.id, `card-${i + 1}`]));
    const b = banc(siteFictif(3), collectionDe(cartes), etatLu(collectionDe(cartes), ids));
    await synchroniser(b.deps);
    const ventes = b.departs.map((d) => d.chemin).filter((c) => c.includes('/sales'));
    expect(ventes.length).toBe(3);
    expect(ventes.every((c) => c.endsWith('/sales?scope=summary'))).toBe(true);
  });

  it('une rareté absente de la réponse ne compte pas comme un échec et n’est pas redemandée avant 30 jours', async () => {
    const cartes = [carteLocale(1, { statut: 'a-trier' })];
    const etat = etatLu(collectionDe(cartes), { [idCarte(1)]: 'card-1' });
    const b = banc(siteFictif(1, { prix: () => null }), collectionDe(cartes), etat);
    const r = await synchroniser(b.deps);
    expect(r.issue).toBe('termine');
    expect(r.collection.cartes[0].valeurMarchande).toBeNull();
    const b2 = banc(siteFictif(1, { prix: () => null }), r.collection, r.etat);
    await synchroniser(b2.deps);
    expect(cheminsPrix(b2)).toEqual([]);
  });

  it('plafonne le nombre de prix relevés par exécution', async () => {
    const cartes = [1, 2, 3, 4].map((n) => carteLocale(n, { statut: 'a-trier' }));
    const ids = Object.fromEntries(cartes.map((c, i) => [c.id, `card-${i + 1}`]));
    const b = banc(siteFictif(4), collectionDe(cartes), etatLu(collectionDe(cartes), ids));
    const r = await synchroniser({ ...b.deps, maxPrix: 2 });
    expect(r.prixReleves).toBe(2);
  });
});

describe('ordonnanceur — critère 4 : cadence et arrêts', () => {
  it('sépare deux requêtes d’au moins 6 s, au plus 10 par 60 s, une seule en vol', async () => {
    const b = banc(siteFictif(40));
    await synchroniser({ ...b.deps, maxPrix: 0 });
    const t = b.departs.map((d) => d.t);
    expect(t.length).toBeGreaterThan(MAX_PAR_FENETRE);
    for (let i = 1; i < t.length; i++) expect(t[i] - t[i - 1]).toBeGreaterThanOrEqual(INTERVALLE_MS);
    for (let i = 0; i + MAX_PAR_FENETRE < t.length; i++) expect(t[i + MAX_PAR_FENETRE] - t[i]).toBeGreaterThanOrEqual(FENETRE_MS);
    expect(b.enVolMax()).toBe(1);
  });

  it('respecte la fenêtre de 60 s même quand des requêtes récentes viennent d’une exécution précédente', async () => {
    const etat = etatInitial();
    etat.requetes = Array.from({ length: MAX_PAR_FENETRE }, (_, i) => T0 - 1000 + i); // 10 requêtes à l’instant
    const b = banc(siteFictif(1), collectionDe([]), etat);
    await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(b.departs[0].t - (T0 - 1000)).toBeGreaterThanOrEqual(FENETRE_MS);
  });

  it.each([401, 403, 429])('arrêt immédiat sur %i, sans reprise avant 30 min', async (code) => {
    const b = banc((chemin, n) => (n === 2 ? { statut: code, json: null } : siteFictif(10)(chemin)));
    const r = await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(r.issue).toBe('arret');
    expect(r.raison).toBe('code-http');
    expect(r.codeHttp).toBe(code);
    expect(b.departs.length).toBe(2);
    expect(r.etat.arretJusqua).toBe(b.horloge.t + PAUSE_APRES_ARRET_MS);
    expect(b.journal.join('\n')).toContain(String(code));

    // 29 min plus tard : aucune requête
    const b2 = banc(siteFictif(10), r.collection, r.etat);
    b2.horloge.t = r.etat.arretJusqua! - 60_000;
    const r2 = await synchroniser(b2.deps);
    expect(r2.issue).toBe('repos');
    expect(b2.departs).toEqual([]);
    // après 30 min : reprise
    const b3 = banc(siteFictif(10), r.collection, r.etat);
    b3.horloge.t = r.etat.arretJusqua!;
    const r3 = await synchroniser({ ...b3.deps, maxPrix: 0 });
    expect(r3.issue).toBe('termine');
  });

  it('arrêt après 3 échecs (statut 500, transport en erreur, forme inattendue)', async () => {
    const reponses: Array<() => ReponseApi> = [
      () => ({ statut: 200, json: statsJson(10) }),
      () => ({ statut: 500, json: null }),
      () => {
        throw new Error('réseau');
      },
      () => ({ statut: 200, json: { inattendu: true } }),
      () => ({ statut: 200, json: { collection: [] } }),
    ];
    const b = banc((_c, n) => reponses[n - 1]());
    const r = await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(r.issue).toBe('arret');
    expect(r.raison).toBe('echecs');
    expect(b.departs.length).toBe(4);
    expect(r.complete).toBe(false);
    expect(r.etat.arretJusqua).toBe(b.horloge.t + PAUSE_APRES_ARRET_MS);
  });

  it('un échec isolé n’arrête pas la synchro mais la rend incomplète', async () => {
    const site = siteFictif(4);
    const b = banc((chemin, n) => (n === 2 ? { statut: 500, json: null } : site(chemin)));
    const r = await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(r.issue).toBe('termine');
    expect(r.complete).toBe(false);
    expect(r.etat.derniereComplete).toBeNull();
  });

  it('s’arrête sur demande manuelle avant la requête suivante', async () => {
    let n = 0;
    const b = banc(siteFictif(10));
    const r = await synchroniser({ ...b.deps, maxPrix: 0, arretDemande: () => ++n > 2 });
    expect(r.issue).toBe('arret');
    expect(r.raison).toBe('manuel');
    expect(b.departs.length).toBe(2);
    expect(r.etat.arretJusqua).toBeNull(); // un arrêt voulu n’impose pas de pause de 30 min
  });

  it('n’envoie jamais autre chose qu’un chemin de lecture connu', async () => {
    const cartes = [carteLocale(1, { statut: 'a-trier' })];
    const b = banc(siteFictif(5), collectionDe(cartes), { ...etatInitial(), cardIds: { [idCarte(1)]: 'card-1' } });
    await synchroniser(b.deps);
    for (const d of b.departs) {
      expect(d.chemin).toMatch(
        /^\/api\/(my-collection\/stats\?sort=rarity|my-collection\?sort=rarity&page=\d+&stats=0|marketplace\/cards\/[A-Za-z0-9_-]+\/sales\?scope=summary)$/,
      );
    }
  });
});

describe('ordonnanceur — critère 5 : bail et décisions manuelles', () => {
  it('ne fait rien si un bail non expiré est tenu', async () => {
    const b = banc(siteFictif(2));
    b.bail.valeur = b.horloge.t + 60_000;
    const r = await synchroniser(b.deps);
    expect(r.issue).toBe('bail-occupe');
    expect(b.departs).toEqual([]);
  });

  it('reprend un bail expiré, le renouvelle à chaque requête et le libère à la fin', async () => {
    const b = banc(siteFictif(2));
    b.bail.valeur = b.horloge.t - 1;
    const r = await synchroniser({ ...b.deps, maxPrix: 0 });
    expect(r.issue).toBe('termine');
    expect(b.bail.ecritures.length).toBeGreaterThanOrEqual(b.departs.length + 1);
    expect(b.bail.valeur).toBeNull();
  });

  it('libère le bail même après un arrêt', async () => {
    const b = banc(() => ({ statut: 403, json: null }));
    await synchroniser(b.deps);
    expect(b.bail.valeur).toBeNull();
  });

  it('deux synchros simultanées : la seconde est refusée', async () => {
    const b = banc(siteFictif(2));
    const [a, c] = await Promise.all([synchroniser({ ...b.deps, maxPrix: 0 }), synchroniser({ ...b.deps, maxPrix: 0 })]);
    expect([a.issue, c.issue].sort()).toEqual(['bail-occupe', 'termine']);
  });

  it('ne modifie jamais une décision decidePar: moi (statut, prix cible, note, ami)', async () => {
    const decidee = carteLocale(1, { decidePar: 'moi', statut: 'vendre', prixCible: 42, note: 'ma note', ami: 'Léa', quantite: 3, valeurMarchande: 7 });
    const b = banc(siteFictif(2), collectionDe([decidee]), { ...etatInitial(), cardIds: { [idCarte(1)]: 'card-1' } });
    const r = await synchroniser(b.deps);
    const apres = r.collection.cartes.find((c) => c.id === idCarte(1))!;
    expect(apres).toMatchObject({ decidePar: 'moi', statut: 'vendre', prixCible: 42, note: 'ma note', ami: 'Léa', valeurMarchande: 7 });
    expect(apres.quantite).toBe(1); // les faits du site sont mis à jour
  });

  it('enregistre après chaque page et chaque prix, sans jeton ni en-tête dans l’état', async () => {
    const cartes = [carteLocale(1, { statut: 'a-trier' })];
    const b = banc(siteFictif(2), collectionDe(cartes), { ...etatInitial(), cardIds: { [idCarte(1)]: 'card-1' } });
    const r = await synchroniser(b.deps);
    expect(b.enregistrements.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(r.etat)).not.toMatch(/token|jeton|authorization|cookie/i);
  });
});
