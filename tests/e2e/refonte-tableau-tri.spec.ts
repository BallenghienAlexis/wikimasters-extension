import type { Locator, Page } from '@playwright/test';
import { allerA, chargerCartes, expect, test } from './extension';

// T-312 : tableau de tri de l’onglet Collection (SC-023, SC-026 glisser, SC-008). Données uniquement fictives.
//
// Contrat de sélecteurs attendu de l’implémentation :
// - sélecteur de vue : deux boutons « Liste » et « Tableau de tri » (role button, `aria-pressed`, 44 px de haut au moins) ;
//   « Liste » est pressé par défaut ; le tableau de cartes (`tableau-cartes`) n’est pas rendu en vue Tableau de tri.
// - conteneur : data-testid `tableau-tri` ; cinq colonnes `role="group"` de nom accessible « Garder 2 », « Échanger 0 »…
//   (titre + nombre, `aria-labelledby`), dans l’ordre Garder, Échanger, Vendre, Défausser, À trier ;
//   data-testid `colonne-tri-<statut>` (garder, echanger, vendre, defausser, a-trier) sur chaque colonne.
// - carte : data-testid `carte-tri` (attribut data-id = identifiant de la carte), dans sa colonne, contenant son titre,
//   sa rareté et sa quantité ; deux boutons (←, →) de nom accessible « Déplacer « titre » vers <Colonne> »,
//   44 × 44 px, `aria-disabled="true"` en bout de rangée (le bouton reste dans le DOM, activation sans effet).
// - mention des cartes en vente : data-testid `tri-en-vente`, texte « N en vente, non déplaçables ».
// - annonce : élément `aria-live="polite"` data-testid `tri-annonce`, texte « « titre » déplacée vers Vendre ».
// - glisser : Pointer Events sur la carte (poignée = la carte entière, hors boutons) ; colonne cible survolée porte
//   l’attribut `data-cible="true"` pendant le glisser ; Échap annule (la carte reste, `data-cible` retiré).
// - « Afficher plus » : bouton de nom « Afficher plus » dans la colonne concernée (50 cartes par colonne au premier rendu).
// - recherche de l’onglet : champ « Rechercher une carte » (partagé avec la vue liste).
// - sous 600 px (375) : chaque colonne est repliable via un bouton `aria-expanded` portant le titre de la colonne.
// - réglage « Animations » : clé de stockage `affichage` (voir T-317), mouvement coupé par `emulateMedia({ reducedMotion })`.

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

const CARTES = [
  { id: 'a', titre: 'Zèbre fictif', rarete: 'Rare', quantite: 1, statut: 'garder' },
  { id: 'b', titre: 'Élan fictif', rarete: 'Commune', quantite: 3, statut: 'a-trier' },
  { id: 'c', titre: 'Abeille fictive', rarete: 'Rare', quantite: 2, statut: 'a-trier' },
  { id: 'd', titre: 'Mouette fictive', rarete: 'Commune', quantite: 2, statut: 'vendre' },
  { id: 'e', titre: 'Loutre fictive', rarete: 'Rare', quantite: 1, statut: 'en-vente' },
  { id: 'f', titre: 'Renard fictif', rarete: 'Commune', quantite: 1, statut: 'defausser' },
];

const colonne = (page: Page, statut: string) => page.getByTestId(`colonne-tri-${statut}`);
const carte = (page: Page, titre: string) => page.getByTestId('carte-tri').filter({ hasText: titre });
const fleche = (page: Page, titre: string, vers: string) =>
  page.getByRole('button', { name: `Déplacer « ${titre} » vers ${vers}` });

async function ouvrirTableau(page: Page) {
  await allerA(page, 'collection');
  await page.getByRole('button', { name: 'Tableau de tri' }).click();
  await expect(page.getByTestId('tableau-tri')).toBeVisible();
}

async function stockee(page: Page, id: string) {
  return page.evaluate(async (i) => {
    const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: unknown[] } };
    return (collection.cartes as { id: string; statut: string; decidePar: string | null }[]).find((c) => c.id === i);
  }, id);
}

async function glisser(page: Page, source: Locator, cible: Locator) {
  const s = (await source.boundingBox())!;
  const c = (await cible.boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + 8);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 10, s.y + 20, { steps: 3 });
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 8 });
  return async (relacher: boolean) => {
    if (relacher) await page.mouse.up();
    else {
      await page.keyboard.press('Escape');
      await page.mouse.up();
    }
  };
}

