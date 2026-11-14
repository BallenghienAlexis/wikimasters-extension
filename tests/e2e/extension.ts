import { chromium, expect, test as base, type BrowserContext, type Page, type Worker } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');

export const COLLECTION_FICTIVE = path.resolve('tests/e2e/fixtures/collection-fictive.json');

/** Complète une carte de fixture avec les valeurs par défaut du schéma de stockage (v3). */
export const carteComplete = (c: Record<string, unknown>): object => ({
  rarete: null,
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: null,
  etiquettesSite: [],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...c,
});

/** Écrit directement des cartes dans le stockage de l'extension (la page ne propose plus d'import), puis recharge la page. */
export async function chargerCartes(page: Page, cartes: Record<string, unknown>[]): Promise<void> {
  const complete = cartes.map(carteComplete);
  await page.evaluate((c) => chrome.storage.local.set({ collection: { version: 3, cartes: c } }), complete);
  await page.reload();
}

/** Charge les quatre cartes fictives de `collection-fictive.json`. */
export async function chargerCollectionFictive(page: Page): Promise<void> {
  const { cartes } = JSON.parse(fs.readFileSync(COLLECTION_FICTIVE, 'utf8')) as { cartes: Record<string, unknown>[] };
  await chargerCartes(page, cartes);
}

/** Onglets de la page de gestion, dans l'ordre d'affichage (fragment d'URL = identifiant). */
export const ONGLETS = [
  { id: 'tableau-de-bord', nom: 'Tableau de bord' },
  { id: 'synchro', nom: 'Synchro' },
  { id: 'lots', nom: 'Lots' },
  { id: 'collection', nom: 'Collection' },
  { id: 'reglages', nom: 'Réglages' },
] as const;

export type IdOnglet = (typeof ONGLETS)[number]['id'];

/** Ouvre un onglet de la page de gestion par son fragment d'URL, puis attend qu'il soit sélectionné. */
export async function allerA(page: Page, onglet: IdOnglet): Promise<void> {
  await page.evaluate((id) => {
    window.location.hash = id;
  }, onglet);
  const { nom } = ONGLETS.find((o) => o.id === onglet) ?? { nom: onglet };
  await expect(page.getByRole('tab', { name: new RegExp(`^${nom}`) })).toHaveAttribute('aria-selected', 'true');
}

/** Largeurs et thèmes des vérifications transverses (SC-009) et des captures finales. */
export const POINTS_DE_RUPTURE = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;
export const THEMES = ['light', 'dark'] as const;

/** Instant fixé pour les tests transverses : 14 novembre 2026, 12:00 (heure locale du navigateur). */
export const MAINTENANT = new Date(2026, 10, 14, 12, 0, 0).getTime();

/** Fige `Date.now()` dans toutes les pages du contexte (les minuteries continuent de tourner). */
export async function fixerHorloge(context: BrowserContext): Promise<void> {
  await context.clock.setFixedTime(MAINTENANT);
}

/** Jour local au format AAAA-MM-JJ, décalé de `decalage` jours avant `MAINTENANT`. */
export function jourFictif(decalage: number): string {
  const d = new Date(MAINTENANT - decalage * 86_400_000);
  const deux = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Cartes fictives en grand nombre (rareté, quantité et valeur variées). */
export function cartesFictivesRepartie(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `n${i}`,
    titre: `Carte fictive ${String(i).padStart(4, '0')}`,
    rarete: i % 3 === 0 ? 'Rare' : 'Commune',
    quantite: 1 + (i % 3),
    valeurMarchande: i % 4 === 0 ? null : 3 + (i % 40),
  }));
}

