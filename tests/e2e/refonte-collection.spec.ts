import type { Page } from '@playwright/test';
import { allerA, chargerCartes, expect, test } from './extension';

// T-308 : onglet Collection (SC-021, SC-020, SC-024, SC-011, SC-009). Données uniquement fictives.
//
// Contrat de sélecteurs attendu de l’implémentation :
// - tableau des cartes : `table` de data-testid `tableau-cartes`, en-têtes triables (EnTeteTriable) « Titre »,
//   « Rareté », « Quantité », « Statut », « Valeur » ; une ligne `tr` par carte rendue (corps), 1re cellule = titre.
// - sous 600 px : `select` « Trier par » + bouton « Sens » (aria-pressed).
// - analyses : data-testid `analyse-doublons`, `analyse-a-trier`, `analyse-defaussables`,
//   `analyse-valeur-par-decision`, `analyse-plus-cheres`, `analyse-themes`.
// - évolution : data-testid `evolution` ; colonnes `evolution-colonne` (attribut data-jour), trous `evolution-trou`,
//   valeur de la colonne survolée ou focalisée dans `evolution-valeur`, tableau alternatif `table.sr-only`.

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];
const THEMES = ['light', 'dark'] as const;

const lignes = (page: Page) => page.getByTestId('tableau-cartes').locator('tbody tr');

async function titres(page: Page): Promise<string[]> {
  return lignes(page).evaluateAll((trs) => trs.map((tr) => (tr.querySelector('td, th')?.textContent ?? '').trim()));
}

const entete = (page: Page, nom: string) => page.getByTestId('tableau-cartes').getByRole('columnheader', { name: nom });

const CARTES = [
  { id: 'a', titre: 'Zèbre fictif', rarete: 'Rare', quantite: 1, valeurMarchande: 10 },
  { id: 'b', titre: 'Élan fictif', rarete: 'Commune', quantite: 3, valeurMarchande: null },
  { id: 'c', titre: 'Abeille fictive', rarete: 'Rare', quantite: 2, valeurMarchande: 4 },
  { id: 'd', titre: 'Mouette fictive', rarete: 'Commune', quantite: 2, valeurMarchande: 25, statut: 'vendre' },
];

