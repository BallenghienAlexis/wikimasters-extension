import { describe, expect, it } from 'vitest';
import { VERSION_SCHEMA, type Collection } from '../../src/lib/collection';
import type { Horloge } from '../../src/lib/file';
import { etatInitial, synchroniser, type ReponseApi } from '../../src/lib/ordonnanceur';
import type { StatutSynchro } from '../../src/lib/stockage';
import { preferencesParDefaut } from '../../src/lib/tri';
import { creerSynchroAuto, type DependancesSynchroAuto } from '../../src/content/synchroAuto';

// T-314 : écriture du statut de synchro v2. Données fictives, aucun contact avec le vrai site.
const T0 = 10_000_000_000;

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

const site = (n: number) => (chemin: string): ReponseApi => {
  if (chemin.startsWith('/api/my-collection/stats')) return { statut: 200, json: { total: n, totalUnique: n, tagOptions: [] } };
  const page = /\/api\/my-collection\?.*page=(\d+)/.exec(chemin);
  if (page) {
    const p = Number(page[1]);
    return { statut: 200, json: { collection: Array.from({ length: n }, (_, i) => exemplaire(i + 1)).slice(p * 50, (p + 1) * 50) } };
  }
  if (/\/sales\?scope=summary$/.test(chemin)) return { statut: 200, json: { summary: { R: { average: 120 } }, isPro: false } };
  if (chemin === '/api/marketplace/mine') return { statut: 200, json: { listings: [] } };
  return { statut: 404, json: null };
};

interface Banc {
  deps: DependancesSynchroAuto;
  horloge: Horloge & { t: number };
  chemins: string[];
  statuts: StatutSynchro[];
}

function banc(n: number): Banc {
  const horloge = horlogeSimulee();
  const chemins: string[] = [];
  const statuts: StatutSynchro[] = [];
  const stockage = { collection: { version: VERSION_SCHEMA, cartes: [] } as Collection, etat: null as ReturnType<typeof etatInitial> | null, bail: null as number | null };
  const reponse = site(n);
  const deps: DependancesSynchroAuto = {
    horloge,
    transport: async (chemin) => {
      chemins.push(chemin);
      return reponse(chemin);
    },
    actif: async () => true,
    derniereSynchro: async () => null,
    noterDerniereSynchro: async () => undefined,
    chargerCollection: async () => structuredClone(stockage.collection),
    enregistrerCollection: async (c) => {
      stockage.collection = structuredClone(c);
    },
    chargerEtat: async () => (stockage.etat === null ? null : structuredClone(stockage.etat)),
    enregistrerEtat: async (e) => {
      stockage.etat = structuredClone(e);
    },
    bail: { lire: async () => stockage.bail, ecrire: async (v) => void (stockage.bail = v) },
    chargerPreferences: async () => preferencesParDefaut(),
    noterStatut: async (s) => {
      statuts.push(structuredClone(s));
    },
    journal: () => undefined,
  };
  return { deps, horloge, chemins, statuts };
}

const v2 = (s: StatutSynchro | undefined) => s as StatutSynchro & { etape?: string | null; prixFaits?: number | null; prixPrevus?: number | null; debut?: number | null };

