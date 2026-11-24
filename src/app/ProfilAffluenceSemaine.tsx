import React, { useMemo, useState } from 'react';
import BlocTableauDeBord from './BlocTableauDeBord';
import { CONFIG_AFFLUENCE } from '../config/affluence';
import type { EvenementVente } from '../lib/affluence';
import { JOURS_AFFICHES, libelleTranche, NOMS_JOURS, profilAffluence, TRANCHES, type CelluleAffluence } from '../lib/graphiquesTableauDeBord';

interface Props {
  evenements: readonly EvenementVente[];
}

const COL = 17;
const LIG = 20;
const MARGE_G = 34;
const MARGE_H = 16;

const intensite = (c: CelluleAffluence, maximum: number): number => (maximum <= 0 ? 0 : Math.min(1, c.valeur / maximum));

/**
 * Heures de plus forte affluence sur une semaine : 7 jours × 24 heures (Alexis, 2026-11-24). Les données sont celles de
 * VOS enchères (pas de tout le site) : le graphique s’affine à chaque enchère terminée, et suit exactement la règle qui choisit
 * la durée des enchères. Contour = heure forte ; valeur écrite au survol et au focus ; tableau alternatif.
 */
const ProfilAffluenceSemaine: React.FC<Props> = ({ evenements }) => {
  const profil = useMemo(() => profilAffluence(evenements), [evenements]);
  const [actif, setActif] = useState<CelluleAffluence | null>(null);
  const largeur = MARGE_G + TRANCHES * COL;
  const hauteur = MARGE_H + 7 * LIG;
  const manque = Math.max(0, CONFIG_AFFLUENCE.minVentesConclues - profil.nombre);
  const origine =
    profil.source === 'resultats'
      ? `Calculé d’après vos ${profil.nombre} enchères terminées (prix final, vitesse de montée).`
      : profil.source === 'observations'
        ? `Calculé d’après ${profil.nombre} mises en vente notées ; ${manque} enchère${manque > 1 ? 's' : ''} terminée${manque > 1 ? 's' : ''} de plus pour passer aux ventes réelles.`
        : `Créneaux par défaut : pas encore assez de données (${profil.nombre} observation${profil.nombre > 1 ? 's' : ''}). Le graphique se précisera après ${CONFIG_AFFLUENCE.minVentesConclues} enchères terminées.`;
  const texte = (c: CelluleAffluence): string => {
    const base = `${NOMS_JOURS[c.jour]} ${libelleTranche(c.tranche)}`;
    const forte = c.forte ? ', heure forte' : '';
    if (profil.source === 'resultats') return c.nombre === 0 ? `${base} : aucune enchère terminée${forte}` : `${base} : rendement moyen ${c.valeur.toFixed(1).replace('.', ',')} sur ${c.nombre} enchère${c.nombre > 1 ? 's' : ''}${forte}`;
    if (profil.source === 'observations') return `${base} : ${c.nombre} mise${c.nombre > 1 ? 's' : ''} en vente${forte}`;
    return `${base}${c.forte ? ' : heure forte par défaut' : ' : heure creuse par défaut'}`;
  };

  return (
    <BlocTableauDeBord
      id="profil-affluence"
      titre="Heures de forte affluence"
      resume={profil.source === 'resultats' ? `Vos ${profil.nombre} enchères` : 'Créneaux par défaut'}
    >
      <p className="mt-1 text-xs text-muted">Heure par heure, <strong>sur vos propres enchères</strong>. {origine}</p>
      <p className="mt-1 min-h-5 text-xs" data-testid="affluence-valeur" aria-live="off">
        {actif ? texte(actif) : 'Survolez une case pour son détail.'}
      </p>
      <div className="mt-1 overflow-x-auto rounded border border-line bg-ink p-1.5">
        <svg viewBox={`0 0 ${largeur} ${hauteur}`} style={{ width: '100%', minWidth: largeur, maxWidth: largeur * 1.5 }} role="group" aria-label="Affluence par jour et par heure" className="block">
          {Array.from({ length: TRANCHES }, (_, t) => t % 3 === 0 ? (
            <text key={t} x={MARGE_G + t * COL + COL / 2 - 1} y={11} fontSize="9" textAnchor="middle" fill="var(--color-muted)" aria-hidden="true">{t}h</text>
          ) : null)}
          {JOURS_AFFICHES.map((jour, y) => (
            <text key={jour} x={0} y={MARGE_H + y * LIG + LIG / 2 + 3} fontSize="10" fill="var(--color-muted)" aria-hidden="true">{NOMS_JOURS[jour]!.slice(0, 3)}.</text>
          ))}
          {profil.jours.map((ligne, y) =>
            ligne.map((c) => {
              const i = intensite(c, profil.maximum);
              return (
                <rect
                  key={`${c.jour}-${c.tranche}`}
                  data-testid="affluence-case"
                  data-forte={c.forte}
                  x={MARGE_G + c.tranche * COL + 1}
                  y={MARGE_H + y * LIG + 1}
                  width={COL - 2}
                  height={LIG - 2}
                  rx={3}
                  fill={i === 0 ? 'color-mix(in srgb, var(--color-line) 55%, var(--color-ink))' : `color-mix(in srgb, var(--color-vendre) ${Math.round(20 + 80 * i)}%, var(--color-ink))`}
                  stroke={c.forte ? 'var(--color-paper)' : 'none'}
                  strokeWidth={2}
                  tabIndex={0}
                  role="img"
                  aria-label={texte(c)}
                  onMouseEnter={() => setActif(c)}
                  onMouseLeave={() => setActif(null)}
                  onFocus={() => setActif(c)}
                  onBlur={() => setActif(null)}
                />
              );
            }),
          )}
        </svg>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: 'color-mix(in srgb, var(--color-vendre) 100%, var(--color-ink))' }} />plus de rendement</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm border-2 border-paper" />heure forte</span>
      </p>
      <div className="sr-only">
      <table>
        <caption>Affluence par jour et par heure</caption>
        <thead>
          <tr><th scope="col">Jour</th><th scope="col">Heure</th><th scope="col">Détail</th></tr>
        </thead>
        <tbody>
          {profil.jours.flat().filter((c) => c.nombre > 0 || c.forte).map((c) => (
            <tr key={`${c.jour}-${c.tranche}`}><th scope="row">{NOMS_JOURS[c.jour]}</th><td>{libelleTranche(c.tranche)}</td><td>{texte(c)}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </BlocTableauDeBord>
  );
};

export default ProfilAffluenceSemaine;
