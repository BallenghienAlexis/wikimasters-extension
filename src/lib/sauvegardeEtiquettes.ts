/**
 * Copie de sécurité des étiquettes posées par l’extension (Alexis, 2026-11-17), avant un retrait général.
 * Une ligne par carte : titre et noms d’étiquettes (aucun identifiant d’exemplaire ni de session). Logique pure.
 * Elle garde une trace de ce qui a été posé ; la repose se fait par « Poser » (règles courantes).
 */
import type { Collection } from './collection';
import type { Registre } from './actions';

export interface CopieEtiquettes {
  version: 1;
  date: string;
  cartes: Array<{ titre: string; etiquettes: string[] }>;
}

export function copieDesEtiquettes(collection: Collection, registre: Registre, maintenant: Date): CopieEtiquettes {
  const cartes: CopieEtiquettes['cartes'] = [];
  for (const c of collection.cartes) {
    const noms = new Set<string>();
    for (const ex of c.idsSite ?? []) for (const couple of registre.couples) if (couple.ex === ex) noms.add(couple.nom);
    if (noms.size > 0) cartes.push({ titre: c.titre, etiquettes: [...noms].sort((a, b) => a.localeCompare(b, 'fr')) });
  }
  cartes.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  return { version: 1, date: maintenant.toISOString(), cartes };
}
