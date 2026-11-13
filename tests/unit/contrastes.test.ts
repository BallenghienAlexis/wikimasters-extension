import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SC-022 (D-13, D-18) : contrastes calculés depuis tokens.css, deux thèmes, y compris saturate(.45).
const css = readFileSync(
  join(__dirname, "..", "..", "src", "styles", "tokens.css"),
  "utf8",
);

type Rvb = [number, number, number];
const NOMS = [
  "ink",
  "paper",
  "muted",
  "garder",
  "echanger",
  "vendre",
  "defausser",
] as const;

const hex = (h: string): Rvb =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rvb;

const lire = (bloc: string): Record<string, Rvb> => {
  const out: Record<string, Rvb> = {};
  for (const nom of NOMS) {
    const m = new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{6})`).exec(bloc);
    if (m?.[1]) out[nom] = hex(m[1]);
  }
  return out;
};

const debutSombre = css.indexOf("prefers-color-scheme: dark");
const clair = lire(css.slice(0, debutSombre));
const sombre: Record<string, Rvb> = {
  ...clair,
  ...lire(css.slice(debutSombre)),
} as Record<string, Rvb>;

const lin = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: Rvb): number =>
  0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: Rvb, b: Rvb): number => {
  const [la, lb] = [lum(a), lum(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const melange = (a: Rvb, b: Rvb, partA: number): Rvb =>
  a.map((v, i) => v * partA + (b[i] ?? 0) * (1 - partA)) as Rvb;

// filter: saturate(s) : matrice de la spécification Filter Effects.
const saturer = ([r, g, b]: Rvb, s: number): Rvb => {
  const lim = (v: number) => Math.min(255, Math.max(0, v));
  return [
    lim(
      (0.213 + 0.787 * s) * r +
        (0.715 - 0.715 * s) * g +
        (0.072 - 0.072 * s) * b,
    ),
    lim(
      (0.213 - 0.213 * s) * r +
        (0.715 + 0.285 * s) * g +
        (0.072 - 0.072 * s) * b,
    ),
    lim(
      (0.213 - 0.213 * s) * r +
        (0.715 - 0.715 * s) * g +
        (0.072 + 0.928 * s) * b,
    ),
  ];
};
const gris = ([r, g, b]: Rvb): Rvb => {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [y, y, y];
};

const fonds = (r: Record<string, Rvb | undefined>): Record<string, Rvb> => {
  const t = r;
  return {
    garder: t["garder"] as Rvb,
    echanger: t["echanger"] as Rvb,
    vendre: t["vendre"] as Rvb,
    defausser: t["defausser"] as Rvb,
    "À trier (muted)": t["muted"] as Rvb,
    // Rayure sombre « En vente » : vendre 55 % + paper 45 % (--hachure-en-vente).
    "En vente (rayure sombre)": melange(
      t["vendre"] as Rvb,
      t["paper"] as Rvb,
      0.55,
    ),
  };
};

describe.each([
  ["clair", clair],
  ["sombre", sombre],
])("SC-022 : contrastes AA, thème %s", (_nom, theme) => {
  it("SC-022 : les 7 couleurs sont lues dans tokens.css", () => {
    for (const n of NOMS) expect(theme[n], n).toBeDefined();
  });

  for (const [nom, fond] of Object.entries(fonds(theme))) {
    it(`SC-022 : ink sur ${nom} ≥ 4,5:1`, () => {
      expect(ratio(theme["ink"] as Rvb, fond)).toBeGreaterThanOrEqual(4.5);
    });
    it(`SC-022 : ink sur ${nom} sous saturate(.45) ≥ 4,5:1 (filtre appliqué au texte et au fond)`, () => {
      expect(
        ratio(saturer(theme["ink"] as Rvb, 0.45), saturer(fond, 0.45)),
      ).toBeGreaterThanOrEqual(4.5);
    });
    it(`SC-022 : ink sur ${nom}, pire cas gris entièrement désaturé ≥ 4,5:1`, () => {
      expect(
        ratio(gris(theme["ink"] as Rvb), gris(fond)),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
