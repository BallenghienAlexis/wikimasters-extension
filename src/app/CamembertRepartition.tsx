import React, { useId, useMemo, useState } from 'react';
import SectionRepliable from './SectionRepliable';
import { cheminSecteur, pourcentage, secteurs, totalParts, type Part } from '../lib/graphiquesTableauDeBord';

interface Props {
  id: string;
  titre: string;
  /** Phrase sous le titre : ce qui est compté et d’où ça vient. */
  explication: string;
  parts: readonly Part[];
  /** Couleur de chaque part (variables de `tokens.css` seulement) ; défaut : palette par rang. */
  couleurDe?: (part: Part, rang: number) => string;
  /** Texte quand il n’y a rien à répartir. */
  vide: string;
  /** Unité du total au centre (« cartes »). */
  unite: string;
  ouvertParDefaut?: boolean;
}

// Palette par rang, tirée des tokens (aucune couleur nouvelle) ; la dernière, `muted`, sert aux regroupements.
const PALETTE = ['var(--color-garder)', 'var(--color-echanger)', 'var(--color-vendre)', 'var(--color-defausser)', 'var(--color-paper)', 'var(--color-muted)'];
const R = 80;
const R_INT = 46;
const nombre = new Intl.NumberFormat('fr-FR');

/**
 * Camembert (anneau) accessible : légende à droite avec valeur et pourcentage (la couleur n’est jamais le seul repère),
 * détail au survol et au focus, tableau alternatif `sr-only`. SVG maison, aucune dépendance.
 */
const CamembertRepartition: React.FC<Props> = ({ id, titre, explication, parts, couleurDe, vide, unite, ouvertParDefaut = false }) => {
  const [actif, setActif] = useState<string | null>(null);
  const idDesc = useId();
  const total = totalParts(parts);
  const arcs = useMemo(() => secteurs(parts), [parts]);
  const couleur = (p: Part, rang: number): string => couleurDe?.(p, rang) ?? PALETTE[Math.min(rang, PALETTE.length - 1)]!;
  const choisie = parts.find((p) => p.id === actif);
  const resume = total === 0 ? 'Aucune donnée' : `${nombre.format(total)} ${unite} · ${parts[0]!.libelle} ${pourcentage(parts[0]!.valeur, total)}\u00a0%`;

  return (
    <SectionRepliable id={id} testId={id} className="mt-4" titre={titre} resume={resume} ouvertParDefaut={ouvertParDefaut}>
      <p className="mt-1 text-sm text-muted" id={idDesc}>{explication}</p>
      {total === 0 ? (
        <p className="mt-2 text-muted">{vide}</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <svg viewBox="0 0 180 180" width="180" height="180" role="group" aria-label={titre} aria-describedby={idDesc} className="shrink-0">
            {arcs.map((a) => {
              const rang = parts.findIndex((p) => p.id === a.id);
              const p = parts[rang]!;
              return (
                <path
                  key={a.id}
                  data-testid="camembert-secteur"
                  data-id={a.id}
                  d={cheminSecteur(90, 90, actif === a.id ? R + 5 : R, R_INT, a.debut, a.fin)}
                  fill={couleur(p, rang)}
                  stroke="var(--color-ink-2)"
                  strokeWidth={2}
                  tabIndex={0}
                  role="img"
                  aria-label={`${p.libelle} : ${nombre.format(p.valeur)} ${unite}, ${pourcentage(p.valeur, total)}\u00a0%`}
                  onMouseEnter={() => setActif(a.id)}
                  onMouseLeave={() => setActif(null)}
                  onFocus={() => setActif(a.id)}
                  onBlur={() => setActif(null)}
                />
              );
            })}
            <text x="90" y="88" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--color-paper)" aria-hidden="true">
              {nombre.format(choisie ? choisie.valeur : total)}
            </text>
            <text x="90" y="106" textAnchor="middle" fontSize="11" fill="var(--color-muted)" aria-hidden="true">
              {choisie ? `${pourcentage(choisie.valeur, total)}\u00a0%` : unite}
            </text>
          </svg>
          <ul className="grid w-full min-w-0 gap-1 text-sm" data-testid="camembert-legende">
            {parts.map((p, rang) => (
              <li
                key={p.id}
                className={`flex min-h-8 items-center gap-2 rounded px-2 ${actif === p.id ? 'bg-(--surface-survol)' : ''}`}
                onMouseEnter={() => setActif(p.id)}
                onMouseLeave={() => setActif(null)}
              >
                <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm border border-line" style={{ background: couleur(p, rang) }} />
                <span className="min-w-0 flex-1 truncate">{p.libelle}</span>
                <span className="shrink-0 tabular-nums">{nombre.format(p.valeur)}</span>
                <span className="w-12 shrink-0 text-right tabular-nums text-muted">{pourcentage(p.valeur, total)}&nbsp;%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="sr-only">
      <table>
        <caption>{titre}</caption>
        <thead>
          <tr><th scope="col">Part</th><th scope="col">{unite}</th></tr>
        </thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.id}><th scope="row">{p.libelle}</th><td>{p.valeur}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </SectionRepliable>
  );
};

export default CamembertRepartition;