/** Jeu de données fictif complet : toutes les clés v2 portent du contenu, pour que chaque onglet soit plein. */
export async function ecrireJeuRiche(page: Page): Promise<void> {
  const cartes = [
    { id: 'UR|Loutre fictive', titre: 'Loutre fictive', rarete: 'UR', quantite: 2, valeurMarchande: 120, favori: true, description: 'animal aquatique' },
    { id: 'R|Renard fictif', titre: 'Renard fictif', rarete: 'R', quantite: 1, valeurMarchande: 40, ami: 'Amie fictive' },
    { id: 'C|Mouette fictive', titre: 'Mouette fictive', rarete: 'C', quantite: 3, valeurMarchande: 25, prixCible: 30 },
    { id: 'C|Abeille fictive', titre: 'Abeille fictive', rarete: 'C', quantite: 2, valeurMarchande: 4 },
    { id: 'C|Élan fictif', titre: 'Élan fictif', rarete: 'C', quantite: 3, valeurMarchande: null },
    { id: 'R|Zèbre fictif', titre: 'Zèbre fictif', rarete: 'R', quantite: 1, valeurMarchande: 15 },
    { id: 'UR|Loutre en vente', titre: 'Loutre en vente', rarete: 'UR', quantite: 1, valeurMarchande: 90 },
  ].map((c, i) => carteComplete({ ...c, idsSite: [`bbbbbbbb-bbbb-4bbb-8bbb-00000000000${i}`] }));
  const entreeJournal = (n: number, s: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: `j-${n}`,
    horodatage: new Date(MAINTENANT - (20 - n) * 60_000).toISOString(),
    idCarte: 'UR|Loutre fictive',
    titre: 'Loutre fictive',
    type: 'pose-etiquette',
    parametre: 'Statut · Garder',
    resultat: 'reussie',
    codeHttp: null,
    idLot: 'lot-fictif',
    rang: n,
    total: 10,
    lot: 'etiquettes',
    cause: null,
    ...s,
  });
  const valeurs = {
    collection: { version: 3, cartes },
    preferences: { version: 2, mesThemes: [], amis: [] },
    amisInitiaux: 999,
    syncAuto: false,
    derniereSynchro: MAINTENANT - 12 * 60_000,
    statutSynchro: {
      version: 2, etat: 'termine', page: null, pages: null, raison: null, codeHttp: null,
      le: MAINTENANT - 12 * 60_000, ajoutees: 2, etiquettes: 5, prix: 7,
      etape: null, prixFaits: null, prixPrevus: null, debut: MAINTENANT - 20 * 60_000,
    },
    historique: {
      version: 1,
      points: [
        { jour: jourFictif(6), exemplaires: 9 },
        { jour: jourFictif(4), exemplaires: 11 },
        { jour: jourFictif(2), exemplaires: 12 },
      ],
    },
    journal: {
      version: 2,
      entrees: [
        entreeJournal(1),
        entreeJournal(2, { type: 'enchere', parametre: '50', resultat: 'echouee', codeHttp: 500, lot: 'encheres' }),
        entreeJournal(3, { resultat: 'passee', cause: 'sautee' }),
      ],
    },
    ignorees: {
      version: 1,
      entrees: [
        { type: 'pose-etiquette', idCarte: 'UR|Loutre fictive', parametre: 'Statut · Garder', portee: 'synchro', date: MAINTENANT - 600_000 },
        { type: 'pose-etiquette', idCarte: 'R|Renard fictif', parametre: 'Statut · Échanger', portee: 'synchro', date: MAINTENANT - 300_000 },
      ],
    },
    execution: {
      version: 2, idLot: 'lot-fictif', etat: 'arretee', traitees: 6, total: 10, pauseJusqua: null,
      lots: [
        { famille: 'etiquettes', total: 6, traitees: 6, sautees: 0 },
        { famille: 'defausses', total: 4, traitees: 0, sautees: 0 },
      ],
      erreur: {
        type: 'defausse', parametre: null, idCarte: 'C|Abeille fictive', titre: 'Abeille fictive', famille: 'defausses',
        indexLot: 1, nbLots: 2, rang: 1, totalLot: 4, codeHttp: 500, cause: 'code-http', le: MAINTENANT - 60_000,
        reussies: 6, autresEchecsEnVol: 0,
      },
    },
  };
  await page.evaluate((v) => chrome.storage.local.set(v), valeurs);
  await page.reload();
}

/**
 * Enregistre toute requête http(s) du contexte, avec la « phase » courante, et la neutralise :
 * Wikipédia et Wikidata reçoivent une réponse vide, tout le reste est abandonné. Aucun test ne contacte un vrai hôte.
 */
export async function pieger(context: BrowserContext): Promise<{ vues: { phase: string; url: string }[]; phase: { nom: string } }> {
  const etat = { vues: [] as { phase: string; url: string }[], phase: { nom: 'depart' } };
  await context.route(
    (url) => url.protocol.startsWith('http'),
    (route) => {
      const u = route.request().url();
      etat.vues.push({ phase: etat.phase.nom, url: u });
      if (/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\/w\/api\.php\?/.test(u)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"query":{"pages":[]}}' });
      }
      return route.abort();
    },
  );
  return etat;
}

/** Ratio de contraste WCAG entre la couleur du texte d'un élément et le premier fond opaque de ses ancêtres. */
export async function contraste(cible: import('@playwright/test').Locator): Promise<number> {
  return cible.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;
    const rgba = (couleur: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = couleur;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
    };
    const lum = ([r, g, b]: [number, number, number, number]): number => {
      const f = (v: number): number => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let fond: [number, number, number, number] = [0, 0, 0, 0];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0.99) { fond = c; break; }
    }
    if (fond[3] === 0) fond = rgba(getComputedStyle(document.body).backgroundColor);
    const texte = rgba(getComputedStyle(el).color);
    const [a, b] = [lum(texte), lum(fond)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
}

/** Ouvre les sept sections repliables de l'onglet Réglages (une par une, sans supposer qu'elles restent ouvertes ensemble). */
export async function ouvrirSectionsReglages(page: Page): Promise<void> {
  for (const titre of ['Synchronisation automatique', 'Sauvegarde', 'Plafond de défausse', 'Étiquettes préexistantes', 'Wikipédia', 'Thèmes', 'Animations']) {
    const b = page.getByRole('button', { name: new RegExp(`^${titre}`) });
    if ((await b.getAttribute('aria-expanded')) === 'false') await b.click();
  }
}

/** Déplie la section « Ignorées » de l'onglet Synchro si elle est repliée. */
export async function ouvrirIgnorees(page: Page): Promise<void> {
  const titre = page.getByTestId('ignorees').getByRole('button', { name: /^Ignorées/ });
  if ((await titre.getAttribute('aria-expanded')) === 'false') await titre.click();
}

interface Fixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  pageCollection: Page;
}

export const test = base.extend<Fixtures>({
  // Une extension ne se charge que dans un contexte persistant, sur le Chromium de Playwright.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  pageCollection: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/collection.html`);
    await use(page);
  },
});

export { expect };