test.describe('SC-024 : tableau triable', () => {
  test.beforeEach(async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await allerA(pageCollection, 'collection');
  });

  test('SC-024 : colonnes du tableau et aria-sort initial à none', async ({ pageCollection }) => {
    for (const nom of ['Titre', 'Rareté', 'Quantité', 'Statut', 'Valeur']) {
      await expect(entete(pageCollection, nom)).toHaveAttribute('aria-sort', 'none');
    }
    await expect(lignes(pageCollection)).toHaveCount(4);
  });

  test('SC-024 : cycle croissant, décroissant, aucun, avec aria-sort et comparaison française', async ({ pageCollection }) => {
    const origine = await titres(pageCollection);
    const bouton = entete(pageCollection, 'Titre').getByRole('button');
    await bouton.click();
    await expect(entete(pageCollection, 'Titre')).toHaveAttribute('aria-sort', 'ascending');
    const asc = await titres(pageCollection);
    expect(['Abeille', 'Élan', 'Mouette', 'Zèbre'].map((m, i) => asc[i]?.includes(m))).toEqual([true, true, true, true]);
    await bouton.click();
    await expect(entete(pageCollection, 'Titre')).toHaveAttribute('aria-sort', 'descending');
    expect((await titres(pageCollection))[0]).toContain('Zèbre');
    await bouton.click();
    await expect(entete(pageCollection, 'Titre')).toHaveAttribute('aria-sort', 'none');
    expect(await titres(pageCollection)).toEqual(origine);
  });

  test('SC-024 : une seule colonne triée à la fois, Entrée et Espace activent', async ({ pageCollection }) => {
    await entete(pageCollection, 'Quantité').getByRole('button').focus();
    await pageCollection.keyboard.press('Enter');
    await expect(entete(pageCollection, 'Quantité')).toHaveAttribute('aria-sort', 'ascending');
    await entete(pageCollection, 'Titre').getByRole('button').focus();
    await pageCollection.keyboard.press('Space');
    await expect(entete(pageCollection, 'Titre')).toHaveAttribute('aria-sort', 'ascending');
    await expect(entete(pageCollection, 'Quantité')).toHaveAttribute('aria-sort', 'none');
  });

  test('SC-024 : valeurs inconnues en dernier dans les deux sens, tri stable', async ({ pageCollection }) => {
    const bouton = entete(pageCollection, 'Valeur').getByRole('button');
    await bouton.click();
    let t = await titres(pageCollection);
    expect(t[0]).toContain('Abeille');
    expect(t[3]).toContain('Élan');
    await bouton.click();
    t = await titres(pageCollection);
    expect(t[0]).toContain('Mouette');
    expect(t[3]).toContain('Élan');
    // Stabilité : à quantité égale (2), l’ordre d’origine est gardé (Abeille avant Mouette).
    await bouton.click();
    await entete(pageCollection, 'Quantité').getByRole('button').click();
    t = await titres(pageCollection);
    expect(t[0]).toContain('Zèbre');
    expect(t.findIndex((x) => x.includes('Abeille'))).toBeLessThan(t.findIndex((x) => x.includes('Mouette')));
  });

  test('SC-024 : le tri est d’affichage, il n’écrit rien en stockage', async ({ pageCollection }) => {
    const avant = await pageCollection.evaluate(async () => JSON.stringify((await chrome.storage.local.get('collection')).collection));
    await entete(pageCollection, 'Titre').getByRole('button').click();
    await entete(pageCollection, 'Titre').getByRole('button').click();
    const apres = await pageCollection.evaluate(async () => JSON.stringify((await chrome.storage.local.get('collection')).collection));
    expect(apres).toBe(avant);
  });

  test('SC-024 : sous 600 px, cartes empilées avec « Trier par » et « Sens » (aria-pressed)', async ({ pageCollection }) => {
    await pageCollection.setViewportSize({ width: 375, height: 812 });
    await expect(pageCollection.getByTestId('tableau-cartes').locator('thead')).toBeHidden();
    const trier = pageCollection.getByLabel('Trier par');
    await expect(trier).toBeVisible();
    const sens = pageCollection.getByRole('button', { name: 'Sens' });
    await expect(sens).toHaveAttribute('aria-pressed', 'false');
    await trier.selectOption({ label: 'Titre' });
    expect((await titres(pageCollection))[0]).toContain('Abeille');
    await sens.click();
    await expect(sens).toHaveAttribute('aria-pressed', 'true');
    expect((await titres(pageCollection))[0]).toContain('Zèbre');
    const hauteur = await trier.evaluate((e) => e.getBoundingClientRect().height);
    expect(hauteur).toBeGreaterThanOrEqual(44);
  });

  test('SC-024 : le filtre retire des lignes, le tri reste appliqué', async ({ pageCollection }) => {
    await entete(pageCollection, 'Titre').getByRole('button').click();
    await pageCollection.getByLabel('Rechercher une carte').fill('fictive');
    await expect(lignes(pageCollection)).toHaveCount(2);
    expect((await titres(pageCollection))[0]).toContain('Abeille');
    await expect(entete(pageCollection, 'Titre')).toHaveAttribute('aria-sort', 'ascending');
  });
});

