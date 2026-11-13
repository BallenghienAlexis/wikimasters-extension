import React, { useEffect, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type { Carte } from '../lib/collection';
import { conseillerDelai, observations, type EvenementVente } from '../lib/affluence';
import { placesEncheres } from '../lib/lot';
import { basculerTri, trierLignes, type SensTri, type ValeurTri } from '../lib/ordreTableau';
import { fileDeVente, valeurDeCarte } from '../lib/tri';
import EnTeteTriable from './EnTeteTriable';
import HeuresFortes from './HeuresFortes';
import PlacesEncheres from './PlacesEncheres';
import { useFlip } from './useFlip';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink px-4 focus-visible:shadow-(--halo-focus)';
const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3 focus-visible:shadow-(--halo-focus)';

type Cle = 'carte' | 'valeur' | 'depart';
const COLONNES: { cle: Cle; libelle: string }[] = [
  { cle: 'carte', libelle: 'Carte' },
  { cle: 'valeur', libelle: 'Valeur' },
  { cle: 'depart', libelle: 'Départ' },
];
const VALEUR_TRI: Record<Cle, (c: Carte) => ValeurTri> = {
  carte: (c) => c.titre,
  valeur: (c) => valeurDeCarte(c),
  depart: (c) => c.prixCible,
};

interface Props {
  cartes: Carte[];
  ventes?: EvenementVente[];
  onMiseEnVente: (id: string) => void;
  onTerminee: (id: string) => void;
}

const FileVente: React.FC<Props> = ({ cartes, ventes = [], onMiseEnVente, onTerminee }) => {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [tri, setTri] = useState<{ cle: Cle | null; sens: SensTri }>({ cle: null, sens: null });
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const { enCours, placesLibres, prochaines, enAttente } = fileDeVente(cartes);
  const lignes = tri.cle === null ? [...prochaines] : trierLignes(prochaines, VALEUR_TRI[tri.cle], tri.sens);
  const cles = lignes.flatMap((c) => [`t:${c.id}`, `c:${c.id}`]);
  const flip = useFlip(cles);
  if (enCours.length === 0 && prochaines.length === 0 && enAttente === 0) return null;

  const places = placesEncheres({ maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees, ventesSite: null }, enCours.length);
  const basculer = (cle: Cle) =>
    setTri((t) => {
      if (t.cle !== cle) return { cle, sens: 'croissant' };
      const sens = basculerTri(t.sens);
      return { cle: sens === null ? null : cle, sens };
    });
  const etat = (cle: Cle): SensTri => (tri.cle === cle ? tri.sens : null);
  const conseil = (carte: Carte) => conseillerDelai(valeurDeCarte(carte), maintenant, ventes).texte;
  const valeurTexte = (carte: Carte) => valeurDeCarte(carte) ?? 'inconnue';
  const departTexte = (carte: Carte) => carte.prixCible ?? 'à définir';
  const actionMise = (carte: Carte) => (
    <button type="button" className={CLASSE_BOUTON} onClick={() => onMiseEnVente(carte.id)}>
      Je l’ai mise aux enchères
    </button>
  );

  return (
    <section aria-labelledby="titre-file-vente" className="mt-4 rounded border border-line bg-ink-2 p-4" data-testid="file-vente">
      <h2 id="titre-file-vente" className="font-semibold">
        Ventes : {enCours.length} en cours sur {CONFIG_PRIX.maxVentesSimultanees}, {placesLibres} {placesLibres > 1 ? 'places libres' : 'place libre'}
      </h2>
      <div className="mt-1">
        <PlacesEncheres occupees={places.occupees} max={places.max} />
      </div>

      {enCours.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {enCours.map((carte) => (
            <li key={carte.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words">En cours : {carte.titre}</span>
              <button type="button" className={CLASSE_BOUTON} onClick={() => onTerminee(carte.id)}>
                Enchère terminée
              </button>
            </li>
          ))}
        </ul>
      )}

      {prochaines.length > 0 && (
        <>
          <p className="mt-3 text-sm text-muted">À mettre aux enchères maintenant sur WikiMasters, de la plus chère à la moins chère par défaut :</p>

          <div className="mt-2 flex flex-wrap items-center gap-2 min-[600px]:hidden">
            <label className="flex items-center gap-2">
              <span>Trier par</span>
              <select
                className={CLASSE_CHAMP}
                value={tri.cle ?? ''}
                onChange={(e) => {
                  const cle = e.target.value as Cle | '';
                  setTri(cle === '' ? { cle: null, sens: null } : { cle, sens: 'croissant' });
                }}
              >
                <option value="">Valeur décroissante (défaut)</option>
                {COLONNES.map((c) => (
                  <option key={c.cle} value={c.cle}>
                    {c.libelle}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={CLASSE_BOUTON}
              aria-pressed={tri.sens === 'croissant'}
              disabled={tri.cle === null}
              onClick={() => setTri((t) => ({ ...t, sens: t.sens === 'croissant' ? 'decroissant' : 'croissant' }))}
            >
              Sens <span aria-hidden="true">{tri.sens === 'croissant' ? '▲' : tri.sens === 'decroissant' ? '▼' : ''}</span>
            </button>
          </div>

          <div className="mt-2 hidden overflow-x-auto min-[600px]:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {COLONNES.map((c) => (
                    <EnTeteTriable key={c.cle} colonne={c} etat={etat(c.cle)} onBasculer={() => basculer(c.cle)} />
                  ))}
                  <th scope="col" className="px-3">Conseil</th>
                  <th scope="col" className="px-3">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((carte) => (
                  <tr key={carte.id} ref={flip(`t:${carte.id}`)} className="border-b border-line" data-testid="ligne-vente">
                    <td className="break-words px-3 py-2">{carte.titre}</td>
                    <td className="px-3 py-2">{valeurTexte(carte)}</td>
                    <td className="px-3 py-2">{departTexte(carte)}</td>
                    <td className="px-3 py-2 text-muted">{conseil(carte)}</td>
                    <td className="px-3 py-2">{actionMise(carte)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-2 grid gap-2 min-[600px]:hidden">
            {lignes.map((carte) => (
              <li key={carte.id} ref={flip(`c:${carte.id}`)} className="grid gap-1 rounded border border-line bg-ink p-3" data-testid="ligne-vente">
                <span className="min-w-0 break-words font-semibold">{carte.titre}</span>
                <span>Valeur : {valeurTexte(carte)}</span>
                <span>Départ : {departTexte(carte)}</span>
                <span className="text-sm text-muted">{conseil(carte)}</span>
                <div>{actionMise(carte)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      <HeuresFortes nbObservations={observations(ventes)} />

      {enAttente > 0 && <p className="mt-3 text-sm text-muted">{enAttente} {enAttente > 1 ? 'cartes en attente' : 'carte en attente'} d’une place libre.</p>}
    </section>
  );
};

export default FileVente;
