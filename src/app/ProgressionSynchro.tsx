import React, { useEffect, useRef, useState } from 'react';
import type { EtapeSynchro, StatutSynchroV2 } from '../lib/statutSynchro';
import { annoncer, INTERVALLE_ANNONCE_MS, progressionSynchro, type Annonce, type Barre } from '../lib/progression';
import BarreProgression from './BarreProgression';

interface Props {
  statut: StatutSynchroV2;
  /** Une synchro tourne vraiment (statut « en cours » et bail tenu) : sinon ni ▶ ni animation. */
  actif: boolean;
}

/** « Lecture » = étape `stats` (D-11). */
export const LIBELLES_ETAPE: Record<EtapeSynchro, string> = { stats: 'Lecture', pages: 'Pages', prix: 'Prix', ventes: 'Ventes' };

type EtatAffiche = 'faite' | 'en-cours' | 'attente' | 'arret';
const SYMBOLES: Record<EtatAffiche, string> = { faite: '✓', 'en-cours': '▶', attente: '○', arret: '✕' };
// D-11 : garder = fait, echanger = en cours, muted = attente, defausser = arrêt (contrastes AA vérifiés dans les deux thèmes).
const COULEURS: Record<EtatAffiche, string> = {
  faite: 'text-garder',
  'en-cours': 'text-echanger',
  attente: 'text-muted',
  arret: 'text-defausser',
};

/** Deux débuts à moins de 5 s l’un de l’autre désignent la même synchro (le début est écrit une fois par synchro). */
const TOLERANCE_DEBUT_MS = 5000;

const horloge = (): number => Date.now();

const barreMinimale = (pourcent: number): Barre => ({ valeur: 0, max: 100, pourcent, indeterminee: false, texte: '' });

interface Plafond {
  debut: number | null;
  etape: EtapeSynchro | null;
  pourcent: number;
}

const memeSynchro = (a: number | null, b: number | null): boolean =>
  a === null || b === null ? a === b : Math.abs(a - b) <= TOLERANCE_DEBUT_MS;

/** Barre globale « Étape i / 4 · P % », étapes (symbole + mot + couleur) et annonce `aria-live` limitée (D-10, D-11). */
const ProgressionSynchro: React.FC<Props> = ({ statut, actif }) => {
  const [plafond, setPlafond] = useState<Plafond>({ debut: null, etape: null, pourcent: 0 });
  // Le plafond de monotonie vaut pour une même synchro et une même étape (D-10).
  const applicable = actif && memeSynchro(plafond.debut, statut.debut) && plafond.etape === statut.etape;
  const p = progressionSynchro(statut, applicable ? barreMinimale(plafond.pourcent) : null);
  const cible: Plafond = { debut: statut.debut, etape: statut.etape, pourcent: actif && p.pourcent !== null ? p.pourcent : 0 };
  if (cible.pourcent !== plafond.pourcent || cible.etape !== plafond.etape || !memeSynchro(cible.debut, plafond.debut)) {
    setPlafond(cible);
  }

  const annonceRef = useRef<Annonce | null>(null);
  const [texteAnnonce, setTexteAnnonce] = useState('');
  const cle = `${statut.etat}|${statut.etape ?? ''}`;
  const pourcentAnnonce = p.pourcent ?? 0;
  const texte = p.texte;
  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    // Une annonce refusée par la fenêtre de 2 s est reprogrammée à la fin de la fenêtre : la dernière n’est jamais perdue.
    const evaluer = (): void => {
      const maintenant = horloge();
      const decision = annoncer(annonceRef.current, { cle, pourcent: pourcentAnnonce }, maintenant);
      annonceRef.current = decision.suivant;
      if (decision.annoncer) {
        setTexteAnnonce(texte);
        return;
      }
      const derniere = decision.suivant;
      if (derniere.cle !== cle || Math.floor(pourcentAnnonce / 10) > derniere.palier) {
        minuteur = setTimeout(evaluer, Math.max(0, INTERVALLE_ANNONCE_MS - (maintenant - derniere.le)) + 5);
      }
    };
    evaluer();
    return () => clearTimeout(minuteur);
  }, [cle, pourcentAnnonce, texte]);

  return (
    <>
      <section aria-label="Progression" data-testid="progression-synchro" className="mt-4 rounded border border-line bg-ink-2 p-4">
        <BarreProgression
          valeur={p.indeterminee ? null : p.pourcent}
          max={100}
          libelle="Progression de la synchronisation"
          texte={p.texte}
          fine
          enCours={actif}
        />
        <ol data-testid="etapes-synchro" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {p.etapes.map((e) => {
            let etat: EtatAffiche = e.etat;
            if (e.etat === 'en-cours' && statut.etat === 'arret') etat = 'arret';
            // Statut « en cours » périmé (bail expiré) : l’étape n’avance plus, elle n’est pas présentée comme active.
            else if (e.etat === 'en-cours' && !actif && statut.etat === 'en-cours') etat = 'attente';
            return (
              <li key={e.etape} data-testid="etape-synchro" data-etape={e.etape} data-etat={etat} className="flex flex-col gap-2">
                <span className={`font-medium ${COULEURS[etat]}`}>
                  {`${SYMBOLES[etat]} ${LIBELLES_ETAPE[e.etape]}`}
                  {etat === 'arret' && <span className="ml-2 text-sm font-normal">(arrêtée)</span>}
                </span>
                {(e.etat === 'faite' || e.etat === 'en-cours') && (
                  <BarreProgression
                    valeur={e.barre.indeterminee ? null : e.barre.valeur}
                    max={e.barre.max ?? 0}
                    libelle={`Étape ${LIBELLES_ETAPE[e.etape]}`}
                    texte={e.barre.texte}
                    enCours={etat === 'en-cours'}
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
