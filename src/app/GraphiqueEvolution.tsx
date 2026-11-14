import React, { useEffect, useMemo, useState } from 'react';
import { serie30Jours, type PointHistorique } from '../lib/historique';
import { chargerHistorique, ecouterHistorique } from '../lib/stockage';

const jourCourt = (jour: string): string => `${jour.slice(8, 10)}/${jour.slice(5, 7)}`;

/**
 * Évolution du nombre d’exemplaires sur 30 jours (SC-020) : colonnes `paper` sur piste `ink-2`, trous pour
 * les jours sans point, valeur écrite au survol et au focus, tableau alternatif `sr-only`.
 * Lecture seule de la clé `historique` (l’écriture est faite par `useHistoriqueQuotidien`).
 */
const GraphiqueEvolution: React.FC = () => {
  const [points, setPoints] = useState<PointHistorique[]>([]);
  const [actif, setActif] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    const lire = (): void => {
      chargerHistorique()
        .then((p) => vivant && setPoints(p))
        .catch(() => undefined);
    };
    lire();
    const arreter = ecouterHistorique(lire);
    return () => {
      vivant = false;
      arreter();
    };
  }, []);

  const serie = useMemo(() => serie30Jours(points, new Date()), [points]);
  const dansFenetre = serie.filter((j): j is { jour: string; exemplaires: number } => j.exemplaires !== null);
  const maximum = Math.max(1, ...dansFenetre.map((j) => j.exemplaires));
  const survol = serie.find((j) => j.jour === actif && j.exemplaires !== null);

  return (
    <section data-testid="evolution" aria-labelledby="titre-evolution" className="mt-8">
      <h2 id="titre-evolution" className="text-xl font-semibold">Évolution sur 30 jours</h2>
      {dansFenetre.length < 2 ? (
        <p className="mt-2 text-muted">Historique en cours de constitution ({dansFenetre.length} jour)</p>
      ) : (
        <>
          <p data-testid="evolution-valeur" className="mt-2 min-h-6" aria-live="off">
            {survol ? `${jourCourt(survol.jour)} : ${survol.exemplaires} exemplaires` : 'Survolez ou focalisez une colonne pour lire sa valeur.'}
          </p>
          <div className="mt-2 flex h-32 items-end gap-px rounded border border-line bg-ink-2 p-2">
            {serie.map((j) =>
              j.exemplaires === null ? (
                <div key={j.jour} data-testid="evolution-trou" aria-hidden="true" className="h-full min-w-0 flex-1" />
              ) : (
                <div
                  key={j.jour}
                  data-testid="evolution-colonne"
                  data-jour={j.jour}
                  tabIndex={0}
                  role="img"
                  aria-label={`${jourCourt(j.jour)} : ${j.exemplaires} exemplaires`}
                  className="flex h-full min-w-0 flex-1 items-end rounded-sm focus-visible:shadow-(--halo-focus)"
                  onMouseEnter={() => setActif(j.jour)}
                  onMouseLeave={() => setActif(null)}
                  onFocus={() => setActif(j.jour)}
                  onBlur={() => setActif(null)}
                >
                  <div className="w-full rounded-sm bg-paper" style={{ height: `${Math.max(2, (j.exemplaires / maximum) * 100)}%` }} />
                </div>
              ),
            )}
          </div>
          <table className="sr-only">
            <caption>Exemplaires par jour sur 30 jours</caption>
            <thead>
              <tr>
                <th scope="col">Jour</th>
                <th scope="col">Exemplaires</th>
              </tr>
            </thead>
            <tbody>
              {dansFenetre.map((p) => (
                <tr key={p.jour}>
                  <th scope="row">{p.jour}</th>
                  <td>{p.exemplaires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
};

export default GraphiqueEvolution;
