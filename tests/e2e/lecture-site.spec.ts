import type { BrowserContext, Page, Worker } from '@playwright/test';
import path from 'node:path';
import { allerA, expect, test } from './extension';

// Le site est entièrement simulé : ces tests ne contactent jamais le vrai WikiMasters.
const PAGE_FICTIVE = path.resolve('tests/e2e/fixtures/collection-site.html');
const LOUTRE = 'UR|Loutre fictive';

interface CarteStockee {
  id: string;
  quantite: number;
  favori: boolean;
  statut: string;
  note: string;
  valeurMarchande: number | null;
}

async function ouvrirSite(context: BrowserContext, chemin = '/collection'): Promise<{ page: Page; requetes: string[] }> {
  const requetes: string[] = [];
  // Toute autre requête externe fait échouer le test : la CI ne contacte jamais le vrai site.
  await context.route(
    (url) => url.protocol.startsWith('http') && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1',
    (route) => route.abort(),
  );
  await context.route('https://www.wiki-masters.com/**', (route) => {
    requetes.push(route.request().method());
    return route.fulfill({ path: PAGE_FICTIVE, contentType: 'text/html' });
  });
  const page = await context.newPage();
  await page.goto(`https://www.wiki-masters.com${chemin}`);
  return { page, requetes };
}

const cartesStockees = (worker: Worker): Promise<CarteStockee[]> =>
  worker.evaluate(async () => {
    const { collection } = await chrome.storage.local.get('collection');
    return ((collection as { cartes: CarteStockee[] } | undefined)?.cartes ?? []) as CarteStockee[];
  });

const ecrireCollection = (worker: Worker, cartes: object[]): Promise<void> =>
  worker.evaluate((c) => chrome.storage.local.set({ collection: { version: 1, cartes: c } }), cartes);

const carte = (surcharge: object): object => ({
  id: LOUTRE,
  titre: 'Loutre fictive',
  rarete: 'UR',
  quantite: 1,
  url: null,
  favori: true,
  statut: 'a-trier',
  prixCible: null,
  note: '',
  ...surcharge,
});

// La synchronisation automatique est activée par défaut : ces tests vérifient la seule lecture de la page, sans requête vers /api/.
test.beforeEach(async ({ serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.set({ syncAuto: false }));
});

test.describe('lecture de la page Collection', () => {
  test('ajoute les cartes affichées, avec exemplaires et favoris', async ({ context, serviceWorker }) => {
    await ouvrirSite(context);
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    const cartes = await cartesStockees(serviceWorker);
    expect(cartes.find((c) => c.id === LOUTRE)).toMatchObject({ quantite: 1, favori: true, statut: 'a-trier' });
    expect(cartes.find((c) => c.id === 'C|Nashi fictif')).toMatchObject({ quantite: 2, favori: false });
  });

  test('lit aussi une page chargée sans rechargement', async ({ context, serviceWorker }) => {
    const { page } = await ouvrirSite(context);
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    await page.evaluate(() => {
      const modele = document.querySelector<HTMLTemplateElement>('#page-suivante');
      document.querySelector('#grille')?.replaceChildren(modele!.content.cloneNode(true));
    });
    await expect.poll(async () => (await cartesStockees(serviceWorker)).map((c) => c.id)).toContain('SR|Carte de la page 2');
    expect((await cartesStockees(serviceWorker)).length).toBe(3);
  });

  test('ne lit rien hors de la page Collection', async ({ context, serviceWorker }) => {
    const { page } = await ouvrirSite(context, '/pulls');
    await page.waitForTimeout(1000);
    expect(await cartesStockees(serviceWorker)).toEqual([]);
  });

  test('conserve l’édition locale lors d’une nouvelle lecture', async ({ context, serviceWorker }) => {
    await ecrireCollection(serviceWorker, [carte({ statut: 'vendre', prixCible: 120, note: 'Ma note', favori: false })]);
    await ouvrirSite(context);
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    expect((await cartesStockees(serviceWorker)).find((c) => c.id === LOUTRE)).toMatchObject({
      statut: 'vendre',
      note: 'Ma note',
      favori: true,
    });
  });

  test('n’émet que le chargement de la page et ne touche à aucun bouton', async ({ context, serviceWorker }) => {
    const { page, requetes } = await ouvrirSite(context);
    let clics = 0;
    await page.exposeFunction('compterClic', () => {
      clics += 1;
    });
    await page.evaluate(() => {
      document.addEventListener('click', () => (window as unknown as { compterClic: () => void }).compterClic(), true);
    });
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    await page.waitForTimeout(800);
    expect(requetes).toEqual(['GET']);
    expect(clics).toBe(0);
  });
});

