import React, { useId, useMemo, useState } from 'react';
import BlocTableauDeBord from './BlocTableauDeBord';
import { cheminSecteur, pourcentage, secteurs, totalParts, type Part } from '../lib/graphiquesTableauDeBord';

interface Props {
  id: string;
  titre: string;
  /** Phrase sous le titre : ce qui est compté et d’où ça vient. */
  explication: string;
  parts: readonly Part[];
  /** Couleur de chaque part (variables de `tokens.css` seulement) ; défaut : palette par rang. */
  couleurDe?: (part: Part, rang: number) => string | undefined;
  /** Texte quand il n’y a rien à répartir. */
  vide: string;
  /** Unité du total au centre (« cartes »). */
  unite: string;
  /**
   * Mode « étiquettes » : pas de légende, le nom et le pourcentage sont écrits sur les parts assez grandes, les autres se lisent
   * au survol et au focus ; grand diagramme, palette étendue (Alexis, 2026-11-24).
   */
  etiquettes?: boolean;
  /** Classes du bloc (étendue de colonnes). */
  className?: string;
}

// Palette par rang, tirée des tokens (aucune couleur nouvelle) ; la dernière, `muted`, sert aux regroupements.
const PALETTE = ['var(--color-garder)', 'var(--color-echanger)', 'var(--color-vendre)', 'var(--color-defausser)', 'var(--color-paper)', 'var(--color-muted)'];
const SEUIL_ETIQUETTE = 6; // part minimale (en %) pour écrire le nom sur le secteur
const tronquer = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
/** Palette étendue pour beaucoup de parts : les 5 couleurs de rôle, pures puis éclaircies/assombries vers `paper`. */
const PALETTE_ETENDUE = [...PALETTE.slice(0, 5), ...PALETTE.slice(0, 5).map((c) => `color-mix(in srgb, ${c} 62%, var(--color-paper))`)];
const nombre = new Intl.NumberFormat('fr-FR');

/**
 * Camembert (anneau) accessible : légende à droite avec valeur et pourcentage (la couleur n’est jamais le seul repère),
 * détail au survol et au focus, tableau alternatif `sr-only`. SVG maison, aucune dépendance.
 */
const CamembertRepartition: React.FC<Props> = ({ id, titre, explication, parts, couleurDe, vide, unite, etiquettes = false, className }) => {
  const [actif, setActif] = useState<string | null>(null);
  const idDesc = useId();
  const total = totalParts(parts);
  const arcs = useMemo(() => secteurs(parts), [parts]);
  const couleur = (p: Part, rang: number): string =>
    couleurDe?.(p, rang) ?? (etiquettes ? PALETTE_ETENDUE[rang % PALETTE_ETENDUE.length]! : PALETTE[Math.min(rang, PALETTE.length - 1)]!);
  const choisie = parts.find((p) => p.id === actif);
  const vb = etiquettes ? 380 : 180;
  const c0 = vb / 2;
  const rExt = etiquettes ? 172 : 80;
  const rInt = etiquettes ? 72 : 46;
  const detail = choisie ? `${choisie.libelle} : ${nombre.format(choisie.valeur)} ${unite}, ${pourcentage(choisie.valeur, total)}\u00a0%` : null;
  const resume = total === 0 ? 'Aucune donnée' : `${nombre.format(total)} ${unite} · ${parts[0]!.libelle} ${pourcentage(parts[0]!.valeur, total)}\u00a0%`;

  return (
    <BlocTableauDeBord id={id} titre={titre} resume={resume} className={className}>
      <p className="sr-only" id={idDesc}>{explication}</p>
      {total === 0 ? (
        <p className="mt-2 text-sm text-muted">{vide}</p>
      ) : (
        <div className={etiquettes ? 'mt-1 flex flex-col items-center gap-1' : 'mt-2 flex flex-wrap items-center gap-3'}>
          {etiquettes && (
            <p className="min-h-5 text-center text-sm" data-testid="camembert-detail" aria-live="off">
              {detail ?? 'Survolez ou focalisez une part pour lire son détail.'}
            </p>
          )}
          <svg
            viewBox={`0 0 ${vb} ${vb}`}
            width={etiquettes ? undefined : 132}
            height={etiquettes ? undefined : 132}
            role="group"
            aria-label={titre}
            aria-describedby={idDesc}
            className={etiquettes ? 'aspect-square w-full max-w-[26rem]' : 'size-[132px] shrink-0'}
          >
            {arcs.map((a) => {
              const rang = parts.findIndex((p) => p.id === a.id);
              const p = parts[rang]!;
              return (
                <path
                  key={a.id}
                  data-testid="camembert-secteur"
                  data-id={a.id}
                  d={cheminSecteur(c0, c0, actif === a.id ? rExt + 5 : rExt, rInt, a.debut, a.fin)}
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
            {etiquettes &&
              arcs.map((a) => {
                const p = parts.find((q) => q.id === a.id)!;
                const part = (p.valeur / total) * 100;
                if (part < SEUIL_ETIQUETTE) return null;
                const milieu = (a.debut + a.fin) / 2;
                const r = (rExt + rInt) / 2;
                const x = c0 + r * Math.sin(milieu);
                const y = c0 - r * Math.cos(milieu);
                return (
                  <text key={`e-${a.id}`} data-testid="camembert-etiquette" x={x} y={y - 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink)" aria-hidden="true" pointerEvents="none">
                    {tronquer(p.libelle, 11)}
                    <tspan x={x} dy="12" fontWeight="400">{pourcentage(p.valeur, total)}&nbsp;%</tspan>
                  </text>
                );
              })}
            <text x={c0} y={c0 - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--color-paper)" aria-hidden="true">
              {nombre.format(choisie ? choisie.valeur : total)}
            </text>
            <text x={c0} y={c0 + 16} textAnchor="middle" fontSize="11" fill="var(--color-muted)" aria-hidden="true">
              {choisie ? `${pourcentage(choisie.valeur, total)}\u00a0%` : unite}
            </text>
          </svg>
          {!etiquettes && <ul className="grid min-w-44 flex-1 text-sm" data-testid="camembert-legende">
            {parts.map((p, rang) => (
              <li
                key={p.id}
                className={`flex min-h-6 items-center gap-2 rounded px-1 ${actif === p.id ? 'bg-(--surface-survol)' : ''}`}
                onMouseEnter={() => setActif(p.id)}
                onMouseLeave={() => setActif(null)}
              >
                <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-sm border border-line" style={{ background: couleur(p, rang) }} />
                <span className="min-w-0 flex-1 truncate">{p.libelle}</span>
                <span className="shrink-0 tabular-nums">{nombre.format(p.valeur)}</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{pourcentage(p.valeur, total)}&nbsp;%</span>
              </li>
            ))}
          </ul>}
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
    </BlocTableauDeBord>
  );
};

export default CamembertRepartition;
