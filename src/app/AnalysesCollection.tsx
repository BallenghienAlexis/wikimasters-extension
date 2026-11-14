import React, { useMemo } from 'react';
import type { Carte } from '../lib/collection';
import { doublons, plusCheres, themesFrequents } from '../lib/analyses';
import { LIBELLES_THEMES } from '../lib/themes';

interface Props {
  cartes: readonly Carte[];
  /** Change quand la surcouche Wikipédia modifie les thèmes lus. */
  cacheWiki: unknown;
}

const AFFICHEES = 10;
const nombre = new Intl.NumberFormat('fr-FR');

const Bloc: React.FC<{ id: string; titre: string; vide: string; children: React.ReactNode[] }> = ({ id, titre, vide, children }) => (
  <section data-testid={`analyse-${id}`} className="rounded border border-line bg-ink-2 p-4 shadow-carte">
    <h3 className="text-lg font-semibold">{titre}</h3>
    {children.length === 0 ? (
      <p className="mt-2 text-muted">{vide}</p>
    ) : (
      <ul className="mt-2 space-y-1">{children}</ul>
    )}
  </section>
);

const Ligne: React.FC<{ carte: Carte; suffixe?: string }> = ({ carte, suffixe }) => (
  <li className="break-words">
    {carte.titre}
    {suffixe ? <span className="text-muted"> · {suffixe}</span> : null}
  </li>
);

const Reste: React.FC<{ total: number }> = ({ total }) => (
  <li className="text-sm text-muted">… et {total - AFFICHEES} autres</li>
);

/** Analyses de l’onglet Collection (SC-021) : calculs de `analyses.ts`, titres rendus en texte. */
const AnalysesCollection: React.FC<Props> = ({ cartes, cacheWiki }) => {
  const a = useMemo(
    () => ({
      doublons: doublons(cartes),
      cheres: plusCheres(cartes),
      themes: themesFrequents(cartes),
    }),
    // `cacheWiki` change les thèmes déduits (surcouche Wikipédia).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cartes, cacheWiki],
  );
  const maxTheme = Math.max(1, ...a.themes.map((t) => t.nombre));
  const liste = (cs: Carte[], suffixe?: (c: Carte) => string): React.ReactNode[] => [
    ...cs.slice(0, AFFICHEES).map((c) => <Ligne key={c.id} carte={c} suffixe={suffixe?.(c)} />),
    ...(cs.length > AFFICHEES ? [<Reste key="reste" total={cs.length} />] : []),
  ];
  return (
    <section aria-labelledby="titre-analyses" className="mt-8">
      <h2 id="titre-analyses" className="text-xl font-semibold">Analyses</h2>
      <div className="mt-4 grid gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-3">
        <Bloc id="doublons" titre={`Doublons (${a.doublons.length})`} vide="Aucun doublon.">
          {liste(a.doublons, (c) => `${c.quantite} exemplaires`)}
        </Bloc>
        <Bloc id="plus-cheres" titre="10 plus chères" vide="Aucune carte avec une valeur connue.">
          {a.cheres.map((c) => (
            <Ligne key={c.id} carte={c} suffixe={`valeur ${c.valeurMarchande ?? 0}`} />
          ))}
        </Bloc>
        <Bloc id="themes" titre="10 thèmes" vide="Aucun thème repéré.">
          {a.themes.map((t) => (
            <li key={t.theme} className="grid grid-cols-[minmax(0,7rem)_1fr_minmax(2rem,auto)] items-center gap-3">
              <span className="truncate" title={LIBELLES_THEMES[t.theme] ?? t.theme}>
                {LIBELLES_THEMES[t.theme] ?? t.theme}
              </span>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-line">
                <span className="block h-2 rounded-full bg-paper" style={{ width: `${Math.max(3, (t.nombre / maxTheme) * 100)}%` }} />
              </span>
              <span className="text-right text-muted">
                {nombre.format(t.nombre)}
                <span className="sr-only"> cartes</span>
              </span>
            </li>
          ))}
        </Bloc>
      </div>
    </section>
  );
};

export default AnalysesCollection;
