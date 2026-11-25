import React, { useEffect, useState } from 'react';
import type { SynchroPc } from './useSynchroPc';

const BOUTON = 'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border px-4 font-semibold';
const DELAI_AUTO_S = 20;

const dateHeure = (iso: string | null): string => (iso === null ? 'inconnue' : new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }));

const ETAPES: { id: string; titre: string }[] = [
  { id: 'pc', titre: '1. Reprendre la dernière sauvegarde du Drive' },
  { id: 'site', titre: '2. Lire la collection sur WikiMasters' },
  { id: 'drive', titre: '3. Sauvegarder l’état actuel dans le Drive' },
];

/** Rang de l’étape en cours : 0 = PC, 1 = site, 2 = sauvegarde. */
const rang = (etape: string): number => (etape === 'site' ? 1 : etape === 'sauvegarde' ? 2 : 0);

/**
 * Fenêtre de démarrage obligatoire (Alexis, 2026-11-25) : tant qu’elle n’est pas passée, ni lot, ni relance, ni lecture
 * automatique du site. Choix du PC source ; sans action, la source proposée est reprise au bout de 20 s.
 */
const PopupDemarrage: React.FC<{ synchroPc: SynchroPc }> = ({ synchroPc }) => {
  const { demarrage, etat } = synchroPc;
  const [reste, setReste] = useState(DELAI_AUTO_S);
  const [touche, setTouche] = useState(false);
  const choix = demarrage.etape === 'choix';

  useEffect(() => {
    if (!choix || touche) return undefined;
    const minuteur = setInterval(() => setReste((r) => r - 1), 1000);
    return () => clearInterval(minuteur);
  }, [choix, touche]);
  useEffect(() => {
    if (choix && !touche && reste <= 0) void synchroPc.continuerDemarrage();
  }, [choix, touche, reste, synchroPc]);

  const autorisation = etat === 'autorisation' && demarrage.etape === 'inactif' && synchroPc.demarrageEnCours;
  if (!autorisation && (demarrage.etape === 'inactif' || demarrage.etape === 'termine')) return null;
  const actuel = rang(demarrage.etape);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80" data-testid="popup-demarrage">
      <div role="dialog" aria-modal="true" aria-labelledby="titre-demarrage" className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded border border-paper bg-ink-2 p-4">
        <h2 id="titre-demarrage" className="text-lg font-semibold">
          Synchro entre PC au démarrage
        </h2>
        <p className="mt-1 text-sm text-muted">Rien d’autre ne part (lots, relance, lecture du site) tant que ces trois étapes ne sont pas faites.</p>
        <ol className="mt-3 flex flex-col gap-1" aria-label="Étapes">
          {ETAPES.map((e, i) => (
            <li key={e.id} className={i === actuel && demarrage.etape !== 'erreur' ? 'font-semibold' : i < actuel ? 'text-muted line-through' : 'text-muted'}>
              {e.titre}
            </li>
          ))}
        </ol>

        {autorisation && (
          <div className="mt-4">
            <p>Chrome demande de ré-autoriser le dossier du Drive (un clic).</p>
            <button type="button" className={`${BOUTON} mt-2 border-paper bg-ink text-paper hover:bg-line`} onClick={() => void synchroPc.autoriser()}>
              Autoriser le dossier
            </button>
          </div>
        )}

        {demarrage.etape === 'lecture' && <p className="mt-4">Lecture du dossier du Drive…</p>}

        {choix && (
          <div className="mt-4">
            <fieldset>
              <legend className="font-semibold">Synchroniser depuis quel PC ?</legend>
              <div className="mt-2 flex flex-col gap-2">
                {demarrage.sources.map((s) => (
                  <label key={s.nom} className="flex cursor-pointer items-start gap-2 rounded border border-line p-2">
                    <input
                      type="radio"
                      name="source-pc"
                      className="mt-1"
                      checked={demarrage.choisie === s.nom}
                      onChange={() => {
                        setTouche(true);
                        synchroPc.choisirSource(s.nom);
                      }}
                    />
                    <span>
                      <span className="font-semibold">{s.nom}</span>
                      <span className="block text-sm text-muted">
                        Écrit le {dateHeure(s.creeLe)} · dernière saisie {dateHeure(s.modifieLe)} · {s.cartes} cartes
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex cursor-pointer items-start gap-2 rounded border border-line p-2">
                  <input
                    type="radio"
                    name="source-pc"
                    className="mt-1"
                    checked={demarrage.choisie === null}
                    onChange={() => {
                      setTouche(true);
                      synchroPc.choisirSource(null);
                    }}
                  />
                  <span>Ne rien reprendre : garder l’état de ce PC ({synchroPc.nomPc})</span>
                </label>
              </div>
            </fieldset>
            <p className="mt-2 text-sm text-muted">La source choisie fait foi pour la collection, les notes, les prix et les thèmes ; le site corrige ensuite l’état réel des cartes.</p>
            <button type="button" className={`${BOUTON} mt-3 border-paper bg-ink text-paper hover:bg-line`} onClick={() => void synchroPc.continuerDemarrage()}>
              Continuer{!touche ? ` (automatique dans ${Math.max(reste, 0)} s)` : ''}
            </button>
          </div>
        )}

        {demarrage.etape === 'fusion' && <p className="mt-4">Reprise de la sauvegarde choisie…</p>}

        {demarrage.etape === 'site' && (
          <div className="mt-4">
            <p>Lecture de la collection sur WikiMasters… Garde un onglet WikiMasters ouvert (les prix se complètent ensuite en arrière-plan).</p>
            <div className="mt-2 flex flex-col gap-2 md:flex-row">
              <button type="button" className={`${BOUTON} border-paper bg-ink text-paper hover:bg-line`} onClick={() => void synchroPc.relancerSite()}>
                Relancer la lecture du site
              </button>
              <button type="button" className={`${BOUTON} border-line bg-ink text-muted hover:bg-line`} onClick={() => void synchroPc.passerSite()}>
                Passer (pas d’onglet WikiMasters)
              </button>
            </div>
          </div>
        )}

        {demarrage.etape === 'sauvegarde' && <p className="mt-4">Sauvegarde dans le Drive…</p>}

        {demarrage.etape === 'erreur' && (
          <div className="mt-4">
            <p role="alert" className="text-defausser">
              {demarrage.message ?? 'Le démarrage a échoué.'}
            </p>
            <button type="button" className={`${BOUTON} mt-2 border-paper bg-ink text-paper hover:bg-line`} onClick={() => void synchroPc.reessayerDemarrage()}>
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopupDemarrage;
