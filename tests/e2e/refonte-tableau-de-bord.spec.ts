import { allerA, chargerCartes, ecrireJeuRiche, expect, test } from './extension';
import type { Page } from '@playwright/test';

// T-305 : onglet Tableau de bord (SC-001, SC-022, SC-027, SC-009). Données uniquement fictives.
//
// Contrat de sélecteurs pour l’implémentation (à respecter par dev-ui) :
//  - `data-testid="kpi"` sur chacune des 4 cartes de chiffres clés ;
//  - `data-testid="barre-repartition"` sur la barre, `data-testid="legende-repartition"` sur la légende ;
//  - `data-testid="sante-synchro"` sur le bloc santé (pastille D-40 + âge) ;
//  - la bulle de détail porte `role="tooltip"` ; chaque segment la référence par `aria-describedby` ;
//  - `data-testid="resume"` reste présent dans l’onglet.

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812, colonnes: 1 },
  { name: 'tablet', width: 768, height: 1024, colonnes: 2 },
  { name: 'desktop', width: 1280, height: 800, colonnes: 4 },
];
const THEMES = ['light', 'dark'] as const;

// Total hors « en vente » : 62 exemplaires, 4 cartes distinctes, 1 en vente, valeur 40×10 + 20×5 + 1×2 = 502.
const CARTES = [
  { id: 'td-1', titre: 'Cerf de démonstration', rarete: 'Commune', quantite: 40, statut: 'garder', valeurMarchande: 10 },
  { id: 'td-2', titre: 'Renard de démonstration', rarete: 'Rare', quantite: 20, statut: 'vendre', valeurMarchande: 5 },
  { id: 'td-3', titre: 'Hibou de démonstration', rarete: 'Rare', quantite: 1, statut: 'echanger', valeurMarchande: 2 },
  { id: 'td-4', titre: 'Lynx de démonstration', rarete: 'Commune', quantite: 1, statut: 'a-trier', valeurMarchande: null },
  { id: 'td-5', titre: 'Pie de démonstration', rarete: 'Commune', quantite: 1, statut: 'en-vente', valeurMarchande: 3 },
];

const kpis = (page: Page) => page.getByTestId('kpi');
const barre = (page: Page) => page.getByTestId('barre-repartition');
const segment = (page: Page, nom: RegExp) => barre(page).getByRole('button', { name: nom });
const SEG_GARDER = /^Garder\s*: 40 exemplaires, \d+\s*%, valeur estimée 400/;
const SEG_ECHANGER = /^Échanger\s*: 1 exemplaires?, \d+\s*%/;

async function ouvrir(page: Page, cartes: Record<string, unknown>[] = CARTES): Promise<void> {
  await chargerCartes(page, cartes);
  await allerA(page, 'tableau-de-bord');
}

test.describe('SC-001 : chiffres clés', () => {
  test('SC-001 : quatre cartes KPI avec exemplaires, valeur, places et écarts', async ({ pageCollection }) => {
    await ouvrir(pageCollection);
    await expect(kpis(pageCollection)).toHaveCount(4);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    await expect(exemplaires).toContainText('62');
    await expect(exemplaires).toContainText('4'); // cartes distinctes
    await expect(exemplaires).toContainText(/\+\s*1 en vente/);
    await expect(kpis(pageCollection).filter({ hasText: /Valeur estimée/ })).toContainText('502');
    await expect(kpis(pageCollection).filter({ hasText: /Valeur estimée/ })).toContainText(/25\s*%/);
    await expect(kpis(pageCollection).filter({ hasText: /Places/ })).toContainText('/');
    await expect(kpis(pageCollection).filter({ hasText: /Écarts/ })).toBeVisible();
    await expect(pageCollection.getByTestId('resume')).toBeVisible();
  });

  test('SC-001 : collection vide, « — » à la place de la valeur, « Aucune carte » à la place de la barre, jamais NaN', async ({
    pageCollection,
  }) => {
    await ouvrir(pageCollection, []);
    await expect(pageCollection.getByText('Aucune carte', { exact: true })).toBeVisible();
    await expect(barre(pageCollection)).toHaveCount(0);
    await expect(kpis(pageCollection).filter({ hasText: /Valeur estimée/ })).toContainText('—');
    await expect(kpis(pageCollection).filter({ hasText: /Exemplaires/ })).toContainText('0');
    const texte = await pageCollection.getByRole('tabpanel').innerText();
    expect(texte).not.toMatch(/NaN|Infinity|undefined/);
  });

  test('SC-001 : toutes les cartes sans prix, valeur « — » et part sans prix 100 %', async ({ pageCollection }) => {
    await ouvrir(pageCollection, [
      { id: 'sp-1', titre: 'Taupe de démonstration', rarete: 'Commune', quantite: 2, statut: 'a-trier', valeurMarchande: null },
    ]);
    const valeur = kpis(pageCollection).filter({ hasText: /Valeur estimée/ });
    await expect(valeur).toContainText('—');
    await expect(valeur).toContainText(/100\s*%/);
    expect(await pageCollection.getByRole('tabpanel').innerText()).not.toMatch(/NaN/);
  });
});

