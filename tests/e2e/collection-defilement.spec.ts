import { allerA, chargerCartes, expect, ouvrirBloc, test } from './extension';

// Les tâches de fond (synchro, lecture Wikipédia, thèmes appris) réécrivent le stockage pendant que le joueur lit
// la liste : la position de défilement ne doit pas bouger et les lignes ne doivent ni être recréées ni glisser.
// Données uniquement fictives.

const CARTES = Array.from({ length: 200 }, (_, i) => ({
  id: `c${String(i).padStart(3, '0')}`,
  titre: `Carte fictive ${String(i).padStart(3, '0')}`,
  rarete: 'Commune',
}));

test('une mise à jour de fond ne fait ni sauter ni glisser la liste', async ({ pageCollection }) => {
  await pageCollection.setViewportSize({ width: 1280, height: 800 });
  await chargerCartes(pageCollection, CARTES);
  await allerA(pageCollection, 'collection');
  await ouvrirBloc(pageCollection, 'liste-cartes');
  const lignes = pageCollection.getByTestId('tableau-cartes').locator('tbody tr');
  await expect(lignes).toHaveCount(200);
  await expect(lignes.last()).toBeVisible();
  await expect.poll(() => pageCollection.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(5000);

  // Défilement vers le milieu de la liste, puis marque d’une ligne visible pour détecter un remontage.
  await pageCollection.evaluate(() => window.scrollTo(0, 3000));
  expect(await pageCollection.evaluate(() => window.scrollY)).toBeGreaterThan(2500);
  await pageCollection.evaluate(() => {
    for (const tr of document.querySelectorAll('tbody tr')) tr.setAttribute('data-marque', '1');
  });
  // Compte les animations posées sur des lignes (FLIP) : aucune ne doit partir sans changement d’ordre.
  await pageCollection.evaluate(() => {
    const w = window as unknown as { __animLignes: number };
    w.__animLignes = 0;
    const origine = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (this.tagName === 'TR') w.__animLignes += 1;
      return origine.apply(this, args);
    };
  });
  const avant = await pageCollection.evaluate(() => window.scrollY);

  // Plusieurs écritures de fond : même collection réécrite, et caches Wikipédia qui se remplissent.
  for (let i = 0; i < 4; i++) {
    await pageCollection.evaluate(async (n) => {
      const { collection } = await chrome.storage.local.get('collection');
      // Une synchro de fond change une carte (ici sa note) : tout le stockage est relu par la page.
      const copie = JSON.parse(JSON.stringify(collection));
      copie.cartes[0].note = `fond ${n}`;
      await chrome.storage.local.set({ collection: copie });
      await chrome.storage.local.set({ wikipedia: { version: 1, entrees: {} }, [`bruit${n}`]: n });
    }, i);
    await pageCollection.waitForTimeout(150);
  }
  await pageCollection.waitForTimeout(1800);

  const apres = await pageCollection.evaluate(() => ({
    y: window.scrollY,
    marquees: document.querySelectorAll('tbody tr[data-marque]').length,
    animationsLignes: (window as unknown as { __animLignes: number }).__animLignes,
  }));
  expect(Math.abs(apres.y - avant)).toBeLessThan(2);
  expect(apres.marquees).toBe(200);
  expect(apres.animationsLignes).toBe(0);
});