test.describe('suivi de la synchronisation', () => {
  const tournerPage = (page: Page, numero: number, total = 3): Promise<void> =>
    page.evaluate(
      ([n, t]) => {
        const modele = document.querySelector<HTMLTemplateElement>('#page-suivante');
        document.querySelector('#grille')?.replaceChildren(modele!.content.cloneNode(true));
        document.querySelector('#pagination')!.textContent = `Page ${n} / ${t}`;
      },
      [numero, total],
    );

  test('indique sur le site et dans l’extension les pages lues et la suivante', async ({ context, pageCollection }) => {
    await allerA(pageCollection, 'synchro');
    const { page } = await ouvrirSite(context);
    const indicateur = page.locator('.wm-synchro');
    await expect(indicateur).toHaveAttribute('data-wm-texte', /1 page lue sur 3\. Prochaine page à ouvrir : 2/);

    await tournerPage(page, 3);
    await expect(indicateur).toHaveAttribute('data-wm-texte', /2 pages lues sur 3\. Prochaine page à ouvrir : 2/);
    await expect(pageCollection.getByTestId('synchro')).toContainText('2 pages lues sur 3');

    await tournerPage(page, 2);
    await expect(indicateur).toHaveAttribute('data-wm-texte', /Collection entière lue/);
    await expect(pageCollection.getByTestId('synchro')).toContainText('Collection entière lue');
  });

  test('l’indicateur ne relance pas de lecture et n’émet aucune requête', async ({ context, serviceWorker }) => {
    const { page, requetes } = await ouvrirSite(context);
    await expect(page.locator('.wm-synchro')).toHaveCount(1);
    await serviceWorker.evaluate(() => {
      const compteur = globalThis as unknown as { ecritures: number };
      compteur.ecritures = 0;
      chrome.storage.onChanged.addListener(() => {
        compteur.ecritures += 1;
      });
    });
    await page.waitForTimeout(1500);
    expect(await serviceWorker.evaluate(() => (globalThis as unknown as { ecritures: number }).ecritures)).toBe(0);
    expect(requetes).toEqual(['GET']);
  });

  test('ne change pas de page tout seul', async ({ context }) => {
    const { page } = await ouvrirSite(context);
    await expect(page.locator('.wm-synchro')).toHaveCount(1);
    await page.waitForTimeout(1500);
    await expect(page.locator('#pagination')).toHaveText('Page 1 / 3');
  });
});

