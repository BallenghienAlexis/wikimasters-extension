import { allerA, chargerCartes, expect, test } from './extension';

// T-318 : onglet Ventes (SC-024 File de vente, SC-009). Données uniquement fictives.
// Contrat de sélecteurs attendu du dev-ui :
//  - `data-testid="places-encheres"` : texte « occupées / max » (ex. « 1 / 5 ») ;
//  - `data-testid="file-vente"` : section conservée, tableau (role=table) avec colonnes « Carte », « Valeur », « Départ » ;
//  - `data-testid="ligne-vente"` : une ligne (ou carte empilée) par vente à lancer ;
//  - `data-testid="heures-fortes"` : présentation des heures fortes ;
//  - sous 600 px : `select` « Trier par » et bouton « Sens » (`aria-pressed`).

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

// Ordre par défaut de la file : valeur décroissante, égalités dans l’ordre d’insertion, inconnue en dernier.
const CARTES = [
  { id: 'v1', titre: 'Alpha fictif', rarete: 'SR', statut: 'vendre', valeurMarchande: 100, prixCible: 50 },
  { id: 'v2', titre: 'Bravo fictif', rarete: 'R', statut: 'vendre', valeurMarchande: 40, prixCible: 20 },
  { id: 'v3', titre: 'Charlie fictif', rarete: 'C', statut: 'vendre', valeurMarchande: 12, prixCible: 6 },
  { id: 'v4', titre: 'Écho fictif', rarete: 'C', statut: 'vendre', valeurMarchande: 12, prixCible: 6 },
  { id: 'v5', titre: 'Delta fictif', rarete: 'C', statut: 'vendre', valeurMarchande: null, prixCible: null },
];

const ORDRE_DEFAUT = ['Alpha', 'Bravo', 'Charlie', 'Écho', 'Delta'];

test.beforeEach(async ({ pageCollection }) => {
  await chargerCartes(pageCollection, CARTES);
  await allerA(pageCollection, 'ventes');
});

const lignes = (page: import('@playwright/test').Page) => page.getByTestId('file-vente').getByTestId('ligne-vente').locator('visible=true');
const enTete = (page: import('@playwright/test').Page, nom: RegExp) => page.getByTestId('file-vente').getByRole('columnheader', { name: nom });

test.describe('SC-024 : places d’enchères (AC1)', () => {
  test('SC-024 : « occupées / max » affiché, mis à jour quand le joueur note une mise en vente', async ({ pageCollection: page }) => {
    const places = page.getByTestId('places-encheres');
    await expect(places).toBeVisible();
    await expect(places).toContainText(/0\s*\/\s*5/);
    await lignes(page).first().getByRole('button', { name: 'Je l’ai mise aux enchères' }).click();
    await expect(places).toContainText(/1\s*\/\s*5/);
    await expect(page.getByTestId('file-vente')).toBeVisible();
  });

  test('SC-024 : les cartes en vente comptent comme occupées', async ({ pageCollection: page }) => {
    await chargerCartes(page, [
      { id: 'e1', titre: 'Écureuil fictif', statut: 'en-vente', valeurMarchande: 30 },
      { id: 'e2', titre: 'Faucon fictif', statut: 'en-vente', valeurMarchande: 30 },
      { id: 'v1', titre: 'Alpha fictif', statut: 'vendre', valeurMarchande: 100, prixCible: 50 },
    ]);
    await allerA(page, 'ventes');
    await expect(page.getByTestId('places-encheres')).toContainText(/2\s*\/\s*5/);
    await expect(page.getByTestId('file-vente')).toContainText('Écureuil fictif');
    await page.getByTestId('file-vente').getByRole('button', { name: 'Enchère terminée' }).first().click();
    await expect(page.getByTestId('places-encheres')).toContainText(/1\s*\/\s*5/);
  });
});