test.describe('SC-023 : sélecteur et colonnes', () => {
  test.beforeEach(async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
  });

  test('SC-023 : sélecteur Liste / Tableau de tri avec aria-pressed et 44 px', async ({ pageCollection }) => {
    await allerA(pageCollection, 'collection');
    const liste = pageCollection.getByRole('button', { name: 'Liste', exact: true });
    const tableau = pageCollection.getByRole('button', { name: 'Tableau de tri' });
    await expect(liste).toHaveAttribute('aria-pressed', 'true');
    await expect(tableau).toHaveAttribute('aria-pressed', 'false');
    for (const b of [liste, tableau]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await tableau.click();
    await expect(tableau).toHaveAttribute('aria-pressed', 'true');
    await expect(liste).toHaveAttribute('aria-pressed', 'false');
    await expect(pageCollection.getByTestId('tableau-cartes')).toHaveCount(0);
    await liste.click();
    await expect(pageCollection.getByTestId('tableau-cartes')).toBeVisible();
    await expect(pageCollection.getByTestId('tableau-tri')).toHaveCount(0);
  });

  test('SC-023 : cinq colonnes nommées avec leur nombre, dans l’ordre', async ({ pageCollection }) => {
    await ouvrirTableau(pageCollection);
    const attendu = [
      ['garder', 'Garder 1'],
      ['echanger', 'Échanger 0'],
      ['vendre', 'Vendre 1'],
      ['defausser', 'Défausser 1'],
      ['a-trier', 'À trier 2'],
    ];
    const groupes = pageCollection.getByTestId('tableau-tri').getByRole('group');
    await expect(groupes).toHaveCount(5);
    for (const [i, [statut, nom]] of attendu.entries()) {
      await expect(groupes.nth(i)).toHaveAttribute('data-testid', `colonne-tri-${statut}`);
      await expect(pageCollection.getByRole('group', { name: nom })).toBeVisible();
    }
    await expect(colonne(pageCollection, 'a-trier').getByTestId('carte-tri')).toHaveCount(2);
  });

  test('SC-023 : cartes en vente absentes des colonnes, mention du nombre', async ({ pageCollection }) => {
    await ouvrirTableau(pageCollection);
    await expect(pageCollection.getByTestId('carte-tri').filter({ hasText: 'Loutre fictive' })).toHaveCount(0);
    await expect(pageCollection.getByTestId('carte-tri')).toHaveCount(5);
    await expect(pageCollection.getByTestId('tri-en-vente')).toHaveText(/1 en vente, non déplaçables/);
  });

  test('SC-023 : la carte porte titre, rareté, quantité et deux flèches de 44 px', async ({ pageCollection }) => {
    await ouvrirTableau(pageCollection);
    const c = carte(pageCollection, 'Élan fictif');
    await expect(c).toContainText('Commune');
    await expect(c).toContainText('3');
    // « Élan » est à trier (dernière colonne) : sa flèche gauche mène à Défausser.
    const gauche = fleche(pageCollection, 'Élan fictif', 'Défausser');
    await expect(gauche).toBeVisible();
    const box = (await gauche.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('SC-023 : flèche désactivée (aria-disabled) en bout de rangée, sans effet', async ({ pageCollection }) => {
    await ouvrirTableau(pageCollection);
    // « Zèbre » est dans Garder (première colonne) : pas de flèche gauche utile.
    const boutons = carte(pageCollection, 'Zèbre fictif').getByRole('button');
    await expect(boutons).toHaveCount(2);
    await expect(boutons.first()).toHaveAttribute('aria-disabled', 'true');
    await expect(boutons.nth(1)).not.toHaveAttribute('aria-disabled', 'true');
    await boutons.first().click({ force: true });
    await expect(colonne(pageCollection, 'garder').getByTestId('carte-tri')).toHaveCount(1);
    expect((await stockee(pageCollection, 'a'))!.decidePar).toBeNull();
    // Dernière colonne : « Élan » (À trier) a sa flèche droite désactivée.
    await expect(carte(pageCollection, 'Élan fictif').getByRole('button').nth(1)).toHaveAttribute('aria-disabled', 'true');
  });
});

test.describe('SC-023 : déplacement au clavier', () => {
  test.beforeEach(async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await ouvrirTableau(pageCollection);
  });

  test('SC-023 : → déplace toute la carte, écrit statut et decidePar « moi », annonce et focus', async ({ pageCollection }) => {
    const bouton = fleche(pageCollection, 'Zèbre fictif', 'Échanger');
    await bouton.focus();
    await pageCollection.keyboard.press('Enter');
    await expect(colonne(pageCollection, 'echanger').getByTestId('carte-tri').filter({ hasText: 'Zèbre fictif' })).toHaveCount(1);
    await expect(colonne(pageCollection, 'garder').getByTestId('carte-tri')).toHaveCount(0);
    await expect(pageCollection.getByRole('group', { name: 'Échanger 1' })).toBeVisible();
    await expect(pageCollection.getByRole('group', { name: 'Garder 0' })).toBeVisible();
    await expect(pageCollection.getByTestId('tri-annonce')).toHaveAttribute('aria-live', 'polite');
    await expect(pageCollection.getByTestId('tri-annonce')).toHaveText('« Zèbre fictif » déplacée vers Échanger');
    // Le focus suit la carte : il est dans la carte, dans sa nouvelle colonne.
    await expect
      .poll(() =>
        pageCollection.evaluate(() => document.activeElement?.closest('[data-testid="colonne-tri-echanger"]') !== null),
      )
      .toBe(true);
    await expect.poll(async () => (await stockee(pageCollection, 'a'))!.statut).toBe('echanger');
    expect((await stockee(pageCollection, 'a'))!.decidePar).toBe('moi');
  });

  test('SC-023 : ← déplace vers la colonne de gauche', async ({ pageCollection }) => {
    await fleche(pageCollection, 'Mouette fictive', 'Échanger').click();
    await expect(colonne(pageCollection, 'echanger').getByTestId('carte-tri').filter({ hasText: 'Mouette fictive' })).toHaveCount(1);
    await expect.poll(async () => (await stockee(pageCollection, 'd'))!.statut).toBe('echanger');
  });

  test('SC-023 : une carte à plusieurs exemplaires bouge en entier', async ({ pageCollection }) => {
    await fleche(pageCollection, 'Élan fictif', 'Défausser').click();
    const c = colonne(pageCollection, 'defausser').getByTestId('carte-tri').filter({ hasText: 'Élan fictif' });
    await expect(c).toHaveCount(1);
    await expect(c).toContainText('3');
    const stock = await pageCollection.evaluate(async () => {
      const { collection } = (await chrome.storage.local.get('collection')) as { collection: { cartes: { id: string }[] } };
      return collection.cartes.find((x: { id: string }) => x.id === 'b');
    });
    expect(stock).toMatchObject({ statut: 'defausser', quantite: 3, decidePar: 'moi' });
  });

  test('SC-023 : un déplacement ne fait aucune requête réseau', async ({ pageCollection, context }) => {
    const requetes: string[] = [];
    context.on('request', (r) => {
      if (/^https?:/.test(r.url())) requetes.push(r.url());
    });
    await fleche(pageCollection, 'Zèbre fictif', 'Échanger').click();
    await expect(colonne(pageCollection, 'echanger').getByTestId('carte-tri')).toHaveCount(1);
    await pageCollection.waitForTimeout(300);
    expect(requetes).toEqual([]);
  });

  test('SC-023 : aucune vérification Wikipédia en vue Tableau de tri (SC-011)', async ({ pageCollection, context }) => {
    const requetes: string[] = [];
    context.on('request', (r) => {
      if (/wikipedia|wikidata/.test(r.url())) requetes.push(r.url());
    });
    await pageCollection.waitForTimeout(1500);
    expect(requetes).toEqual([]);
  });
});

test.describe('SC-023 : glisser-déposer (Pointer Events)', () => {
  test.beforeEach(async ({ pageCollection }) => {
    await pageCollection.setViewportSize({ width: 1280, height: 800 });
    await chargerCartes(pageCollection, CARTES);
    await ouvrirTableau(pageCollection);
  });

  test('SC-023 : déposer dans une colonne applique statut et decidePar « moi »', async ({ pageCollection }) => {
    const fin = await glisser(pageCollection, carte(pageCollection, 'Zèbre fictif'), colonne(pageCollection, 'vendre'));
    await expect(colonne(pageCollection, 'vendre')).toHaveAttribute('data-cible', 'true');
    await fin(true);
    await expect(colonne(pageCollection, 'vendre').getByTestId('carte-tri').filter({ hasText: 'Zèbre fictif' })).toHaveCount(1);
    await expect(pageCollection.getByTestId('tri-annonce')).toHaveText('« Zèbre fictif » déplacée vers Vendre');
    await expect.poll(async () => (await stockee(pageCollection, 'a'))!.statut).toBe('vendre');
    expect((await stockee(pageCollection, 'a'))!.decidePar).toBe('moi');
    await expect(colonne(pageCollection, 'vendre')).not.toHaveAttribute('data-cible', 'true');
  });

  test('SC-023 : Échap pendant un glisser annule, rien n’est écrit', async ({ pageCollection }) => {
    const fin = await glisser(pageCollection, carte(pageCollection, 'Zèbre fictif'), colonne(pageCollection, 'vendre'));
    await fin(false);
    await expect(colonne(pageCollection, 'garder').getByTestId('carte-tri').filter({ hasText: 'Zèbre fictif' })).toHaveCount(1);
    await expect(colonne(pageCollection, 'vendre')).not.toHaveAttribute('data-cible', 'true');
    const s = await stockee(pageCollection, 'a');
    expect(s).toMatchObject({ statut: 'garder', decidePar: null });
  });

  test('SC-023 : déposer dans la colonne d’origine ne change rien', async ({ pageCollection }) => {
    const fin = await glisser(pageCollection, carte(pageCollection, 'Zèbre fictif'), colonne(pageCollection, 'garder'));
    await fin(true);
    expect(await stockee(pageCollection, 'a')).toMatchObject({ statut: 'garder', decidePar: null });
  });

  test('SC-026 : mouvement coupé, la carte est posée sans trajet (aucune transition)', async ({ pageCollection }) => {
    await pageCollection.emulateMedia({ reducedMotion: 'reduce' });
    const duree = await carte(pageCollection, 'Zèbre fictif').evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.transitionDuration, s.animationDuration].join(',');
    });
    expect(duree.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
    await fleche(pageCollection, 'Zèbre fictif', 'Échanger').click();
    await expect(colonne(pageCollection, 'echanger').getByTestId('carte-tri')).toHaveCount(1);
    const apres = await carte(pageCollection, 'Zèbre fictif').evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.transitionDuration, s.animationDuration].join(',');
    });
    expect(apres.split(',').every((d) => parseFloat(d) === 0)).toBe(true);
  });
});

