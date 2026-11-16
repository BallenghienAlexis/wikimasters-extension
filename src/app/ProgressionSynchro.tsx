import React, { useEffect, useRef, useState } from 'react';
import SectionRepliable from './SectionRepliable';
import type { EtapeSynchro, StatutSynchroV2 } from '../lib/statutSynchro';
import { annoncer, INTERVALLE_ANNONCE_MS, progressionSynchro, type Annonce, type Barre } from '../lib/progression';
import BarreProgression from './BarreProgression';
import { enregistrerPasserCarteSynchro } from '../lib/stockage';
import { SEUIL_AVERTISSEMENT_PRIX } from '../lib/ordonnanceur';

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

const horloge = (): number => Date.now();

/** Phase Prix en attente après une erreur : pause en cours, décompte, et rappel que seul le joueur arrête. */
const AttentePrixLigne: React.FC<{ jusqua: number; titre: string; codeHttp: number | null; verification: boolean; essai: number }> = ({ jusqua, titre, codeHttp, verification, essai }) => {
  const [maintenant, setMaintenant] = useState(horloge());
  // « Continuer d’attendre » masque l’avertissement pour cette carte seulement ; il revient pour la carte suivante.
  const [masquePour, setMasquePour] = useState<string | null>(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    const m = setInterval(() => setMaintenant(horloge()), 1000);
    return () => clearInterval(m);
  }, []);
  const reste = Math.max(0, Math.ceil((jusqua - maintenant) / 1000));
  const cause = verification
    ? 'Vérification anti-bot du site requise : franchis-la à la main sur wiki-masters.com, la synchro reprendra toute seule.'
    : codeHttp === null
      ? 'Erreur de réseau ou réponse vide.'
      : codeHttp === 401
        ? 'Le site a répondu 401 : session refusée, reconnecte-toi à WikiMasters.'
        : `Le site a répondu ${codeHttp}.`;
  const avertir = essai >= SEUIL_AVERTISSEMENT_PRIX && masquePour !== titre;
  return (
    <>
      <p data-testid="attente-prix" role="status" className="mt-3 text-sm text-defausser">
        {`En attente : ${cause} Nouvel essai dans ${reste} s (essai ${essai}). La synchro ne s’arrête pas toute seule : utilise « Arrêter » pour la couper.`}
      </p>
      {avertir && (
        <div data-testid="avertissement-prix" role="alert" className="mt-3 rounded border border-defausser p-3 text-sm">
          <p>
            {`La carte « ${titre} » échoue depuis ${essai} essais (${cause}) Tu peux la passer : elle sera redemandée dans 1 jour, sans rien perdre. Sinon la synchro continue d’attendre.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="passer-carte"
              className="rounded border border-line px-3 py-2 min-h-11"
              onClick={() => {
                setErreur(false);
                enregistrerPasserCarteSynchro(Date.now()).catch(() => setErreur(true));
              }}
            >
              Passer cette carte
            </button>
            <button type="button" data-testid="continuer-attente" className="rounded border border-line px-3 py-2 min-h-11" onClick={() => setMasquePour(titre)}>
              Continuer d’attendre
            </button>
          </div>
          {erreur && <p className="mt-2 text-defausser">La demande n’a pas pu être enregistrée.</p>}
        </div>
      )}
    </>
  );
};

const barreMinimale = (pourcent: number): Barre => ({ valeur: 0, max: 100, pourcent, indeterminee: false, texte: '' });

interface Plafond {
  debut: number | null;
  etape: EtapeSynchro | null;
  pourcent: number;
}

/** Barre globale « Étape i / 4 · P % », étapes (symbole + mot + couleur) et annonce `aria-live` limitée (D-10, D-11). */
const ProgressionSynchro: React.FC<Props> = ({ statut, actif }) => {
  const [plafond, setPlafond] = useState<Plafond>({ debut: null, etape: null, pourcent: 0 });
  // Le plafond de monotonie vaut pour une même synchro et une même étape (D-10).
  const applicable = actif && plafond.debut === statut.debut && plafond.etape === statut.etape;
  const p = progressionSynchro(statut, applicable ? barreMinimale(plafond.pourcent) : null);
  const cible: Plafond = { debut: statut.debut, etape: statut.etape, pourcent: actif && p.pourcent !== null ? p.pourcent : 0 };
  if (cible.pourcent !== plafond.pourcent || cible.etape !== plafond.etape || cible.debut !== plafond.debut) {
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
      <SectionRepliable
        id="progression-synchro"
        testId="progression-synchro"
        className="mt-4"
        titre="Progression"
        ouvertParDefaut={actif}
        resume={p.texte}
      >
        <BarreProgression
          valeur={p.indeterminee ? null : p.pourcent}
          max={100}
          libelle="Progression de la synchronisation"
          texte={p.texte}
          fine
          enCours={actif}
        />
        {actif && statut.attente != null && <AttentePrixLigne {...statut.attente} />}
        <ol data-testid="etapes-synchro" className="mt-3 grid grid-cols-1 gap-2">
          {p.etapes.map((e) => {
            let etat: EtatAffiche = e.etat;
            if (e.etat === 'en-cours' && statut.etat === 'arret') etat = 'arret';
            // Statut « en cours » périmé (bail expiré) : l’étape n’avance plus, elle n’est pas présentée comme active.
            else if (e.etat === 'en-cours' && !actif && statut.etat === 'en-cours') etat = 'attente';
            return (
              <li key={e.etape} data-testid="etape-synchro" data-etape={e.etape} data-etat={etat} className="flex flex-col gap-1 sm:grid sm:grid-cols-[110px_1fr] sm:items-center sm:gap-3">
                <span className={`font-medium ${COULEURS[etat]}`}>
                  {`${SYMBOLES[etat]} ${LIBELLES_ETAPE[e.etape]}`}
                  {etat === 'arret' && <span className="ml-2 text-sm font-normal">(arrêtée)</span>}
                </span>
                {(etat === 'faite' || etat === 'en-cours') && (
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
      </SectionRepliable>
      <p aria-live="polite" className="sr-only" data-testid="annonce-synchro">
        {texteAnnonce}
      </p>
    </>
  );
};

export default ProgressionSynchro;