describe('SC-019 / SC-002 : statut v2 écrit par synchroAuto', () => {
  it('SC-019 : le statut écrit est en version 2 avec etape, prixFaits, prixPrevus et debut', async () => {
    const b = banc(3);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.statuts.length).toBeGreaterThan(0);
    for (const s of b.statuts) {
      expect(s.version).toBe(2);
      expect(s).toHaveProperty('etape');
      expect(s).toHaveProperty('prixFaits');
      expect(s).toHaveProperty('prixPrevus');
      expect(s).toHaveProperty('debut');
    }
  });

  it('SC-002 : l’étape est déduite du chemin demandé (stats, pages, prix, ventes)', async () => {
    const b = banc(3);
    await creerSynchroAuto(b.deps).declencher();
    const etapes = b.statuts.map((s) => v2(s).etape as string | null | undefined);
    expect(etapes).toContain('stats');
    expect(etapes).toContain('pages');
    expect(etapes).toContain('prix');
    expect(etapes).toContain('ventes');
    // L'ordre des étapes suit celui du plan.
    const ordre = ['stats', 'pages', 'prix', 'ventes'];
    const vues = etapes.filter((e): e is string => typeof e === 'string').map((e) => ordre.indexOf(e));
    expect([...vues].sort((x, y) => x - y)).toEqual(vues);
  });

  it('SC-002 : prixFaits est compté et prixPrevus annoncé avant la boucle de prix', async () => {
    const b = banc(4);
    await creerSynchroAuto(b.deps).declencher();
    const prix = b.statuts.filter((s) => v2(s).etape === 'prix');
    expect(prix.length).toBeGreaterThan(0);
    expect(v2(prix[0]).prixPrevus).toBe(4);
    const faits = prix.map((s) => v2(s).prixFaits ?? 0);
    expect([...faits].sort((x, y) => x - y)).toEqual(faits);
    expect(Math.max(...faits)).toBeGreaterThanOrEqual(3);
    const dernier = v2(b.statuts[b.statuts.length - 1] as StatutSynchro);
    expect(dernier.etat).toBe('termine');
    expect(dernier.prixFaits).toBe(4);
    expect(dernier.prixPrevus).toBe(4);
  });

  it('SC-002 : debut est l’horodatage de début de synchro, identique à chaque écriture', async () => {
    const b = banc(3);
    await creerSynchroAuto(b.deps).declencher();
    const debuts = new Set(b.statuts.map((s) => v2(s).debut));
    expect(debuts.size).toBe(1);
    const [debut] = [...debuts];
    expect(typeof debut).toBe('number');
    expect(debut as number).toBeGreaterThanOrEqual(T0);
    expect(debut as number).toBeLessThanOrEqual((b.statuts[0] as StatutSynchro).le);
  });

  it('SC-019 : au plus une écriture par seconde sauf changement d’étape ou d’état', async () => {
    const b = banc(40);
    await creerSynchroAuto(b.deps).declencher();
    expect(b.statuts.length).toBeGreaterThan(2);
    for (let i = 1; i < b.statuts.length; i++) {
      const a = v2(b.statuts[i - 1]);
      const c = v2(b.statuts[i]);
      if (a.etape === c.etape && a.etat === c.etat) expect(c.le - a.le, `écritures ${i - 1} et ${i}`).toBeGreaterThanOrEqual(1000);
    }
    // Plus de 40 requêtes de prix à 0,2 s : bien moins d'écritures que de requêtes.
    expect(b.statuts.length).toBeLessThan(b.chemins.length / 2);
  });

  it('SC-019 : aucune requête, chemin ni cadence modifié (mêmes chemins que le plan existant)', async () => {
    const b = banc(2);
    await creerSynchroAuto(b.deps).declencher();
    for (const c of b.chemins) {
      expect(/^\/api\/(my-collection\/stats|my-collection\?.*page=\d+|marketplace\/cards\/[^/]+\/sales\?scope=summary|marketplace\/mine)/.test(c), c).toBe(true);
    }
  });
});

describe('SC-002 : crochet annoncerPrix de l’ordonnanceur', () => {
  async function lancer(n: number, options: { maxPrix?: number; avecCrochet: boolean }) {
    const horloge = horlogeSimulee();
    const reponse = site(n);
    const annonces: number[] = [];
    const chemins: string[] = [];
    const resultat = await synchroniser({
      horloge,
      transport: async (c) => {
        chemins.push(c);
        // Le crochet doit avoir été appelé avant la première requête de prix.
        if (/scope=summary/.test(c) && options.avecCrochet) expect(annonces.length).toBe(1);
        return reponse(c);
      },
      collection: { version: VERSION_SCHEMA, cartes: [] },
      etat: etatInitial(),
      bail: { lire: async () => null, ecrire: async () => undefined },
      enregistrer: async () => undefined,
      journal: () => undefined,
      maxPrix: options.maxPrix,
      ...(options.avecCrochet ? { annoncerPrix: (v: number) => void annonces.push(v) } : {}),
    } as Parameters<typeof synchroniser>[0]);
    return { annonces, chemins, resultat };
  }

  it('SC-002 : appelé une fois avec min(candidats, plafond) — plafond plus petit', async () => {
    const { annonces } = await lancer(10, { maxPrix: 3, avecCrochet: true });
    expect(annonces).toEqual([3]);
  });

  it('SC-002 : appelé une fois avec min(candidats, plafond) — moins de candidats', async () => {
    const { annonces } = await lancer(4, { maxPrix: 50, avecCrochet: true });
    expect(annonces).toEqual([4]);
  });

  it('SC-019 : sans le crochet, comportement identique (mêmes requêtes, même résultat)', async () => {
    const avec = await lancer(6, { maxPrix: 5, avecCrochet: true });
    const sans = await lancer(6, { maxPrix: 5, avecCrochet: false });
    expect(sans.chemins).toEqual(avec.chemins);
    expect(sans.resultat.prixReleves).toBe(avec.resultat.prixReleves);
    expect(sans.resultat.collection).toEqual(avec.resultat.collection);
  });
});