test.describe('SC-011 : 200 lignes et vérification Wikipédia', () => {
  const beaucoup = Array.from({ length: 5000 }, (_, i) => ({
    id: `c${i}`,
    titre: `Carte fictive ${String(i).padStart(4, '0')}`,
    rarete: 'Commune',
    quantite: 1,
  }));

  test('SC-011 : 5 000 cartes, 200 lignes au premier affichage puis « Afficher plus »', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, beaucoup);
    await allerA(pageCollection, 'collection');
    await expect(lignes(pageCollection)).toHaveCount(200);
    await pageCollection.getByRole('button', { name: /Afficher plus/ }).click();
    await expect(lignes(pageCollection)).toHaveCount(400);
  });

  test('SC-011 : la mention reste visible en vue liste ; seuls les titres des lignes rendues sont interrogés', async ({ pageCollection }) => {
    const requetes: string[] = [];
    await pageCollection.route(/^https:\/\/(fr\.wikipedia|www\.wikidata)\.org\//, async (route) => {
      requetes.push(decodeURIComponent(route.request().url()));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"query":{"pages":[]}}' });
    });
    await chargerCartes(pageCollection, beaucoup);
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByText(/titres des cartes affichées sont vérifiés/)).toBeVisible();
    await expect(lignes(pageCollection)).toHaveCount(200);
    await pageCollection.waitForTimeout(3000);
    const interdits = requetes.filter((u) => {
      const m = /Carte fictive (\d{4})/.exec(u);
      return m !== null && Number(m[1]) >= 200;
    });
    expect(interdits).toEqual([]);
    // Le tri ne déclenche pas de vérification pour des cartes non rendues.
    await entete(pageCollection, 'Titre').getByRole('button').click();
    await entete(pageCollection, 'Titre').getByRole('button').click();
    await pageCollection.waitForTimeout(2500);
    const apresTri = requetes.filter((u) => {
      const m = /Carte fictive (\d{4})/.exec(u);
      return m !== null && Number(m[1]) >= 200 && Number(m[1]) < 4800;
    });
    expect(apresTri).toEqual([]);
  });
});

test.describe('SC-021 : analyses', () => {
  const ANALYSES = ['doublons', 'a-trier', 'defaussables', 'valeur-par-decision', 'plus-cheres', 'themes'] as const;

  test('SC-021 : six analyses avec contenu', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, [
      { id: 'a', titre: 'Doublon fictif', quantite: 3, valeurMarchande: 50, statut: 'vendre' },
      { id: 'b', titre: 'Bricole fictive', quantite: 1, valeurMarchande: 2, statut: 'defausser' },
      { id: 'c', titre: 'Inconnue fictive', quantite: 1, statut: 'a-trier' },
      { id: 'd', titre: 'Trop chère fictive', quantite: 1, valeurMarchande: 90, statut: 'defausser' },
    ]);
    await allerA(pageCollection, 'collection');
    for (const a of ANALYSES) await expect(pageCollection.getByTestId(`analyse-${a}`)).toBeVisible();
    await expect(pageCollection.getByTestId('analyse-doublons')).toContainText('Doublon fictif');
    await expect(pageCollection.getByTestId('analyse-a-trier')).toContainText('Inconnue fictive');
    // Plafond par défaut 5 : seule la carte de valeur 2 est défaussable.
    await expect(pageCollection.getByTestId('analyse-defaussables')).toContainText('Bricole fictive');
    await expect(pageCollection.getByTestId('analyse-defaussables')).not.toContainText('Trop chère fictive');
    const cheres = pageCollection.getByTestId('analyse-plus-cheres');
    await expect(cheres).toContainText('Trop chère fictive');
    expect(await cheres.innerText()).toMatch(/Trop chère fictive[\s\S]*Doublon fictif/);
    await expect(pageCollection.getByTestId('analyse-valeur-par-decision')).toContainText(/Vendre/);
  });

  test('SC-021 : états vides écrits (aucune carte qui correspond)', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, [{ id: 'a', titre: 'Seule fictive', quantite: 1, statut: 'garder' }]);
    await allerA(pageCollection, 'collection');
    for (const a of ['doublons', 'a-trier', 'defaussables', 'plus-cheres'] as const) {
      const bloc = pageCollection.getByTestId(`analyse-${a}`);
      await expect(bloc).toBeVisible();
      await expect(bloc).toContainText(/^[\s\S]*Aucun/i);
      await expect(bloc.locator('li, tbody tr')).toHaveCount(0);
    }
  });

  test('SC-021 : 10 plus chères et 10 thèmes au plus', async ({ pageCollection }) => {
    const cartes = Array.from({ length: 15 }, (_, i) => ({
      id: `p${i}`,
      titre: `Prisée fictive ${String(i).padStart(2, '0')}`,
      quantite: 1,
      valeurMarchande: 100 + i,
      description: 'film de 1986',
    }));
    await chargerCartes(pageCollection, cartes);
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByTestId('analyse-plus-cheres').locator('li, tbody tr')).toHaveCount(10);
    expect(await pageCollection.getByTestId('analyse-themes').locator('li, tbody tr').count()).toBeLessThanOrEqual(10);
  });

  test('SC-021 : titres affichés en texte, jamais interprétés', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, [{ id: 'x', titre: '<img src=x onerror=alert(1)>', quantite: 2 }]);
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByTestId('analyse-doublons')).toContainText('<img src=x onerror=alert(1)>');
    await expect(pageCollection.getByTestId('analyse-doublons').locator('img')).toHaveCount(0);
  });
});