test.describe('SC-023 : recherche et grandes collections', () => {
  test('SC-023 : la recherche de l’onglet filtre aussi le tableau et les nombres', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await ouvrirTableau(pageCollection);
    await pageCollection.getByLabel('Rechercher une carte').fill('élan');
    await expect(pageCollection.getByTestId('carte-tri')).toHaveCount(1);
    await expect(pageCollection.getByRole('group', { name: 'À trier 1' })).toBeVisible();
    await expect(pageCollection.getByRole('group', { name: 'Garder 0' })).toBeVisible();
  });

  test('SC-023 : 5 000 cartes, 50 par colonne puis « Afficher plus » (SC-011)', async ({ pageCollection }) => {
    const beaucoup = Array.from({ length: 5000 }, (_, i) => ({
      id: `n${i}`,
      titre: `Carte numéro ${i}`,
      rarete: 'Commune',
      quantite: 1,
      statut: 'a-trier',
    }));
    await chargerCartes(pageCollection, beaucoup);
    await ouvrirTableau(pageCollection);
    const col = colonne(pageCollection, 'a-trier');
    await expect(col.getByTestId('carte-tri')).toHaveCount(50);
    await expect(pageCollection.getByRole('group', { name: 'À trier 5000' })).toBeVisible();
    const plus = col.getByRole('button', { name: 'Afficher plus' });
    expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await plus.click();
    await expect(col.getByTestId('carte-tri')).toHaveCount(100);
    await expect(pageCollection.getByTestId('carte-tri')).toHaveCount(100);
  });
});

