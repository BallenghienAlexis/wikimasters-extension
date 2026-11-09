/**
 * Mesure de performance robuste à la charge de la CI : les fichiers de test tournent en parallèle
 * sur des machines partagées, une seule mesure peut dépasser le seuil sans que le code ait changé.
 * On garde la meilleure de quelques exécutions ; le seuil, lui, ne change pas.
 */
export function meilleureDuree(calcul: () => void, essais = 3): number {
  let meilleure = Number.POSITIVE_INFINITY
  for (let i = 0; i < essais; i++) {
    const debut = performance.now()
    calcul()
    meilleure = Math.min(meilleure, performance.now() - debut)
  }
  return meilleure
}
