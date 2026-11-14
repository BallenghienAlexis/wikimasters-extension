import React, { useMemo } from "react";
import type { Carte } from "../lib/collection";

interface Props {
  cartes: readonly Carte[];
}

const ORDRE = ["C", "R", "SR", "E", "UR", "L"];

/** Répartition par rareté (titres, puis cartes à garder, échanger, vendre) : donnée locale, aucune requête. */
const TableauRaretes: React.FC<Props> = ({ cartes }) => {
  const lignes = useMemo(() => {
    const par = new Map<
      string,
      { t: number; g: number; e: number; v: number }
    >();
    for (const c of cartes) {
      const k = c.rarete ?? "Sans rareté";
      const l = par.get(k) ?? { t: 0, g: 0, e: 0, v: 0 };
      l.t += 1;
      if (c.statut === "garder") l.g += 1;
      if (c.statut === "echanger") l.e += 1;
      if (c.statut === "vendre") l.v += 1;
      par.set(k, l);
    }
    const rang = (k: string): number => {
      const i = ORDRE.indexOf(k);
      return i < 0 ? ORDRE.length : i;
    };
    return [...par.entries()].sort(
      (a, b) => rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], "fr"),
    );
  }, [cartes]);
  if (lignes.length === 0) return null;
  const th = "border-b border-line px-2 py-1.5 text-left font-semibold";
  const td = "border-b border-line px-2 py-1.5";
  return (
    <div className="mt-4 max-w-full overflow-x-auto">
      <table
        data-testid="tableau-raretes"
        className="w-full border-collapse text-sm"
      >
        <thead>
          <tr>
            <th className={th}>Rareté</th>
            <th className={th}>Titres</th>
            <th className={th}>Garder</th>
            <th className={th}>Échanger</th>
            <th className={th}>Vendre</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map(([nom, l]) => (
            <tr key={nom}>
              <td className={td}>{nom}</td>
              <td className={`${td} tabular-nums`}>{l.t}</td>
              <td className={`${td} tabular-nums`}>{l.g}</td>
              <td className={`${td} tabular-nums`}>{l.e}</td>
              <td className={`${td} tabular-nums`}>{l.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableauRaretes;
