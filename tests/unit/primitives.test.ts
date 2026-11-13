import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BarreProgression from "../../src/app/BarreProgression";
import ChiffreAnime from "../../src/app/ChiffreAnime";
import EnTeteTriable from "../../src/app/EnTeteTriable";
import PastilleStatut from "../../src/app/PastilleStatut";
import PastilleStatutCarte from "../../src/app/PastilleStatutCarte";
import SectionRepliable from "../../src/app/SectionRepliable";
import { ContexteAffichage, useMouvement } from "../../src/app/useMouvement";

// Primitives de T-315 rendues par renderToStaticMarkup (pas de DOM). Données fictives.
// Contrats supposés (à documenter par le dev) :
// - ContexteAffichage : React.Context<{ animations: boolean }>, défaut { animations: true } ;
// - BarreProgression : valeur === null => indéterminée ;
// - EnTeteTriable : colonne = { cle, libelle }, etat = 'croissant' | 'decroissant' | null,
//   onBasculer() sans argument.
const h = React.createElement;
const rendre = (el: React.ReactElement) => renderToStaticMarkup(el);
// Texte visible d'un rendu : parcours caractère par caractère, sans nettoyage par regex.
const texteDe = (html: string): string => {
  let dansBalise = false;
  let texte = "";
  for (const c of html) {
    if (c === "<") dansBalise = true;
    else if (c === ">") dansBalise = false;
    else if (!dansBalise) texte += c;
  }
  return texte;
};
const avecAnimations = (animations: boolean, el: React.ReactElement) =>
  rendre(h(ContexteAffichage.Provider, { value: { animations } }, el));

const Sonde: React.FC = () => h("span", null, String(useMouvement()));

describe("SC-026 : useMouvement", () => {
  it("SC-026 : vrai par défaut (animations autorisées)", () => {
    expect(rendre(h(Sonde))).toContain("true");
  });
  it("SC-026 : faux si le réglage affichage.animations est désactivé", () => {
    expect(avecAnimations(false, h(Sonde))).toContain("false");
  });
  it("SC-026 : vrai si le réglage est activé", () => {
    expect(avecAnimations(true, h(Sonde))).toContain("true");
  });
});

describe("SC-025/SC-026 : BarreProgression", () => {
  const base = { max: 200, libelle: "Pages lues", texte: "120 pages sur 200" };

  it("SC-026 : role progressbar avec aria-valuemin/max/now et aria-label français", () => {
    const html = rendre(h(BarreProgression, { ...base, valeur: 120 }));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="200"');
    expect(html).toContain('aria-valuenow="120"');
    expect(html).toContain('aria-label="Pages lues"');
  });

  it("SC-026 : le texte est écrit à côté de la barre", () => {
    expect(rendre(h(BarreProgression, { ...base, valeur: 120 }))).toContain(
      "120 pages sur 200",
    );
  });

  it("SC-026 : indéterminée, sans aria-valuenow", () => {
    const html = rendre(
      h(BarreProgression, {
        ...base,
        valeur: null,
        texte: "37 lus",
        enCours: true,
      }),
    );
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain("aria-valuenow");
    expect(html).toContain("37 lus");
  });

  it("SC-026 : indéterminée avec mouvement coupé, plein muted sans rayures animées", () => {
    const normal = rendre(
      h(BarreProgression, {
        ...base,
        valeur: null,
        texte: "37 lus",
        enCours: true,
      }),
    );
    const coupe = avecAnimations(
      false,
      h(BarreProgression, {
        ...base,
        valeur: null,
        texte: "37 lus",
        enCours: true,
      }),
    );
    expect(coupe).toContain("bg-muted");
    expect(coupe).not.toBe(normal);
  });
});

describe("SC-027 : ChiffreAnime", () => {
  it("SC-027 : compteur aria-hidden et valeur finale dans le nom accessible dès le premier rendu", () => {
    const html = rendre(
      h(ChiffreAnime, { valeur: 1240, libelle: "Exemplaires" }),
    );
    expect(html).toMatch(/<span[^>]*aria-hidden="true"/);
    expect(html.replace(/[\u00a0\u202f]/g, " ")).toContain("Exemplaires : 1 240");
  });

  it("SC-027/SC-026 : directement final si mouvement coupé", () => {
    const html = avecAnimations(
      false,
      h(ChiffreAnime, { valeur: 1240, libelle: "Exemplaires" }),
    );
    const compteur = /<span[^>]*aria-hidden="true"[^>]*>([^<]*)</.exec(html);
    expect((compteur?.[1] ?? "").replace(/[\u00a0\u202f]/g, " ")).toContain("1 240");
  });

  it("SC-027 : largeur stable (tabular-nums)", () => {
    expect(
      rendre(h(ChiffreAnime, { valeur: 12, libelle: "Cartes" })),
    ).toContain("tabular-nums");
  });
});