test.describe('SC-020 : évolution sur 30 jours', () => {
  const jourDecale = (decalage: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - decalage);
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  test('SC-020 : moins de 2 points, message de constitution', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await allerA(pageCollection, 'collection');
    await expect(pageCollection.getByTestId('evolution')).toContainText('Historique en cours de constitution (1 jour)');
    await expect(pageCollection.getByTestId('evolution-colonne')).toHaveCount(0);
  });

  test('SC-020 : colonnes, trous pour les jours sans point, valeur au survol et au focus, tableau sr-only', async ({ pageCollection }) => {
    await pageCollection.evaluate(
      (pts) => chrome.storage.local.set({ historique: { version: 1, points: pts } }),
      [
        { jour: jourDecale(10), exemplaires: 4 },
        { jour: jourDecale(9), exemplaires: 6 },
        { jour: jourDecale(5), exemplaires: 8 },
      ],
    );
    await chargerCartes(pageCollection, CARTES);
    await allerA(pageCollection, 'collection');
    const evo = pageCollection.getByTestId('evolution');
    await expect(evo.getByTestId('evolution-colonne')).toHaveCount(4); // 3 points + aujourd’hui
    await expect(evo.getByTestId('evolution-trou')).toHaveCount(26);
    const colonne = evo.getByTestId('evolution-colonne').first();
    await colonne.hover();
    await expect(evo.getByTestId('evolution-valeur')).toContainText('4');
    await evo.getByTestId('evolution-colonne').nth(1).focus();
    await expect(evo.getByTestId('evolution-valeur')).toContainText('6');
    const alt = evo.locator('table');
    await expect(alt).toHaveClass(/sr-only/);
    await expect(alt.locator('tbody tr')).not.toHaveCount(0);
  });
});

test.describe('SC-020 : édition inchangée', () => {
  test('SC-024 : éditer le statut d’une ligne du tableau écrit toujours la carte', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await allerA(pageCollection, 'collection');
    await pageCollection.getByLabel('Statut de Zèbre fictif').selectOption('garder');
    await expect
      .poll(() =>
        pageCollection.evaluate(async () => {
          const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: unknown[] } };
          const c = (collection.cartes as { id: string; statut: string; decidePar: string | null }[]).find((x) => x.id === 'a');
          return `${c?.statut}|${c?.decidePar}`;
        }),
      )
      .toBe('garder|moi');
  });
});

test.describe('SC-009 : largeurs et captures', () => {
  for (const theme of THEMES) {
    for (const bp of BREAKPOINTS) {
      test(`SC-009 : Collection sans débordement horizontal, ${bp.name} ${theme}`, async ({ pageCollection }) => {
        await chargerCartes(pageCollection, CARTES);
        await pageCollection.emulateMedia({ colorScheme: theme });
        await pageCollection.setViewportSize({ width: bp.width, height: bp.height });
        await allerA(pageCollection, 'collection');
        await expect(pageCollection.getByTestId('tableau-cartes')).toBeVisible();
        const ok = await pageCollection.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        expect(ok).toBe(true);
        await pageCollection.screenshot({ path: `test-results/captures/collection-${theme}-${bp.name}.png`, fullPage: true });
      });
    }
  }
});
