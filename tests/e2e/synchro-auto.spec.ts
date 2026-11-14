import type { BrowserContext, Page, Route, Worker } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_AFFLUENCE } from '../../src/config/affluence';
import { allerA, expect, test } from './extension';

// Le site est entièrement simulé : ces tests ne contactent jamais le vrai WikiMasters (G1).
// Les réponses fictives ont la forme décrite dans specs/synchro-auto/releve-api.md.
// Le content script utilise l'horloge réelle (la cadence est de 0,2 à 0,3 s) : les jeux de données sont minimaux.
const DOSSIER = path.resolve('tests/e2e/fixtures');
const lire = (nom: string): string => fs.readFileSync(path.join(DOSSIER, nom), 'utf8');
const SITE = lire('site-vide.html');
const STATS = lire('api/stats.json');
const PAGE_0 = lire('api/page-0.json');
const PAGE_VIDE = lire('api/page-vide.json');
const PRIX = lire('api/prix.json');

const ID_CARTE = 'UR|Loutre fictive';
const CHEMIN_STATS = '/api/my-collection/stats?sort=added';
const CHEMIN_PAGE = (n: number): string => `/api/my-collection?sort=added&page=${n}&stats=0`;
const CHEMIN_PRIX = '/api/marketplace/cards/carte-fictive-1/sales?scope=summary';
// Relevé d'affluence (décision du 2026-11-11) : un seul GET vers le listing du marché, après la synchro.
const CHEMIN_VENTES = '/api/marketplace/mine';
const CHEMIN_MARCHE = CONFIG_AFFLUENCE.routeMarche ?? '/api/marketplace';
const CHEMINS_AUTORISES = [CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_PAGE(1), CHEMIN_PRIX, CHEMIN_VENTES, CHEMIN_MARCHE];
// Attente plus longue qu'une cadence (0,3 s) pour prouver qu'aucune autre requête ne part.
const PLUS_QU_UNE_CADENCE_MS = 8_000;

interface RequeteVue {
  methode: string;
  chemin: string;
  entetes: Record<string, string>;
}

interface Site {
  /** Requêtes vers `/api/` reçues, dans l'ordre. */
  api: RequeteVue[];
  page: Page;
}

interface CarteStockee {
  id: string;
  quantite: number;
  valeurMarchande: number | null;
  etiquettesSite: string[];
}

const carteLocale = (surcharge: object = {}): object => ({
  id: ID_CARTE,
  titre: 'Loutre fictive',
  rarete: 'UR',
  description: '',
  quantite: 1,
  url: null,
  favori: false,
  idsSite: ['exemplaire-fictif-1'],
  etiquettesSite: [],
  prixCible: null,
  note: '',
  ami: null,
  valeurMarchande: null,
  ...surcharge,
});

const poser = (worker: Worker, valeurs: Record<string, unknown>): Promise<void> => worker.evaluate((v) => chrome.storage.local.set(v), valeurs);

const cartesStockees = (worker: Worker): Promise<CarteStockee[]> =>
  worker.evaluate(async () => {
    const { collection } = await chrome.storage.local.get('collection');
    return ((collection as { cartes: CarteStockee[] } | undefined)?.cartes ?? []) as CarteStockee[];
  });

const json = (route: Route, corps: string, statut = 200): Promise<void> => route.fulfill({ status: statut, contentType: 'application/json', body: corps });

/** Sert le site fictif ; toute requête hors des chemins attendus est abandonnée (et gardée en trace). */
async function ouvrirSite(context: BrowserContext, reponses: Partial<Record<string, { corps: string; statut?: number }>> = {}): Promise<Site> {
  const api: RequeteVue[] = [];
  await context.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort(),
  );
  await context.route('https://www.wiki-masters.com/**', (route) => {
    const requete = route.request();
    const url = new URL(requete.url());
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'text/html', body: SITE });
    const chemin = url.pathname + url.search;
    api.push({ methode: requete.method(), chemin, entetes: requete.headers() });
    const prevue = reponses[chemin];
    if (prevue) return json(route, prevue.corps, prevue.statut);
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto('https://www.wiki-masters.com/collection');
  return { api, page };
}

/** SC-009 : GET seulement, chemins autorisés, `/sales` toujours avec `?scope=summary`, aucun jeton. */
function verifierLectureSeule(api: RequeteVue[]): void {
  for (const r of api) {
    expect(r.methode, r.chemin).toBe('GET');
    expect(CHEMINS_AUTORISES, r.chemin).toContain(r.chemin);
    if (r.chemin.includes('/sales')) expect(r.chemin).toContain('?scope=summary');
    for (const entete of ['authorization', 'apikey', 'x-csrf-token', 'x-auth-token']) expect(r.entetes[entete], `${entete} sur ${r.chemin}`).toBeUndefined();
  }
}

