import React from 'react';

interface Props {
  /** Dates (ms) de relevé de chaque prix connu. */
  releves: readonly number[];
  maintenant: number;
}

/** « il y a 3 min », « il y a 2 h », « il y a 4 j » ; « à l’instant » sous une minute. */
export function ageDe(date: number, maintenant: number): string {
  const s = Math.max(0, Math.floor((maintenant - date) / 1000));
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)}\u00a0min`;
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)}\u00a0h`;
  return `il y a ${Math.floor(s / 86_400)}\u00a0j`;
}

/** Fraîcheur des prix (H4) : nombre de prix relevés, relevé le plus récent et le plus ancien. */
const FraicheurPrix: React.FC<Props> = ({ releves, maintenant }) => {
  const valides = releves.filter((d) => Number.isFinite(d));
  const recent = valides.length > 0 ? Math.max(...valides) : null;
  const ancien = valides.length > 0 ? Math.min(...valides) : null;
  const JOUR = 86_400_000;
  const tranches = [
    { nom: 'Moins de 7 jours', fond: 'bg-garder', n: valides.filter((d) => maintenant - d < 7 * JOUR).length },
    { nom: '7 à 30 jours', fond: 'bg-vendre', n: valides.filter((d) => maintenant - d >= 7 * JOUR && maintenant - d < 30 * JOUR).length },
    { nom: 'Plus de 30 jours', fond: 'bg-defausser', n: valides.filter((d) => maintenant - d >= 30 * JOUR).length },
  ];
  return (
    <section aria-label="Fraîcheur des prix" data-testid="fraicheur-prix" className="mt-4 rounded border border-line bg-ink-2 p-4">
      <h3 className="font-semibold">Prix du marché</h3>
      <p className="mt-1">{`Prix relevés\u00a0: ${valides.length}`}</p>
      <p className="text-sm text-muted">{`Le plus récent\u00a0: ${recent === null ? '—' : ageDe(recent, maintenant)}`}</p>
      <p className="text-sm text-muted">{`Le plus ancien\u00a0: ${ancien === null ? '—' : ageDe(ancien, maintenant)}`}</p>
      {valides.length > 0 && (
        <>
          <div
            data-testid="fraicheur-barre"
            role="img"
            aria-label={tranches.map((t) => `${t.nom}\u00a0: ${t.n}`).join('. ')}
            className="mt-3 flex h-[18px] overflow-hidden rounded-sm border border-paper"
          >
            {tranches.filter((t) => t.n > 0).map((t) => (
              <div key={t.nom} className={t.fond} style={{ width: `${(t.n / valides.length) * 100}%` }} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            {tranches.map((t) => (
              <span key={t.nom}>{`${t.nom}\u00a0: ${t.n}`}</span>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default FraicheurPrix;
