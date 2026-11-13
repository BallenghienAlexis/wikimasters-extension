import { describe, expect, it } from "vitest";
import { basculerTri, trierLignes } from "../../src/lib/ordreTableau";

// SC-024 (D-16) : fonction de tri des tableaux. Données fictives.
// Contrat supposé : trierLignes(lignes, cle, sens) ; sens 'croissant' | 'decroissant' | null ;
// cle(ligne) renvoie string | number | null | undefined (inconnue) ; renvoie un nouveau tableau.
// basculerTri(sensActuel) : null → 'croissant' → 'decroissant' → null.
type L = { id: string; titre?: string | null; valeur?: number | null };

describe("SC-024 : ordreTableau", () => {
  const lignes: L[] = [
    { id: "a", titre: "Étoile", valeur: 5 },
    { id: "b", titre: "Zèbre", valeur: null },
    { id: "c", titre: "Eau", valeur: 5 },
    { id: "d", titre: null, valeur: 2 },
    { id: "e", titre: "abeille", valeur: undefined },
  ];
  const ids = (l: L[]) => l.map((x) => x.id);

  it("SC-024 : compare les titres avec localeCompare(fr) (accents, casse)", () => {
    const r = trierLignes(lignes, (l) => l.titre, "croissant");
    expect(ids(r).slice(0, 4)).toEqual(["e", "c", "a", "b"]);
  });

  it("SC-024 : les valeurs inconnues restent en dernier en croissant", () => {
    const r = trierLignes(lignes, (l) => l.valeur, "croissant");
    expect(ids(r).slice(0, 3)).toEqual(["d", "a", "c"]);
    expect(new Set(ids(r).slice(3))).toEqual(new Set(["b", "e"]));
  });

  it("SC-024 : les valeurs inconnues restent en dernier en décroissant", () => {
    const r = trierLignes(lignes, (l) => l.valeur, "decroissant");
    expect(ids(r).slice(0, 3)).toEqual(["a", "c", "d"]);
    expect(new Set(ids(r).slice(3))).toEqual(new Set(["b", "e"]));
  });

  it("SC-024 : tri stable à valeurs égales, dans les deux sens", () => {
    expect(
      ids(trierLignes(lignes, (l) => l.valeur, "croissant")).slice(1, 3),
    ).toEqual(["a", "c"]);
    expect(
      ids(trierLignes(lignes, (l) => l.valeur, "decroissant")).slice(0, 2),
    ).toEqual(["a", "c"]);
    expect(
      ids(trierLignes(lignes, (l) => l.valeur, "croissant")).slice(3),
    ).toEqual(["b", "e"]);
    expect(
      ids(trierLignes(lignes, (l) => l.valeur, "decroissant")).slice(3),
    ).toEqual(["b", "e"]);
  });

  it("SC-024 : sans sens, l’ordre d’origine est conservé", () => {
    expect(ids(trierLignes(lignes, (l) => l.titre, null))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("SC-024 : ne modifie pas le tableau d’entrée", () => {
    const copie = [...lignes];
    trierLignes(lignes, (l) => l.titre, "decroissant");
    expect(lignes).toEqual(copie);
  });

  it("SC-024 : le cycle va croissant, décroissant, aucun", () => {
    expect(basculerTri(null)).toBe("croissant");
    expect(basculerTri("croissant")).toBe("decroissant");
    expect(basculerTri("decroissant")).toBeNull();
  });
});
