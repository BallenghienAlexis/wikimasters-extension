// Pose échouée parce que l'étiquette n'existe plus sur le site (Alexis, 2026-11-24 : « il y a des erreurs car une étiquette
// n'existe pas »). Sans requête de plus que : une relecture de la liste des étiquettes du compte (route déjà lue par la synchro),
// une éventuelle création (action existante) puis un seul nouvel essai de la pose. Même cadence que le reste (0,2 s + gigue).
import type { Registre } from '../lib/actions';
import { ETIQUETTE_A_CLASSER } from '../lib/lot';
import { cleNomEtiquette } from '../lib/registre';
import { MAX_ETIQUETTES_SITE } from '../lib/etiquettesPreexistantes';

export interface DependancesSoin {
  /** Liste du compte relue à l'instant ; `null` si la lecture a échoué. */
  lireListe: () => Promise<Array<{ id: string; nom: string }> | null>;
  /** Crée l'étiquette sur le site ; rend son identifiant, ou `null` en cas d'échec. */
  creer: (nom: string) => Promise<string | null>;
  chargerRegistre: () => Promise<Registre>;
  /** Inscrit (nom, identifiant) au registre. */
  noter: (nom: string, id: string) => Promise<void>;
  /** Attend la cadence (0,2 s plus gigue) avant la requête suivante. */
  attendre: () => Promise<void>;
}

const NOMS_INTERDITS: ReadonlySet<string> = new Set([ETIQUETTE_A_CLASSER, '#Autres']);

/** Les soins sont faits un par un : trois poses parallèles de la même étiquette ne la créent qu'une fois. */
let chaine: Promise<unknown> = Promise.resolve();

/**
 * Identifiant à utiliser pour retenter une pose échouée avec `idEchoue`, ou `null` si rien n'est à corriger (la liste du site
 * montre l'étiquette avec ce même identifiant, liste illisible, tronquée ou vide, création refusée, nom interdit). Jamais
 * « #À classer » ni « #Autres ». Une étiquette absente du site est créée une seule fois, même si plusieurs poses échouent ensemble.
 */
export function idEtiquetteApresEchec(nom: string, idEchoue: string, deps: DependancesSoin): Promise<string | null> {
  const faire = async (): Promise<string | null> => {
    if (NOMS_INTERDITS.has(nom)) return null;
    // Un soin précédent a déjà corrigé ce nom : on réutilise son identifiant.
    const registre = await deps.chargerRegistre();
    const courant = Object.hasOwn(registre.etiquettes, nom) ? registre.etiquettes[nom] : undefined;
    if (courant !== undefined && courant !== idEchoue) return courant;
    await deps.attendre();
    const liste = await deps.lireListe();
    // Seule une liste complète sert de preuve (une liste vide ou tronquée n'en est pas une).
    if (liste === null || liste.length === 0 || liste.length >= MAX_ETIQUETTES_SITE) return null;
    if (liste.some((e) => e.id === idEchoue)) return null;
    const existante = liste.find((e) => cleNomEtiquette(e.nom) === cleNomEtiquette(nom));
    if (existante !== undefined) {
      await deps.noter(nom, existante.id);
      return existante.id;
    }
    await deps.attendre();
    const cree = await deps.creer(nom);
    if (cree === null) return null;
    await deps.noter(nom, cree);
    return cree;
  };
  const suite = chaine.then(faire, faire);
  chaine = suite.catch(() => null);
  return suite;
}