describe("SC-028/D-50 : SectionRepliable", () => {
  const rendreSection = () =>
    rendre(
      h(
        SectionRepliable,
        { titre: "Plafond", resume: "Plafond : 5", id: "plafond" },
        h("p", null, "Contenu fictif"),
      ),
    );

  it("SC-028 : bouton d’en-tête avec aria-expanded=false et aria-controls vers le contenu", () => {
    const html = rendreSection();
    expect(html).toContain('aria-expanded="false"');
    const cible = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(cible).toBeTruthy();
    expect(html).toContain(`id="${cible}"`);
  });

  it("SC-028 : titre et résumé affichés", () => {
    const html = rendreSection();
    expect(html).toContain("Plafond");
    expect(html).toContain("Plafond : 5");
  });

  it("SC-028 : contenu replié en visibility hidden (hors tabulation)", () => {
    expect(rendreSection()).toMatch(/invisible|visibility:\s*hidden/);
  });

  it("SC-028 : bouton de 44 px", () => {
    expect(rendreSection()).toMatch(/min-h-11|h-11/);
  });
});

describe("SC-024/D-16 : EnTeteTriable", () => {
  const colonne = { cle: "valeur", libelle: "Valeur" };
  const tableau = (etat: "croissant" | "decroissant" | null) =>
    rendre(
      h(
        "table",
        null,
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h(EnTeteTriable, { colonne, etat, onBasculer: () => undefined }),
          ),
        ),
      ),
    );

  it("SC-024 : th contenant un button de 44 px", () => {
    const html = tableau(null);
    expect(html).toMatch(/<th[^>]*>\s*<button/);
    expect(html).toMatch(/min-h-11|h-11/);
    expect(html).toContain("Valeur");
  });

  it("SC-024 : aria-sort none, ascending, descending selon l’état", () => {
    expect(tableau(null)).toContain('aria-sort="none"');
    expect(tableau("croissant")).toContain('aria-sort="ascending"');
    expect(tableau("decroissant")).toContain('aria-sort="descending"');
  });

  it("SC-024 : colonne triée en gras avec chevron (état non porté par la couleur)", () => {
    const html = tableau("croissant");
    expect(html).toContain("▲");
    expect(html).toContain("font-bold");
    expect(tableau("decroissant")).toContain("▼");
    expect(tableau(null)).not.toMatch(/▲|▼/);
  });
});

describe("D-40 : PastilleStatut", () => {
  const cas: Array<
    ["a-jour" | "en-cours" | "arretee" | "erreur", string, string]
  > = [
    ["a-jour", "À jour", "●"],
    ["en-cours", "En cours", "▶"],
    ["arretee", "Arrêtée", "■"],
    ["erreur", "Erreur", "✕"],
  ];
  for (const [etat, mot, symbole] of cas) {
    it(`D-40 : ${etat} affiche le symbole ${symbole} et le mot « ${mot} »`, () => {
      const html = rendre(h(PastilleStatut, { etat }));
      expect(html).toContain(symbole);
      expect(html).toContain(mot);
    });
  }
});

describe("D-13 : PastilleStatutCarte", () => {
  const cas: Array<[string, string]> = [
    ["garder", "Garder"],
    ["echanger", "Échanger"],
    ["vendre", "Vendre"],
    ["defausser", "Défausser"],
    ["en-vente", "En vente"],
  ];
  for (const [statut, mot] of cas) {
    it(`D-13 : ${statut} affiche le mot « ${mot} » et un symbole`, () => {
      const html = rendre(h(PastilleStatutCarte, { statut: statut as never }));
      expect(html).toContain(mot);
      expect(
        texteDe(html)
          .replace(mot, "")
          .trim().length,
      ).toBeGreaterThan(0);
    });
  }
  it("D-13 : sans statut, « À trier »", () => {
    expect(rendre(h(PastilleStatutCarte, { statut: null as never }))).toContain(
      "À trier",
    );
  });
});
