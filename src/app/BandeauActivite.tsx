import React, { useEffect, useRef, useState } from 'react';
import type { EtatExecutionV2, FamilleLot } from '../lib/actions';
import { enregistrerArretSynchro } from '../lib/stockage';
import {
  annoncer,
  dureeRestante,
  progressionLot,
  secondesExecution,
  secondesSynchro,
  type Annonce,
} from '../lib/progression';
import LigneActivite, { type BarreDetail, type Commande } from './LigneActivite';
import { abonnerEchecEcriture, arreterTout, pause, reprendre } from './pilotageLots';
import { useActiviteSynchro } from './useActiviteSynchro';

const NB = ' ';

const NOMS_ETAPE = { stats: 'Statistiques', pages: 'Pages de la collection', prix: 'Prix du marché', ventes: 'Ventes en cours' } as const;
const NOMS_FAMILLE: Record<FamilleLot, string> = {
  lectures: 'Lectures',
  etiquettes: 'Étiquettes',
  encheres: 'Enchères',
  defausses: 'Défausses',
  suppressions: 'Suppressions d’étiquettes',
};

const AUTRE_ONGLET = 'en cours dans un autre onglet';

const LigneErreur: React.FC<{ exec: EtatExecutionV2 }> = ({ exec }) => (
  <div data-testid="ligne-activite-erreur" className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-y border-l-[6px] border-line border-l-defausser bg-ink-2 px-3 py-2">
    <span aria-hidden="true" className="font-bold text-defausser">
      ✕
    </span>
    <span className="font-bold">Erreur</span>
    <span className="text-sm">
      {`${NB}: arrêt sur « ${exec.erreur?.titre ?? ''} »`}
    </span>
    <a href="#synchro" className="inline-flex min-h-11 items-center underline focus-visible:shadow-(--halo-focus)">
      Voir le détail
    </a>
  </div>
);

/**
 * Bandeau d’activité (D-03, D-21) : au-dessus des panneaux, sur les six onglets. Non rendu sans activité. La zone
 * `aria-live` qui annonce la progression est distincte de la région (D-11) et n’est jamais dans le bandeau.
 */
const BandeauActivite: React.FC = () => {
  const { synchro, lots, erreur, enPause, autreOnglet, progSynchro, progLots } = useActiviteSynchro();
  // Échec d’une demande d’arrêt, rattaché à la synchro en cours : il disparaît avec elle.
  const [arretRefuse, setArretRefuse] = useState<number | null | undefined>(undefined);
  const [echecEcriture, setEchecEcriture] = useState('');
  // Échec d’écriture de l’état d’exécution (retouche T-307) : visible, jamais avalé.
  useEffect(() => abonnerEchecEcriture(setEchecEcriture), []);
  const cleSynchro = synchro ? `${synchro.debut ?? ''}|${synchro.etape ?? ''}` : '';
  const synchroCalculee = progSynchro;
  const lotsCalcules = progLots;

  // Annonce vocale : au plus une toutes les 2 s, sur changement d’étape ou palier de 10 %.
  const [texteAnnonce, setTexteAnnonce] = useState('');
  const precedentAnnonce = useRef<Annonce | null>(null);
  const pourcentSynchro = synchroCalculee?.pourcent ?? null;
  const pourcentLots = lotsCalcules?.pourcent ?? null;
  useEffect(() => {
    const candidats: Array<{ cle: string; pourcent: number; texte: string }> = [];
    if (pourcentSynchro !== null) candidats.push({ cle: `synchro|${cleSynchro}`, pourcent: pourcentSynchro, texte: `Synchro${NB}: ${pourcentSynchro} %` });
    if (pourcentLots !== null) candidats.push({ cle: `lots|${lots?.idLot ?? ''}`, pourcent: pourcentLots, texte: `Lots${NB}: ${pourcentLots} %` });
    for (const c of candidats) {
      const decision = annoncer(precedentAnnonce.current, c, Date.now());
      if (decision.annoncer) {
        precedentAnnonce.current = decision.suivant;
        setTexteAnnonce(c.texte);
        break;
      }
    }
  }, [pourcentSynchro, pourcentLots, cleSynchro, lots?.idLot]);

  const vue = (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {texteAnnonce}
    </div>
  );

  const alerteEcriture = echecEcriture !== '' && <p role="alert" className="mt-3 text-sm text-defausser">{echecEcriture}</p>;
  if (!synchro && !lots && !erreur) return <>{vue}{alerteEcriture}</>;

  const commandesSynchro: Commande[] | null = autreOnglet
    ? null
    : [
        {
          nom: 'Arrêter',
          onActiver: () => {
            setArretRefuse(undefined);
            const debut = synchro?.debut ?? null;
            enregistrerArretSynchro(Date.now()).catch(() => setArretRefuse(debut));
          },
        },
      ];
  const commandesLots: Commande[] | null = autreOnglet
    ? null
    : [enPause ? { nom: 'Reprendre', onActiver: reprendre } : { nom: 'Pause', onActiver: pause }, { nom: 'Arrêter', onActiver: arreterTout }];

  const detailsSynchro: BarreDetail[] = (synchroCalculee?.etapes ?? []).map((e) => ({
    libelle: NOMS_ETAPE[e.etape],
    valeur: e.barre.valeur,
    max: e.barre.max ?? 1,
    texte: e.barre.texte,
  }));
  const detailsLots: BarreDetail[] = (lots?.lots ?? []).map((l) => {
    const b = progressionLot(l);
    return { libelle: NOMS_FAMILLE[l.famille], valeur: b.valeur, max: b.max ?? 1, texte: b.texte };
  });

  const resumeSynchro = synchro && synchroCalculee
    ? `${autreOnglet ? `${AUTRE_ONGLET} · ` : ''}${synchroCalculee.texte.replace(/ · \d+ %$/, '')} · ${dureeRestante(secondesSynchro(synchro))}`
    : '';
  const resumeLots = lots
    ? `${autreOnglet ? `${AUTRE_ONGLET} · ` : ''}${enPause ? 'suspendus · ' : ''}${lots.traitees} / ${lots.total} actions · ${dureeRestante(secondesExecution(lots.total - lots.traitees))}`
    : '';

  return (
    <>
      {vue}
      <section aria-label="Activité en cours" data-testid="bandeau-activite" className="wm-apparition mt-3 flex flex-col gap-2">
        {synchro && synchroCalculee && (
          <LigneActivite
            genre="synchro"
            nom="Synchro"
            pourcent={synchroCalculee.pourcent}
            resume={resumeSynchro}
            details={detailsSynchro}
            commandes={commandesSynchro}
          />
        )}
        {lots && lotsCalcules && (
          <LigneActivite
            genre="lots"
            nom="Lots"
            pourcent={lotsCalcules.pourcent}
            barre={{ valeur: lotsCalcules.valeur, max: lotsCalcules.max ?? 1 }}
            resume={resumeLots}
            details={detailsLots}
            commandes={commandesLots}
            enPause={enPause}
          />
        )}
        {erreur && <LigneErreur exec={erreur} />}
        {alerteEcriture}
        {synchro && arretRefuse !== undefined && arretRefuse === (synchro.debut ?? null) && (
          <p role="alert" className="text-sm text-defausser">La demande d’arrêt n’a pas pu être enregistrée.</p>
        )}
      </section>
    </>
  );
};

export default BandeauActivite;