test.describe('SC-027 : chiffres animés', () => {
  test('SC-027 : valeur finale dans le nom accessible, compteur aria-hidden', async ({ pageCollection }) => {
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    // Texte lu par les lecteurs d’écran : valeur finale, dès le premier rendu.
    await expect(exemplaires.getByText(/^Exemplaires\s*: 62$/)).toHaveCount(1);
    const cache = exemplaires.locator('[aria-hidden="true"]').filter({ hasText: /\d/ });
    expect(await cache.count()).toBeGreaterThan(0);
  });

  test('SC-027 : mouvement coupé, valeur finale directe dès le premier rendu', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'reduce' });
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    // Aucun défilement : le compteur visible affiche tout de suite 62.
    await expect(exemplaires.locator('[aria-hidden="true"]').filter({ hasText: /^62$/ })).toHaveCount(1);
  });

  test('SC-027 : mouvement actif, le compteur atteint la valeur finale', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'no-preference' });
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    await expect(exemplaires.locator('[aria-hidden="true"]').filter({ hasText: /^62$/ })).toHaveCount(1);
  });
});

test.describe('retouche T-315 : compteur après réactivation des animations', () => {
  test('le compteur ne repart pas d’une ancienne valeur', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'no-preference' });
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    const visible = exemplaires.locator('[aria-hidden="true"]').first();
    await expect(visible).toHaveText('62');
    await pageCollection.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: false } }));
    await expect(pageCollection.locator('html')).toHaveAttribute('data-animations', 'off');
    await pageCollection.evaluate(async () => {
      const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: Array<{ id: string; quantite: number }> } };
      for (const c of collection.cartes) if (c.id === 'td-1') c.quantite = 200;
      await chrome.storage.local.set({ collection });
    });
    await expect(visible).toHaveText('222');
    await visible.evaluate((el) => {
      const w = window as unknown as { __vus: string[] };
      w.__vus = [];
      new MutationObserver(() => w.__vus.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await pageCollection.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: true } }));
    await expect(pageCollection.locator('html')).not.toHaveAttribute('data-animations', 'off');
    await pageCollection.waitForTimeout(600);
    const vus = await pageCollection.evaluate(() => (window as unknown as { __vus: string[] }).__vus);
    expect(vus.filter((t) => t !== '222')).toEqual([]);
  });
});

