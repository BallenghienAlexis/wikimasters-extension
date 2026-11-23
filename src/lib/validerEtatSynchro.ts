// Validation de l'état de l'ordonnanceur, partagée avec la sauvegarde complète (aucun accès au stockage).
import { estObjet } from './valider';
import type { EtatOrdonnanceur } from './ordonnanceur';

const horodatageValide = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const MAX_ENTREES_ETAT = 100_000;
const nullOuHorodatage = (v: unknown): v is number | null => v === null || horodatageValide(v);
const nullOuEntier = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0);

export function validerEtatSynchro(brut: unknown): EtatOrdonnanceur | null {
  if (!estObjet(brut) || brut.version !== 1) return null;
  const { total, totalUnique, signatureEtiquettes, derniereComplete, arretJusqua, requetes, cardIds, prix } = brut;
  if (!nullOuEntier(total) || !nullOuEntier(totalUnique)) return null;
  if (signatureEtiquettes !== null && typeof signatureEtiquettes !== 'string') return null;
  if (!nullOuHorodatage(derniereComplete) || !nullOuHorodatage(arretJusqua)) return null;
  if (!Array.isArray(requetes) || requetes.length > MAX_ENTREES_ETAT || !requetes.every(horodatageValide)) return null;
  if (!estObjet(cardIds) || Object.keys(cardIds).length > MAX_ENTREES_ETAT) return null;
  if (!Object.values(cardIds).every((v) => typeof v === 'string')) return null;
  if (!estObjet(prix) || Object.keys(prix).length > MAX_ENTREES_ETAT) return null;
  const releves: EtatOrdonnanceur['prix'] = {};
  for (const [id, r] of Object.entries(prix)) {
    if (!estObjet(r) || !nullOuEntier(r.valeur) || !horodatageValide(r.releveLe)) return null;
    const t = r.tendance;
    const tendance =
      estObjet(t) && (t.variationPct === null || typeof t.variationPct === 'number') && Number.isInteger(t.min4) && (t.min4 as number) >= 0 && Number.isInteger(t.max4) && (t.max4 as number) >= 0 && Number.isInteger(t.ventes4) && (t.ventes4 as number) >= 0
        ? { variationPct: t.variationPct as number | null, min4: t.min4 as number, max4: t.max4 as number, ventes4: t.ventes4 as number }
        : null;
    releves[id] = tendance ? { valeur: r.valeur, releveLe: r.releveLe, tendance } : { valeur: r.valeur, releveLe: r.releveLe };
  }
  const vs = brut.ventesSite;
  const ventesSite =
    estObjet(vs) && horodatageValide(vs.enCours) && horodatageValide(vs.max) && horodatageValide(vs.releveLe)
      ? { enCours: vs.enCours, max: vs.max, releveLe: vs.releveLe }
      : null;
  return {
    version: 1,
    total,
    totalUnique,
    signatureEtiquettes,
    derniereComplete,
    arretJusqua,
    requetes: [...requetes],
    cardIds: { ...(cardIds as Record<string, string>) },
    prix: releves,
    ...(ventesSite === null ? {} : { ventesSite }),
  };
}

