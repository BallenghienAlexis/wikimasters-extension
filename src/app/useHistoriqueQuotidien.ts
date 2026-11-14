import { useEffect } from 'react';
import type { Collection } from '../lib/collection';
import { noterPoint } from '../lib/historique';
import { chargerHistorique, enregistrerHistorique } from '../lib/stockage';

/**
 * Note un point par jour local (SC-020) : nombre d’exemplaires hors « en vente », à l’ouverture puis à chaque
 * changement de collection. Le point du jour est remplacé, jamais dupliqué. Rien n’est écrit tant que la
 * collection n’est pas lue. Un échec d’écriture n’interrompt rien : l’historique est un confort.
 */
export function useHistoriqueQuotidien(collection: Collection, prete: boolean): void {
  const exemplaires = collection.cartes.reduce((s, c) => s + c.quantite, 0);
  const avecCartes = collection.cartes.length > 0;
  useEffect(() => {
    // Collection vide : aucun point (pas de courbe à 0 avant la première lecture, et pas d’écriture concurrente
    // qui écraserait un historique posé par ailleurs pendant l’ouverture de la page).
    if (!prete || !avecCartes) return;
    let actif = true;
    void chargerHistorique()
      .then((points) => (actif ? enregistrerHistorique(noterPoint(points, exemplaires, new Date())) : undefined))
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [prete, avecCartes, exemplaires]);
}
