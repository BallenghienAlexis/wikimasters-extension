import { allerA, chargerCartes, expect, test } from './extension';
import type { Page } from '@playwright/test';

// T-305 : onglet Tableau de bord (SC-001, SC-022, SC-027, SC-009). Données uniquement fictives.
//
// Contrat de sélecteurs pour l’implémentation (à respecter par dev-ui) :
//  - `data-testid="kpi"` sur chacune des 3 cartes de chiffres clés ;
//  - `data-testid="sante-synchro"` sur le bloc santé (pastille D-40 + âge) ;
//  - la bulle de détail porte `role="tooltip"` ; chaque segment la référence par `aria-describedby` ;
//  - `data-testid="resume"` reste présent dans l’onglet.

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812, colonnes: 1 },
  { name: 'tablet', width: 768, height: 1024, colonnes: 3 },
  { name: 'desktop', width: 1280, height: 800, colonnes: 3 },
];
const THEMES = ['light', 'dark'] as const;

// Total : 63 exemplaires, 5 cartes distinctes, valeur 40×10 + 20×5 + 1×2 + 1×3 = 505, une carte sur cinq sans prix (20 %).
const CARTES = [
  { id: 'td-1', titre: 'Cerf de démonstration', rarete: 'Commune', quantite: 40, valeurMarchande: 10 },
  { id: 'td-2', titre: 'Renard de démonstration', rarete: 'Rare', quantite: 20, valeurMarchande: 5 },
  { id: 'td-3', titre: 'Hibou de démonstration', rarete: 'Rare', quantite: 1, valeurMarchande: 2 },
  { id: 'td-4', titre: 'Lynx de démonstration', rarete: 'Commune', quantite: 1, valeurMarchande: null },
  { id: 'td-5', titre: 'Pie de démonstration', rarete: 'Commune', quantite: 1, valeurMarchande: 3 },
];

const kpis = (page: Page) => page.getByTestId('kpi');

async function ouvrir(page: Page, cartes: Record<string, unknown>[] = CARTES): Promise<void> {
  await chargerCartes(page, cartes);
  await allerA(page, 'tableau-de-bord');
}

test.describe('SC-001 : chiffres clés', () => {
  test('SC-001 : trois cartes KPI avec exemplaires, valeur et écarts', async ({ pageCollection }) => {
    await ouvrir(pageCollection);
    await expect(kpis(pageCollection)).toHaveCount(3);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    await expect(exemplaires).toContainText('63');
    await expect(exemplaires).toContainText('5'); // cartes distinctes
    await expect(kpis(pageCollection).filter({ hasText: /Valeur estimée/ })).toContainText('505');
    await expect(kpis(pageCollection).filter({ hasText: /Valeur estimée/ })).toContainText(/20\s*%/);
    await expect(kpis(pageCollection).filter({ hasText: /Écarts/ })).toBeVisible();
    await expect(pageCollection.getByTestId('resume')).toBeVisible();
  });

  test('SC-001 : collection vide, « — » à la place de la valeur, « Aucune carte », jamais NaN', async ({
    pageCollection,
  }) => {
    await ouvrir(pageCollection, []);
    await expect(pageCollection.getByText('Aucune carte', { exact: true })).toBeVisible();
    await expect(kpis(pageCollection).filter({ hasText: /Valeur estimée/ })).toContainText('—');
    await expect(kpis(pageCollection).filter({ hasText: /Exemplaires/ })).toContainText('0');
    const texte = await pageCollection.getByRole('tabpanel').innerText();
    expect(texte).not.toMatch(/NaN|Infinity|undefined/);
  });

  test('SC-001 : toutes les cartes sans prix, valeur « — » et part sans prix 100 %', async ({ pageCollection }) => {
    await ouvrir(pageCollection, [
      { id: 'sp-1', titre: 'Taupe de démonstration', rarete: 'Commune', quantite: 2, valeurMarchande: null },
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
    await expect(exemplaires.getByText(/^Exemplaires\s*: 63$/)).toHaveCount(1);
    const cache = exemplaires.locator('[aria-hidden="true"]').filter({ hasText: /\d/ });
    expect(await cache.count()).toBeGreaterThan(0);
  });

  test('SC-027 : mouvement coupé, valeur finale directe dès le premier rendu', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'reduce' });
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    // Aucun défilement : le compteur visible affiche tout de suite 63.
    await expect(exemplaires.locator('[aria-hidden="true"]').filter({ hasText: /^63$/ })).toHaveCount(1);
  });

  test('SC-027 : mouvement actif, le compteur atteint la valeur finale', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'no-preference' });
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    await expect(exemplaires.locator('[aria-hidden="true"]').filter({ hasText: /^63$/ })).toHaveCount(1);
  });
});

test.describe('retouche T-315 : compteur après réactivation des animations', () => {
  test('le compteur ne repart pas d’une ancienne valeur', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'no-preference' });
    await ouvrir(pageCollection);
    const exemplaires = kpis(pageCollection).filter({ hasText: /Exemplaires/ });
    const visible = exemplaires.locator('[aria-hidden="true"]').first();
    await expect(visible).toHaveText('63');
    await pageCollection.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: false } }));
    await expect(pageCollection.locator('html')).toHaveAttribute('data-animations', 'off');
    await pageCollection.evaluate(async () => {
      const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: Array<{ id: string; quantite: number }> } };
      for (const c of collection.cartes) if (c.id === 'td-1') c.quantite = 200;
      await chrome.storage.local.set({ collection });
    });
    await expect(visible).toHaveText('223');
    await visible.evaluate((el) => {
      const w = window as unknown as { __vus: string[] };
      w.__vus = [];
      new MutationObserver(() => w.__vus.push(el.textContent ?? '')).observe(el, { childList: true, characterData: true, subtree: true });
    });
    await pageCollection.evaluate(() => chrome.storage.local.set({ affichage: { version: 1, animations: true } }));
    await expect(pageCollection.locator('html')).not.toHaveAttribute('data-animations', 'off');
    await pageCollection.waitForTimeout(600);
    const vus = await pageCollection.evaluate(() => (window as unknown as { __vus: string[] }).__vus);
    expect(vus.filter((t) => t !== '223')).toEqual([]);
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
        await expect(kpis(pageCollection)).toHaveCount(3);
        const positions = await kpis(pageCollection).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
        expect(new Set(positions).size).toBe(bp.colonnes);
        const sans = await pageCollection.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        expect(sans).toBe(true);
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
});
