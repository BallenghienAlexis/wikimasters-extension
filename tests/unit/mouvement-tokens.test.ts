import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// SC-025 (D-08) : tokens de mouvement et absence de littéraux hors de tokens.css.
const RACINE = join(__dirname, "..", "..");
const TOKENS = join(RACINE, "src", "styles", "tokens.css");
const css = readFileSync(TOKENS, "utf8");

const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });

const sources = [
  ...fichiers(join(RACINE, "src", "app")),
  ...fichiers(join(RACINE, "src", "styles")),
].filter((f) => f !== TOKENS && /\.(ts|tsx|css)$/.test(f));

const declaration = (nom: string): string | null => {
  const m = new RegExp(`${nom.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&")}\\s*:\\s*([^;]+);`).exec(
    css,
  );
  return m?.[1] ? m[1].replace(/\s+/g, "").toLowerCase() : null;
};

describe("SC-025 : tokens de mouvement", () => {
  const attendus: Record<string, string> = {
    "--d-fast": "0.2s",
    "--d-base": "0.4s",
    "--d-move": "0.65s",
    "--d-bar": "0.9s",
    "--d-shake": "0.5s",
    "--d-cascade-ligne": "40ms",
    "--d-cascade-bloc": "50ms",
    "--ease-out": "cubic-bezier(0.22,1,0.36,1)",
    "--ease-spring": "cubic-bezier(0.34,1.56,0.64,1)",
  };
  for (const [nom, valeur] of Object.entries(attendus)) {
    it(`SC-025 : ${nom} vaut ${valeur}`, () => {
      expect(declaration(nom)).toBe(valeur);
    });
  }

  it("SC-025 : la règle :root[data-animations=off] coupe animations et transitions", () => {
    expect(css).toMatch(/:root\[data-animations=['"]off['"]\]/);
    const bloc = /:root\[data-animations=['"]off['"]\][^{]*\{([^}]*)\}/.exec(
      css,
    );
    expect(bloc?.[1]).toMatch(/animation:\s*none/);
    expect(bloc?.[1]).toMatch(/transition:\s*none/);
  });

  it("SC-025 : tokens.css contient des classes communes citant des tokens (reflet, rayures, secousse)", () => {
    expect(css).toMatch(/var\(--d-bar\)/);
    expect(css).toMatch(/var\(--d-shake\)/);
    expect(css).toMatch(/@keyframes/);
  });

  it("SC-025 : au moins un fichier source est analysé", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  it("SC-025 : aucun cubic-bezier( hors tokens.css", () => {
    const fautifs = sources.filter((f) =>
      /cubic-bezier\(/.test(readFileSync(f, "utf8")),
    );
    expect(fautifs.map((f) => relative(RACINE, f))).toEqual([]);
  });

  it("SC-025 : aucune durée littérale de transition ou d’animation hors tokens.css", () => {
    const motifs = [
      /(transition|animation)[a-z-]*\s*:[^;\n]*\b\d*\.?\d+m?s\b/i,
      /\bduration-(\d|\[)/,
      /\bdelay-(\d|\[)/,
    ];
    const fautifs = sources.filter((f) => {
      const texte = readFileSync(f, "utf8");
      return motifs.some((m) => m.test(texte));
    });
    expect(fautifs.map((f) => relative(RACINE, f))).toEqual([]);
  });

  it("SC-025 : aucune couleur littérale hors tokens.css", () => {
    const motif = /#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|oklab)\(/;
    const fautifs = sources.filter((f) => motif.test(readFileSync(f, "utf8")));
    expect(fautifs.map((f) => relative(RACINE, f))).toEqual([]);
  });
});