test.describe('SC-008 : clavier, mise en page et captures', () => {
  test('SC-008 : tout est atteignable à la tabulation, focus visible', async ({ pageCollection }) => {
    await chargerCartes(pageCollection, CARTES);
    await ouvrirTableau(pageCollection);
    const bouton = fleche(pageCollection, 'Abeille fictive', 'Défausser');
    await bouton.focus();
    await expect(bouton).toBeFocused();
    const contour = await bouton.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(contour).not.toBe('none');
  });

  for (const bp of BREAKPOINTS) {
    test(`SC-023 : ${bp.name} (${bp.width} px) : disposition des colonnes, pas de défilement horizontal`, async ({
      pageCollection,
    }) => {
      await pageCollection.setViewportSize({ width: bp.width, height: bp.height });
      await chargerCartes(pageCollection, CARTES);
      await ouvrirTableau(pageCollection);
      const tops = new Set<number>();
      const lefts = new Set<number>();
      for (const s of ['garder', 'echanger', 'vendre', 'defausser', 'a-trier']) {
        const b = (await colonne(pageCollection, s).boundingBox())!;
        tops.add(Math.round(b.y));
        lefts.add(Math.round(b.x));
      }
      if (bp.width === 375) {
        expect(lefts.size).toBe(1); // empilées
        expect(tops.size).toBe(5);
        const repli = pageCollection.getByRole('button', { name: /^Garder/, expanded: true });
        await expect(repli).toBeVisible();
        await repli.click();
        await expect(pageCollection.getByRole('button', { name: /^Garder/ })).toHaveAttribute('aria-expanded', 'false');
        await expect(carte(pageCollection, 'Zèbre fictif')).toBeHidden();
      } else if (bp.width === 768) {
        expect(lefts.size).toBe(2); // 2 colonnes
        expect(tops.size).toBe(3);
      } else {
        expect(tops.size).toBe(1); // 5 colonnes sur une ligne
        expect(lefts.size).toBe(5);
      }
      const debordement = await pageCollection.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(debordement).toBe(false);
      await pageCollection.screenshot({ path: `test-results/captures/tableau-tri-${bp.name}.png`, fullPage: true });
    });
  }
});
