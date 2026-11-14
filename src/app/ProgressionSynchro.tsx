import React, { useEffect, useRef, useState } from "react";
import type { EtapeSynchro, StatutSynchroV2 } from "../lib/statutSynchro";
import {
  annoncer,
  progressionSynchro,
  type Annonce,
  type Barre,
} from "../lib/progression";
import BarreProgression from "./BarreProgression";

interface Props {
  statut: StatutSynchroV2;
}

/** « Lecture » = étape `stats` (D-11). */
export const LIBELLES_ETAPE: Record<EtapeSynchro, string> = {
  stats: "Lecture",
  pages: "Pages",
  prix: "Prix",
  ventes: "Ventes",
};

type EtatAffiche = "faite" | "en-cours" | "attente" | "arret";
const SYMBOLES: Record<EtatAffiche, string> = {
  faite: "✓",
  "en-cours": "▶",
  attente: "○",
  arret: "✕",
};

const horloge = (): number => Date.now();

const barreMinimale = (pourcent: number): Barre => ({
  valeur: 0,
  max: 100,
  pourcent,
  indeterminee: false,
  texte: "",
});

/** Barre globale « Étape i / 4 · P % », étapes (symbole + mot) et annonce `aria-live` limitée (D-10, D-11). */
const ProgressionSynchro: React.FC<Props> = ({ statut }) => {
  const [plafond, setPlafond] = useState(0);
  const enCours = statut.etat === "en-cours";
  const p = progressionSynchro(statut, enCours ? barreMinimale(plafond) : null);

  // Plafond mémorisé pendant la synchro (le pourcentage ne décroît pas) ; remis à 0 hors synchro.
  const cible = enCours && p.pourcent !== null ? p.pourcent : 0;
  if (cible !== plafond) setPlafond(cible);

  const annonceRef = useRef<Annonce | null>(null);
  const [texteAnnonce, setTexteAnnonce] = useState("");
  const cle = `${statut.etat}|${statut.etape ?? ""}`;
  const pourcentAnnonce = p.pourcent ?? 0;
  const texte = p.texte;
  useEffect(() => {
    const decision = annoncer(
      annonceRef.current,
      { cle, pourcent: pourcentAnnonce },
      horloge(),
    );
    annonceRef.current = decision.suivant;
    if (decision.annoncer) setTexteAnnonce(texte);
  }, [cle, pourcentAnnonce, texte]);

  return (
    <>
      <section
        aria-label="Progression"
        data-testid="progression-synchro"
        className="mt-4 rounded border border-line bg-ink-2 p-4"
      >
        <BarreProgression
          valeur={p.indeterminee ? null : p.pourcent}
          max={100}
          libelle="Progression de la synchronisation"
          texte={p.texte}
          fine
          enCours={enCours}
        />
        <ol
          data-testid="etapes-synchro"
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {p.etapes.map((e) => {
            const etat: EtatAffiche =
              statut.etat === "arret" && e.etat === "en-cours"
                ? "arret"
                : e.etat;
            return (
              <li
                key={e.etape}
                data-testid="etape-synchro"
                data-etape={e.etape}
                data-etat={etat}
                className="flex flex-col gap-2"
              >
                <span className="font-medium">
                  {`${SYMBOLES[etat]} ${LIBELLES_ETAPE[e.etape]}`}
                  {etat === "arret" && (
                    <span className="ml-2 text-sm font-normal">(arrêtée)</span>
                  )}
                </span>
                {(e.etat === "faite" || e.etat === "en-cours") && (
                  <BarreProgression
                    valeur={e.barre.indeterminee ? null : e.barre.valeur}
                    max={e.barre.max ?? 0}
                    libelle={`Étape ${LIBELLES_ETAPE[e.etape]}`}
                    texte={e.barre.texte}
                    enCours={etat === "en-cours"}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <p aria-live="polite" className="sr-only" data-testid="annonce-synchro">
        {texteAnnonce}
      </p>
    </>
  );
};

export default ProgressionSynchro;