const chemins = (api: RequeteVue[]): string[] => api.map((r) => r.chemin);

test.describe('synchronisation automatique sur site fictif', () => {
  test('option désactivée : aucune requête vers /api/ (SC-007)', async ({ context, serviceWorker }) => {
    await poser(serviceWorker, { collection: { version: 3, cartes: [carteLocale()] }, syncAuto: false });
    const site = await ouvrirSite(context, { [CHEMIN_STATS]: { corps: STATS } });
    await site.page.waitForTimeout(PLUS_QU_UNE_CADENCE_MS);
    expect(site.api).toEqual([]);

    // Contre-épreuve : « désactivé » n'est pas « jamais câblé ». Une fois la préférence activée, les requêtes partent.
    await poser(serviceWorker, { syncAuto: true });
    await site.page.reload();
    await expect.poll(() => site.api.length, { timeout: 15_000, intervals: [250] }).toBeGreaterThan(0);
    expect(site.api[0]?.chemin).toBe(CHEMIN_STATS);
  });

  test('activée sans synchro récente : stats puis pages jusqu’à la fin, collection mise à jour sans interaction (SC-002)', async ({ context, serviceWorker }) => {
    test.setTimeout(90_000);
    await poser(serviceWorker, { collection: { version: 3, cartes: [carteLocale({ })] }, syncAuto: true });
    const site = await ouvrirSite(context, {
      [CHEMIN_STATS]: { corps: STATS },
      [CHEMIN_PAGE(0)]: { corps: PAGE_0 },
      [CHEMIN_PAGE(1)]: { corps: PAGE_VIDE },
      [CHEMIN_PRIX]: { corps: PRIX },
    });

    // Prix en dernier : la carte à décider est relevée une fois la collection lue.
    await expect.poll(() => site.api.length, { timeout: 60_000, intervals: [500] }).toBeGreaterThanOrEqual(5);
    // Aucune page au-delà de la fin : la page 0 est courte, la lecture s'arrête là (le site refuse la page suivante en 403).
    // Lecture complète, puis relecture des stats et de la page 0 pour détecter un changement en cours de lecture, puis les prix.
    expect(chemins(site.api).slice(0, 5)).toEqual([CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_PRIX]);
    expect(chemins(site.api)).not.toContain(CHEMIN_PAGE(1));

    await expect
      .poll(async () => (await cartesStockees(serviceWorker)).find((c) => c.id === ID_CARTE)?.valeurMarchande, { timeout: 10_000 })
      .toBe(276);
    const carte = (await cartesStockees(serviceWorker)).find((c) => c.id === ID_CARTE);
    expect(carte?.quantite).toBe(2);
    expect(carte?.etiquettesSite).toEqual(['Étiquette fictive']);
    verifierLectureSeule(site.api);
  });

  test('carte vendue depuis la dernière synchro : retirée de la collection locale, sans page au-delà de la fin ni 403', async ({ context, serviceWorker }) => {
    test.setTimeout(90_000);
    const stats = JSON.stringify({ total: 2, totalUnique: 1, tagOptions: [{ id: 'tag-fictif-1', name: 'Étiquette fictive', color: '#808080', cardCount: 1 }] });
    await poser(serviceWorker, {
      collection: { version: 3, cartes: [carteLocale({ }), carteLocale({ id: 'C|Carte vendue', titre: 'Carte vendue', rarete: 'C', idsSite: ['exemplaire-vendu'], })] },
      syncAuto: true,
    });
    const site = await ouvrirSite(context, {
      [CHEMIN_STATS]: { corps: stats },
      [CHEMIN_PAGE(0)]: { corps: PAGE_0 },
      [CHEMIN_PAGE(1)]: { corps: '{"error":"forbidden"}', statut: 403 },
      [CHEMIN_PRIX]: { corps: PRIX },
    });
    await expect
      .poll(async () => (await cartesStockees(serviceWorker)).map((c) => c.id), { timeout: 60_000, intervals: [500] })
      .toEqual([ID_CARTE]);
    await expect.poll(() => chemins(site.api).includes(CHEMIN_PRIX), { timeout: 30_000, intervals: [250] }).toBe(true);
    expect(chemins(site.api)).not.toContain(CHEMIN_PAGE(1));
    const etat = await serviceWorker.evaluate(
      async () => ((await chrome.storage.local.get('etatSynchro')).etatSynchro as { arretJusqua: number | null } | undefined)?.arretJusqua ?? null,
    );
    expect(etat).toBeNull();
    verifierLectureSeule(site.api);
  });

  test('403 isolé sur le prix d\u2019une carte : ignoré, la synchro va au bout sans pause', async ({ context, serviceWorker }) => {
    test.setTimeout(90_000);
    await poser(serviceWorker, { collection: { version: 3, cartes: [carteLocale({ })] }, syncAuto: true });
    const site = await ouvrirSite(context, {
      [CHEMIN_STATS]: { corps: STATS },
      [CHEMIN_PAGE(0)]: { corps: PAGE_0 },
      [CHEMIN_PRIX]: { corps: '{"error":"forbidden"}', statut: 403 },
    });
    await expect.poll(() => chemins(site.api).includes(CHEMIN_VENTES), { timeout: 60_000, intervals: [250] }).toBe(true);
    const arret = await serviceWorker.evaluate(
      async () => ((await chrome.storage.local.get('etatSynchro')).etatSynchro as { arretJusqua: number | null } | undefined)?.arretJusqua ?? null,
    );
    expect(arret).toBeNull();
    verifierLectureSeule(site.api);
  });

  test('total inchangé depuis la dernière synchro complète : toute la collection est relue quand même (stats, page, contrôle des stats), puis le relevé du marché (SC-003)', async ({ context, serviceWorker }) => {
    const maintenant = Date.now();
    await poser(serviceWorker, {
      collection: { version: 3, cartes: [carteLocale({ quantite: 2, etiquettesSite: ['Étiquette fictive'], valeurMarchande: 276 })] },
      syncAuto: true,
      derniereSynchro: maintenant - 3_600_000,
      etatSynchro: {
        version: 1,
        total: 1,
        totalUnique: 1,
        signatureEtiquettes: 'tag-fictif-1:1',
        derniereComplete: maintenant - 3_600_000,
        arretJusqua: null,
        requetes: [],
        cardIds: { [ID_CARTE]: 'carte-fictive-1' },
        prix: { [ID_CARTE]: { valeur: 276, releveLe: maintenant - 3_600_000 } },
      },
    });
    const site = await ouvrirSite(context, { [CHEMIN_STATS]: { corps: STATS }, [CHEMIN_PAGE(0)]: { corps: PAGE_0 } });
    // Avec 0,2 s entre deux requêtes, les trois GET partent en moins d'une demi-seconde : on attend le premier, la suite exacte est vérifiée ci-dessous.
    await expect.poll(() => site.api.length, { intervals: [250] }).toBeGreaterThanOrEqual(1);
    await site.page.waitForTimeout(PLUS_QU_UNE_CADENCE_MS);
    // Synchro terminée (lecture complète sans prix à relever), puis marketplace/mine, puis un seul GET vers le listing du marché.
    await expect.poll(() => chemins(site.api), { timeout: 45_000, intervals: [250] }).toEqual([CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_VENTES, CHEMIN_MARCHE]);
    await site.page.waitForTimeout(PLUS_QU_UNE_CADENCE_MS);
    expect(chemins(site.api)).toEqual([CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_STATS, CHEMIN_PAGE(0), CHEMIN_VENTES, CHEMIN_MARCHE]);
    verifierLectureSeule(site.api);
  });

  test('réponse 403 : arrêt immédiat, statut visible dans la page de gestion (SC-006)', async ({ context, serviceWorker, pageCollection }) => {
    await poser(serviceWorker, { collection: { version: 3, cartes: [carteLocale({ })] }, syncAuto: true });
    const site = await ouvrirSite(context, {
      [CHEMIN_STATS]: { corps: '{"error":"forbidden"}', statut: 403 },
      [CHEMIN_PAGE(0)]: { corps: PAGE_0 },
    });
    await expect.poll(() => site.api.length, { intervals: [250] }).toBe(1);
    await site.page.waitForTimeout(PLUS_QU_UNE_CADENCE_MS);
    expect(chemins(site.api)).toEqual([CHEMIN_STATS]);
    verifierLectureSeule(site.api);

    await allerA(pageCollection, 'synchro');
    await pageCollection.reload();
    await expect(pageCollection.getByTestId('etat-synchro-auto')).toHaveText(/Arrêtée\s: le site a refusé \(403\)/);
    const pause = await serviceWorker.evaluate(
      async () => ((await chrome.storage.local.get('etatSynchro')).etatSynchro as { arretJusqua: number | null } | undefined)?.arretJusqua ?? null,
    );
    expect(pause).toBeGreaterThan(Date.now() + 25 * 60_000);

    for (const { name, width, height } of [
      { name: 'mobile', width: 375, height: 812 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 800 },
    ]) {
      await pageCollection.setViewportSize({ width, height });
      expect(await pageCollection.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await pageCollection.getByTestId('synchro-auto').screenshot({ path: `test-results/captures/synchro-auto-arret-403-${name}.png` });
    }
  });
});