test.describe('SC-024 : file de vente en tableau triable (AC1)', () => {
  test('SC-024 : data-testid file-vente conservé, tableau avec colonnes Carte, Valeur, Départ', async ({ pageCollection: page }) => {
    const file = page.getByTestId('file-vente');
    await expect(file).toBeVisible();
    await expect(file.getByRole('table')).toBeVisible();
    for (const nom of [/^Carte/, /^Valeur/, /^Départ/]) await expect(enTete(page, nom)).toBeVisible();
    await expect(lignes(page)).toHaveCount(5);
    await expect(lignes(page)).toContainText(ORDRE_DEFAUT);
  });

  test('SC-024 : cycle croissant, décroissant, aucun et aria-sort à jour', async ({ pageCollection: page }) => {
    const valeur = enTete(page, /^Valeur/);
    const bouton = valeur.getByRole('button');
    await expect(valeur).toHaveAttribute('aria-sort', 'none');
    await expect(enTete(page, /^Carte/)).toHaveAttribute('aria-sort', 'none');

    await bouton.click();
    await expect(valeur).toHaveAttribute('aria-sort', 'ascending');
    // Tri stable : Charlie reste avant Écho (même valeur) ; valeur inconnue toujours en dernier.
    await expect(lignes(page)).toContainText(['Charlie', 'Écho', 'Bravo', 'Alpha', 'Delta']);

    await bouton.click();
    await expect(valeur).toHaveAttribute('aria-sort', 'descending');
    await expect(lignes(page)).toContainText(['Alpha', 'Bravo', 'Charlie', 'Écho', 'Delta']);

    await bouton.click();
    await expect(valeur).toHaveAttribute('aria-sort', 'none');
    await expect(lignes(page)).toContainText(ORDRE_DEFAUT);
  });

  test('SC-024 : un seul en-tête trié à la fois, comparaison française sur les titres', async ({ pageCollection: page }) => {
    await enTete(page, /^Valeur/).getByRole('button').click();
    await enTete(page, /^Carte/).getByRole('button').click();
    await expect(enTete(page, /^Carte/)).toHaveAttribute('aria-sort', 'ascending');
    await expect(enTete(page, /^Valeur/)).toHaveAttribute('aria-sort', 'none');
    // « Écho » se classe comme « Echo » : entre Delta et la fin, pas après Z.
    await expect(lignes(page)).toContainText(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Écho']);
  });

  test('SC-024 : le bouton d’en-tête fait 44 px et s’active à Entrée et à Espace', async ({ pageCollection: page }) => {
    const valeur = enTete(page, /^Valeur/);
    const bouton = valeur.getByRole('button');
    const boite = await bouton.boundingBox();
    expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
    await bouton.focus();
    await page.keyboard.press('Enter');
    await expect(valeur).toHaveAttribute('aria-sort', 'ascending');
    await page.keyboard.press('Space');
    await expect(valeur).toHaveAttribute('aria-sort', 'descending');
  });

  test('SC-024 : trier ne modifie ni le stockage ni les actions « Je l’ai mise aux enchères »', async ({ pageCollection: page }) => {
    const avant = await page.evaluate(async () => JSON.stringify((await chrome.storage.local.get('collection')).collection));
    await enTete(page, /^Valeur/).getByRole('button').click();
    const apres = await page.evaluate(async () => JSON.stringify((await chrome.storage.local.get('collection')).collection));
    expect(apres).toBe(avant);
    await expect(lignes(page).first().getByRole('button', { name: 'Je l’ai mise aux enchères' })).toBeVisible();
  });
});

test.describe('SC-024 : heures fortes et assistant (AC2)', () => {
  test('SC-024 : heures fortes présentées lisiblement, avec le nombre d’observations', async ({ pageCollection: page }) => {
    const heures = page.getByTestId('heures-fortes');
    await expect(heures).toBeVisible();
    await expect(heures).toContainText(/par défaut/i);
    await expect(heures).toContainText(/0 observation/);
  });

  test('SC-024 : l’assistant de tri reste accessible, contenu inchangé', async ({ pageCollection: page }) => {
    await page.getByRole('button', { name: 'Gérer mes thèmes et mes amis' }).click();
    await expect(page.getByRole('button', { name: 'Suivant' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /^Mon thème : #/ }).first()).toBeVisible();
  });
});

test.describe('SC-009 : sous 600 px, cartes empilées avec select et Sens (AC3)', () => {
  test('SC-009 : à 375 px le tableau devient liste de cartes, tri par « Trier par » et « Sens »', async ({ pageCollection: page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const file = page.getByTestId('file-vente');
    await expect(file.getByRole('table')).toBeHidden();
    await expect(lignes(page)).toHaveCount(5);

    const choix = file.getByLabel('Trier par');
    const sens = file.getByRole('button', { name: 'Sens' });
    await expect(choix).toBeVisible();
    await expect(sens).toBeVisible();
    const [bc, bs] = await Promise.all([choix.boundingBox(), sens.boundingBox()]);
    expect(bc?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(bs?.height ?? 0).toBeGreaterThanOrEqual(44);

    await choix.selectOption({ label: 'Valeur' });
    await expect(lignes(page)).toContainText(['Charlie', 'Écho', 'Bravo', 'Alpha', 'Delta']);
    await expect(sens).toHaveAttribute('aria-pressed', 'true');
    await sens.click();
    await expect(sens).toHaveAttribute('aria-pressed', 'false');
    await expect(lignes(page)).toContainText(['Alpha', 'Bravo', 'Charlie', 'Écho', 'Delta']);
    await expect(lignes(page).first().getByRole('button', { name: 'Je l’ai mise aux enchères' })).toBeVisible();
  });

  test('SC-009 : à 768 px le tableau complet est rétabli', async ({ pageCollection: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByTestId('file-vente').getByRole('table')).toBeVisible();
    await expect(page.getByTestId('file-vente').getByLabel('Trier par')).toBeHidden();
  });
});

test.describe('SC-009 : largeurs, thèmes et captures de l’onglet Ventes', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const { name, width, height } of BREAKPOINTS) {
      test(`SC-009 : ${colorScheme} ${name}, aucun défilement horizontal`, async ({ pageCollection: page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height });
        await allerA(page, 'ventes');
        await expect(page.getByTestId('places-encheres')).toBeVisible();
        await expect(page.getByTestId('heures-fortes')).toBeVisible();
        const { sw, cw } = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(sw).toBeLessThanOrEqual(cw);
        await page.screenshot({ path: `test-results/captures/ventes-${colorScheme}-${name}.png`, fullPage: true });
      });
    }
  }
});