test.describe('SC-022 : barre de répartition', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('SC-022 : barre de 48 px, un bouton par statut présent, statut à 0 absent', async ({ pageCollection }) => {
    await ouvrir(pageCollection);
    const b = barre(pageCollection);
    await expect(b).toBeVisible();
    expect((await b.boundingBox())?.height).toBeGreaterThanOrEqual(47);
    expect((await b.boundingBox())?.height).toBeLessThanOrEqual(49 + 8); // zoom éventuel exclu au repos
    await expect(b.getByRole('button')).toHaveCount(5); // à trier, garder, échanger, vendre, en vente
    await expect(segment(pageCollection, /^Défausser/)).toHaveCount(0);
    await expect(segment(pageCollection, SEG_GARDER)).toBeVisible();
    await expect(segment(pageCollection, /^Vendre\s*: 20 exemplaires/)).toBeVisible();
  });

  test('SC-022 : étiquette interne selon la largeur, tabindex -1 et légende pour les segments étroits', async ({
    pageCollection,
  }) => {
    await ouvrir(pageCollection);
    const large = segment(pageCollection, SEG_GARDER);
    expect((await large.boundingBox())?.width).toBeGreaterThanOrEqual(96);
    await expect(large).toContainText(/Garder\s+\d+\s*%/);
    await expect(large).not.toHaveAttribute('tabindex', '-1');

    const etroit = segment(pageCollection, SEG_ECHANGER);
    expect((await etroit.boundingBox())?.width).toBeLessThan(96);
    await expect(etroit).toHaveAttribute('tabindex', '-1');
    await expect(etroit).not.toContainText(/Échanger/);

    // Légende : exactement les segments étroits (échanger, à trier, en vente), boutons de 44 px.
    const legende = pageCollection.getByTestId('legende-repartition');
    const boutons = legende.getByRole('button');
    await expect(boutons).toHaveCount(3);
    for (const nom of [/^Échanger\s+\d+\s*%/, /^À trier\s+\d+\s*%/, /^En vente\s+\d+\s*%/]) {
      const bouton = legende.getByRole('button', { name: nom });
      await expect(bouton).toHaveCount(1);
      const boite = await bouton.boundingBox();
      expect(boite?.height).toBeGreaterThanOrEqual(44);
      expect(boite?.width).toBeGreaterThanOrEqual(44);
    }
    await expect(legende.getByRole('button', { name: /^Garder/ })).toHaveCount(0);

    // Un bouton de légende ouvre la même bulle.
    await legende.getByRole('button', { name: /^Échanger\s+\d+\s*%/ }).click();
    await expect(pageCollection.getByRole('tooltip')).toContainText('Hibou de démonstration');
  });

  test('SC-022 : survol, zoom, autres segments à saturate(.45), bulle en texte seul', async ({ pageCollection }) => {
    await ouvrir(pageCollection, [
      ...CARTES.slice(1),
      { ...CARTES[0], titre: '<img src=x onerror=alert(1)>' },
    ]);
    const garder = segment(pageCollection, SEG_GARDER);
    const vendre = segment(pageCollection, /^Vendre\s*: 20 exemplaires/);
    await expect(vendre).toHaveCSS('filter', 'none'); // au repos : pleine saturation
    const avant = (await garder.boundingBox())!;
    await garder.hover();
    const bulle = pageCollection.getByRole('tooltip');
    await expect(bulle).toBeVisible();
    await expect(bulle).toContainText('40 exemplaires');
    await expect(bulle).toContainText('<img src=x onerror=alert(1)>');
    await expect(bulle.locator('img')).toHaveCount(0);
    await expect(vendre).toHaveCSS('filter', /saturate\(0\.45\)/);
    await expect(garder).not.toHaveCSS('filter', /saturate/);
    await expect.poll(async () => (await garder.boundingBox())!.height).toBeGreaterThan(avant.height);
    // Le texte reste opaque (estompage par saturation, jamais par opacité).
    await expect(vendre).toHaveCSS('opacity', '1');
    // Reste ouverte tant que le pointeur est sur la bulle.
    const boite = (await bulle.boundingBox())!;
    await pageCollection.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
    await expect(bulle).toBeVisible();
    // Se ferme quand le pointeur quitte segment et bulle.
    await pageCollection.mouse.move(5, 5);
    await expect(bulle).toHaveCount(0);
    await expect(vendre).toHaveCSS('filter', 'none');
  });

  test('SC-022 : au clavier, focus ouvre la bulle (aria-describedby) et Échap la ferme en rendant le focus au segment', async ({
    pageCollection,
  }) => {
    await ouvrir(pageCollection);
    const garder = segment(pageCollection, SEG_GARDER);
    await garder.focus();
    const bulle = pageCollection.getByRole('tooltip');
    await expect(bulle).toBeVisible();
    const id = await bulle.getAttribute('id');
    expect(id).toBeTruthy();
    await expect(garder).toHaveAttribute('aria-describedby', id as string);
    await pageCollection.keyboard.press('Escape');
    await expect(bulle).toHaveCount(0);
    await expect(garder).toBeFocused();
    // Échap ne ferme rien d’autre : l’onglet reste affiché.
    await expect(pageCollection.getByRole('tab', { name: /^Tableau de bord/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('SC-022 : les segments étroits sont atteints au clavier par la légende seulement', async ({ pageCollection }) => {
    await ouvrir(pageCollection);
    const legende = pageCollection.getByTestId('legende-repartition');
    await legende.getByRole('button').first().focus();
    await expect(legende.getByRole('button').first()).toBeFocused();
    await expect(pageCollection.getByRole('tooltip')).toBeVisible();
    await pageCollection.keyboard.press('Escape');
    await expect(pageCollection.getByRole('tooltip')).toHaveCount(0);
  });

  test('SC-022 : mouvement coupé, contour paper de 3 px au lieu du zoom', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'reduce' });
    await ouvrir(pageCollection);
    const garder = segment(pageCollection, SEG_GARDER);
    const avant = (await garder.boundingBox())!;
    await garder.hover();
    await expect(pageCollection.getByRole('tooltip')).toBeVisible();
    const apres = (await garder.boundingBox())!;
    expect(Math.abs(apres.height - avant.height)).toBeLessThan(1);
    await expect(garder).toHaveCSS('outline-width', '3px');
  });
});

test.describe('SC-001 : santé de la synchro', () => {
  test('SC-001 : pastille D-40 et âge de la dernière synchro', async ({ pageCollection }) => {
    await ouvrir(pageCollection);
    const sante = pageCollection.getByTestId('sante-synchro');
    await expect(sante).toBeVisible();
    await expect(sante).toContainText(/À jour|En cours|Arrêtée|Erreur/);
    await expect(sante).toContainText('jamais');
  });

  test('retouche T-305 : synchro coupée, pastille « Arrêtée » et jamais « À jour »', async ({ pageCollection }) => {
    await pageCollection.evaluate(() => chrome.storage.local.set({ syncAuto: false }));
    await ouvrir(pageCollection);
    const sante = pageCollection.getByTestId('sante-synchro');
    await expect(sante).toContainText('Arrêtée');
    await expect(sante).not.toContainText('À jour');
  });

  test('SC-001 : synchro arrêtée, lien vers #synchro', async ({ pageCollection }) => {
    await pageCollection.evaluate(() =>
      chrome.storage.local.set({
        etatSynchro: {
          version: 1,
          total: null,
          totalUnique: null,
          signatureEtiquettes: null,
          derniereComplete: null,
          arretJusqua: Date.now() + 3_600_000,
          requetes: [],
          cardIds: {},
          prix: {},
        },
      }),
    );
    await ouvrir(pageCollection);
    const lien = pageCollection.getByTestId('sante-synchro').getByRole('link');
    await expect(lien.first()).toHaveAttribute('href', '#synchro');
  });
});

test.describe('SC-009 : colonnes KPI, débordement, deux thèmes, captures', () => {
  for (const bp of BREAKPOINTS) {
    for (const theme of THEMES) {
      test(`SC-009 : ${bp.name} ${theme} : ${bp.colonnes} colonne(s), pas de défilement horizontal`, async ({ pageCollection }) => {
        await pageCollection.setViewportSize({ width: bp.width, height: bp.height });
        await pageCollection.emulateMedia({ colorScheme: theme });
        await ouvrir(pageCollection);
        await expect(kpis(pageCollection)).toHaveCount(4);
        const positions = await kpis(pageCollection).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
        expect(new Set(positions).size).toBe(bp.colonnes);
        const sans = await pageCollection.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        expect(sans).toBe(true);
        // Légende en boutons de 44 px, même à 375 px.
        const legende = pageCollection.getByTestId('legende-repartition');
        if (await legende.count()) {
          for (const h of await legende.getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
            expect(h).toBeGreaterThanOrEqual(44);
          }
        }
        await pageCollection.screenshot({
          path: `test-results/captures/tableau-de-bord-${theme}-${bp.name}.png`,
          fullPage: true,
        });
      });
    }
  }

  test('SC-009 : collection vide sans débordement à 375 px', async ({ pageCollection }) => {
    await pageCollection.setViewportSize({ width: 375, height: 812 });
    await ouvrir(pageCollection, []);
    expect(await pageCollection.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

test.describe('Alignement maquette : en-tête et rareté', () => {
  test('en-tête sur une ligne et tableau par rareté (liste empilée sous 600 px)', async ({ pageCollection }) => {
    await ecrireJeuRiche(pageCollection);
    await expect(pageCollection.getByTestId('entete-synchro')).toBeVisible();
    await pageCollection.setViewportSize({ width: 1280, height: 800 });
    await expect(pageCollection.getByTestId('tableau-raretes').locator('table')).toBeVisible();
    await pageCollection.setViewportSize({ width: 375, height: 812 });
    await expect(pageCollection.getByTestId('tableau-raretes').locator('table')).toBeHidden();
    await expect(pageCollection.getByTestId('tableau-raretes').getByRole('list')).toBeVisible();
  });
});
});
