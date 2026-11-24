import React, { useMemo, useState } from 'react';
import BlocTableauDeBord from './BlocTableauDeBord';
import {
  calendrierActivite, CATEGORIES_ACTIVITE, LIBELLES_ACTIVITE, niveauActivite, type ActiviteJours, type FiltreActivite,
} from '../lib/graphiquesTableauDeBord';

interface Props {
  activite: ActiviteJours;
  /** Horloge injectée (tests). */
  maintenant?: Date;
}

const PERIODES = [4, 8, 12, 26] as const;
const FILTRES: readonly FiltreActivite[] = ['tout', ...CATEGORIES_ACTIVITE];
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
// Intensité : la couleur `garder` plus ou moins mêlée au fond ; la valeur est aussi écrite (survol, focus, tableau).
const REMPLISSAGE = [
  'color-mix(in srgb, var(--color-line) 55%, var(--color-ink-2))',
  'color-mix(in srgb, var(--color-garder) 28%, var(--color-ink-2))',
  'color-mix(in srgb, var(--color-garder) 50%, var(--color-ink-2))',
  'color-mix(in srgb, var(--color-garder) 75%, var(--color-ink-2))',
  'var(--color-garder)',
];

const dateLongue = (jour: string): string => new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const accorder = (n: number, s: string, p: string): string => `${n} ${n > 1 ? p : s}`;

/**
 * Historique de contribution façon GitHub (Alexis, 2026-11-24) : une case par jour, semaines en colonnes, intensité selon le
 * nombre d’actions (enchères lancées, ventes réussies, défausses, étiquettes et favoris). Période et catégorie au choix ;
 * valeur écrite au survol et au focus, tableau alternatif pour les lecteurs d’écran. Lecture seule du stockage.
 */
const CalendrierActivite: React.FC<Props> = ({ activite, maintenant }) => {
  const [semaines, setSemaines] = useState<number>(12);
  const [filtre, setFiltre] = useState<FiltreActivite>('tout');
  const [actif, setActif] = useState<string | null>(null);
  const [horloge] = useState(() => maintenant ?? new Date());
  const cal = useMemo(() => calendrierActivite(activite, filtre, semaines, horloge), [activite, filtre, semaines, horloge]);
  const jours = cal.semaines.flat();
  const survol = jours.find((j) => j.jour === actif && !j.futur);
  const mois = cal.semaines.map((s, i) => {
    const premier = s.find((j) => j.jour.endsWith('-01') || j === s[0]);
    const m = new Date(`${s[0]!.jour}T12:00:00`).getMonth();
    const precedent = i > 0 ? new Date(`${cal.semaines[i - 1]![0]!.jour}T12:00:00`).getMonth() : -1;
    return premier && m !== precedent ? { i, nom: new Date(`${s[0]!.jour}T12:00:00`).toLocaleDateString('fr-FR', { month: 'short' }) } : null;
  });

  return (
    <BlocTableauDeBord
      id="calendrier-activite"
      className="flex flex-col"
      titre="Historique d’activité"
      resume={cal.total === 0 ? 'Aucune activité' : `${accorder(cal.total, 'action', 'actions')} · ${accorder(cal.joursActifs, 'jour actif', 'jours actifs')}`}
    >
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <label className="inline-flex items-center gap-2">
          Période
          <select className="min-h-9 rounded border border-line bg-ink px-1" value={semaines} onChange={(e) => setSemaines(Number(e.target.value))}>
            {PERIODES.map((p) => (
              <option key={p} value={p}>{p} semaines</option>
            ))}
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          Activité
          <select className="min-h-9 rounded border border-line bg-ink px-1" value={filtre} onChange={(e) => setFiltre(e.target.value as FiltreActivite)}>
            {FILTRES.map((f) => (
              <option key={f} value={f}>{LIBELLES_ACTIVITE[f]}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 min-h-5 text-xs" data-testid="activite-valeur" aria-live="off">
        {survol
          ? `${dateLongue(survol.jour)} : ${accorder(survol.n, 'action', 'actions')}${filtre === 'tout' && survol.n > 0 ? ` (${CATEGORIES_ACTIVITE.filter((k) => survol.detail[k] > 0).map((k) => `${survol.detail[k]} ${LIBELLES_ACTIVITE[k].toLowerCase()}`).join(', ')})` : ''}`
          : 'Survolez une case pour son détail.'}
      </p>
      <div className="mt-1 flex min-h-40 flex-1 rounded border border-line bg-ink p-1.5">
        <div
          role="group"
          aria-label={`Activité des ${semaines} dernières semaines`}
          className="grid w-full gap-[3px]"
          style={{ gridTemplateColumns: `1.75rem repeat(${cal.semaines.length}, minmax(0, 1fr))`, gridTemplateRows: 'auto repeat(7, minmax(0, 1fr))' }}
        >
          {mois.map((m) =>
            m ? (
              <span key={m.i} className="overflow-visible whitespace-nowrap text-[10px] leading-none text-muted" style={{ gridColumn: m.i + 2, gridRow: 1 }} aria-hidden="true">{m.nom}</span>
            ) : null,
          )}
          {JOURS.map((nom, i) =>
            i % 2 === 0 ? (
              <span key={nom} className="flex items-center text-[10px] leading-none text-muted" style={{ gridColumn: 1, gridRow: i + 2 }} aria-hidden="true">{nom}</span>
            ) : null,
          )}
          {cal.semaines.map((s, x) =>
            s.map((j, y) =>
              j.futur ? null : (
                <div
                  key={j.jour}
                  data-testid="activite-case"
                  data-jour={j.jour}
                  data-niveau={niveauActivite(j.n, cal.maximum)}
                  className="min-h-3 min-w-0 rounded-[3px]"
                  style={{
                    gridColumn: x + 2,
                    gridRow: y + 2,
                    background: REMPLISSAGE[niveauActivite(j.n, cal.maximum)],
                    outline: actif === j.jour ? '2px solid var(--color-paper)' : 'none',
                    outlineOffset: -1,
                  }}
                  tabIndex={j.n > 0 ? 0 : undefined}
                  role={j.n > 0 ? 'img' : undefined}
                  aria-label={j.n > 0 ? `${dateLongue(j.jour)} : ${accorder(j.n, 'action', 'actions')}` : undefined}
                  onMouseEnter={() => setActif(j.jour)}
                  onMouseLeave={() => setActif(null)}
                  onFocus={() => setActif(j.jour)}
                  onBlur={() => setActif(null)}
                />
              ),
            ),
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted" aria-hidden="true">
        Moins
        {REMPLISSAGE.map((c) => (
          <span key={c} className="inline-block size-2.5 rounded-sm" style={{ background: c }} />
        ))}
        Plus
      </div>
      <p className="sr-only">Compté depuis le journal des actions réussies, les relances automatiques et les enchères terminées ; les ventes sont datées de leur mise en vente.</p>
      <div className="sr-only">
      <table>
        <caption>Actions par jour ({LIBELLES_ACTIVITE[filtre]})</caption>
        <thead>
          <tr><th scope="col">Jour</th><th scope="col">Actions</th></tr>
        </thead>
        <tbody>
          {jours.filter((j) => j.n > 0).map((j) => (
            <tr key={j.jour}><th scope="row">{j.jour}</th><td>{j.n}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </BlocTableauDeBord>
  );
};

export default CalendrierActivite;
