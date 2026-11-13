// Tri des tableaux (D-16, SC-024) : pur, stable, comparaison française, inconnues toujours en dernier.

export type SensTri = 'croissant' | 'decroissant' | null;
export type ValeurTri = string | number | null | undefined;

const estInconnue = (v: ValeurTri): v is null | undefined =>
  v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));

const comparer = (a: string | number, b: string | number): number =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'fr');

/** Renvoie un nouveau tableau trié ; sans sens, l’ordre d’origine est conservé. */
export function trierLignes<T>(lignes: readonly T[], cle: (ligne: T) => ValeurTri, sens: SensTri): T[] {
  if (sens === null) return [...lignes];
  const facteur = sens === 'croissant' ? 1 : -1;
  return lignes
    .map((ligne, index) => ({ ligne, index, valeur: cle(ligne) }))
    .sort((x, y) => {
      const inconnueX = estInconnue(x.valeur);
      const inconnueY = estInconnue(y.valeur);
      if (inconnueX || inconnueY) {
        if (inconnueX && inconnueY) return x.index - y.index;
        return inconnueX ? 1 : -1;
      }
      return facteur * comparer(x.valeur as string | number, y.valeur as string | number) || x.index - y.index;
    })
    .map((e) => e.ligne);
}

/** Cycle d’un clic sur l’en-tête : aucun → croissant → décroissant → aucun. */
export function basculerTri(sens: SensTri): SensTri {
  if (sens === null) return 'croissant';
  return sens === 'croissant' ? 'decroissant' : null;
}
