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
  return (
    <section aria-label="Fraîcheur des prix" data-testid="fraicheur-prix" className="mt-4 rounded border border-line bg-ink-2 p-4">
      <h3 className="font-semibold">Prix du marché</h3>
      <p className="mt-1">{`Prix relevés\u00a0: ${valides.length}`}</p>
      <p className="text-sm text-muted">{`Le plus récent\u00a0: ${recent === null ? '—' : ageDe(recent, maintenant)}`}</p>
      <p className="text-sm text-muted">{`Le plus ancien\u00a0: ${ancien === null ? '—' : ageDe(ancien, maintenant)}`}</p>
    </section>
  );
};

export default FraicheurPrix;