test.describe('relevé de la valeur marchande', () => {
  const ouvrirFenetre = (page: Page): Promise<void> =>
    page.evaluate(() => {
      const fenetre = document.createElement('div');
      fenetre.className = 'fixed';
      fenetre.innerHTML = `
        <h2>Mettre aux enchères</h2><p>Enchères actives : 0/5</p>
        <p>UR</p><p>Loutre fictive</p><p>mammifère imaginaire</p><p>8 885</p><p>9 526</p>
        <p>Loutre fictive</p><p>MARCHÉ · ULTRA RARE</p><div><p>MOYENNE</p><p>19</p></div>
        <p>MISE DE DÉPART</p><button id="annuler">Annuler</button><button id="lancer">Lancer l'enchère</button>`;
      document.body.append(fenetre);
    });

  test('relève la moyenne quand le joueur ouvre la fenêtre, sans la valider', async ({ context, serviceWorker }) => {
    const { page, requetes } = await ouvrirSite(context);
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    await page.evaluate(() => {
      (window as unknown as { clics: number }).clics = 0;
      document.addEventListener('click', () => {
        (window as unknown as { clics: number }).clics += 1;
      }, true);
    });
    await ouvrirFenetre(page);
    await expect
      .poll(async () => (await cartesStockees(serviceWorker)).find((c) => c.id === LOUTRE)?.valeurMarchande)
      .toBe(19);
    await expect(page.locator('#lancer')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { clics: number }).clics)).toBe(0);
    expect(requetes).toEqual(['GET']);
  });

  test('reclasse une carte de l’assistant dès que sa valeur est connue', async ({ context, serviceWorker }) => {
    await ecrireCollection(serviceWorker, [carte({ favori: false, decidePar: 'assistant' })]);
    const { page } = await ouvrirSite(context);
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    await serviceWorker.evaluate(async () => {
      const { collection } = await chrome.storage.local.get('collection');
      const donnees = collection as { cartes: { id: string; favori: boolean }[] };
      for (const c of donnees.cartes) c.favori = false;
      await chrome.storage.local.set({ collection: donnees });
    });
    await page.evaluate(() => document.querySelector('.group button')?.setAttribute('aria-label', 'Ajouter aux favoris'));
    await ouvrirFenetre(page);
    await expect.poll(async () => (await cartesStockees(serviceWorker)).find((c) => c.id === LOUTRE)?.statut).toBe('vendre');
  });

  test('ne touche pas au statut d’une décision manuelle', async ({ context, serviceWorker }) => {
    await ecrireCollection(serviceWorker, [carte({ statut: 'garder', decidePar: 'moi' })]);
    const { page } = await ouvrirSite(context);
    await ouvrirFenetre(page);
    await expect
      .poll(async () => (await cartesStockees(serviceWorker)).find((c) => c.id === LOUTRE)?.valeurMarchande)
      .toBe(19);
    expect((await cartesStockees(serviceWorker)).find((c) => c.id === LOUTRE)?.statut).toBe('garder');
  });
});

test.describe('repères sur le site', () => {
  test('affiche le statut et le prix, et se met à jour sans recharger', async ({ context, serviceWorker }) => {
    await ecrireCollection(serviceWorker, [carte({ statut: 'vendre', prixCible: 120 })]);
    const { page } = await ouvrirSite(context);
    const repere = page.locator('.wm-repere');
    await expect(repere).toHaveAttribute('data-wm-texte', 'Vendre · 120');
    await expect(repere).toHaveClass(/wm-repere-vendre/);

    await ecrireCollection(serviceWorker, [carte({ statut: 'garder' })]);
    await expect(repere).toHaveAttribute('data-wm-texte', 'Garder');

    await ecrireCollection(serviceWorker, [carte({ statut: 'a-trier' })]);
    await expect(repere).toHaveCount(0);
  });

  test('un repère ne relance pas de lecture en boucle', async ({ context, serviceWorker }) => {
    await ecrireCollection(serviceWorker, [carte({ statut: 'vendre' })]);
    const { page } = await ouvrirSite(context);
    await expect(page.locator('.wm-repere')).toHaveCount(1);
    // La première lecture écrit légitimement : on compte ce qui vient après.
    await expect.poll(async () => (await cartesStockees(serviceWorker)).length).toBe(2);
    await serviceWorker.evaluate(() => {
      const compteur = globalThis as unknown as { ecritures: number };
      compteur.ecritures = 0;
      chrome.storage.onChanged.addListener(() => {
        compteur.ecritures += 1;
      });
    });
    await page.waitForTimeout(1500);
    expect(await serviceWorker.evaluate(() => (globalThis as unknown as { ecritures: number }).ecritures)).toBe(0);
  });

  test('la page de collection se met à jour pendant la lecture', async ({ context, pageCollection }) => {
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByText('Votre collection est vide')).toBeVisible();
    await ouvrirSite(context);
    await expect(pageCollection.getByTestId('tableau-cartes').getByText('Loutre fictive')).toBeVisible();
    await expect(pageCollection.getByText('Favori, verrouillé sur le site')).toBeVisible();
  });
});
