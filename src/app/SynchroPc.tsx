import React, { useState } from 'react';
import type { SynchroPc as Etat } from './useSynchroPc';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';
const heure = (iso: string | null): string => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'jamais');

/** Section Réglages › « Synchro entre PC » : dossier partagé (Google Drive pour ordinateur, OneDrive…), un fichier par PC. */
const SynchroPc: React.FC<{ synchro: Etat }> = ({ synchro }) => {
  const [nom, setNom] = useState(synchro.nomPc);
  const [nomInvalide, setNomInvalide] = useState(false);
  if (synchro.etat === 'indisponible') {
    return <p className="py-2 text-sm text-muted">Ce navigateur ne permet pas de choisir un dossier : la synchro entre PC est indisponible.</p>;
  }
  return (
    <section aria-labelledby="titre-synchro-pc" className="py-2">
      <h4 id="titre-synchro-pc" className="font-semibold">Dossier partagé entre tes PC</h4>
      <p className="mt-1 text-sm text-muted">
        Choisis, sur chaque PC, le même dossier synchronisé (par exemple <code>WM Collection sync</code> dans Google Drive pour ordinateur). Chaque PC y dépose son fichier et lit celui des autres :
        aucune requête réseau, aucun jeton. La page de gestion doit rester ouverte.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={CLASSE_BOUTON} onClick={() => void synchro.choisir()}>
          {synchro.dossier ? 'Changer de dossier' : 'Choisir le dossier'}
        </button>
        {synchro.etat === 'autorisation' && (
          <button type="button" className={CLASSE_BOUTON} onClick={() => void synchro.autoriser()}>
            Autoriser à nouveau
          </button>
        )}
        {synchro.dossier && (
          <>
            <button type="button" className={CLASSE_BOUTON} onClick={() => void synchro.maintenant()}>
              Synchroniser maintenant
            </button>
            <button type="button" className={CLASSE_BOUTON} onClick={() => void synchro.desactiver()}>
              Arrêter
            </button>
          </>
        )}
      </div>
      <label className="mt-3 flex flex-wrap items-center gap-2">
        Nom de ce PC
        <input
          className="min-h-11 rounded border border-line bg-ink-2 px-3"
          value={nom}
          aria-invalid={nomInvalide}
          onChange={(e) => {
            setNom(e.target.value);
            setNomInvalide(false);
          }}
          onBlur={() => setNomInvalide(nom !== synchro.nomPc && !synchro.renommer(nom))}
        />
      </label>
      {nomInvalide && <p role="alert" className="mt-1 text-sm">Nom invalide : 3 à 24 caractères, minuscules, chiffres et tirets.</p>}
      <ul className="mt-3 list-disc pl-5 text-sm" data-testid="etat-synchro-pc">
        <li>Dossier : {synchro.dossier ?? 'aucun'}</li>
        <li>Dernier envoi : {heure(synchro.dernierEnvoi)} · dernière lecture : {heure(synchro.derniereLecture)}</li>
        <li>Autres PC vus : {synchro.pcVus.length > 0 ? synchro.pcVus.join(', ') : 'aucun'}</li>
      </ul>
      {synchro.etat === 'autorisation' && <p role="status" className="mt-2">Chrome demande de confirmer l’accès au dossier : clique sur « Autoriser à nouveau ».</p>}
      {synchro.erreur && <p role="alert" className="mt-2">{synchro.erreur}</p>}
      {synchro.ignores.length > 0 && (
        <p role="status" className="mt-2 text-sm">
          Fichiers ignorés (rien n’a été modifié) : {synchro.ignores.map((i) => `${i.nom} (${i.raison})`).join(' ; ')}
        </p>
      )}
    </section>
  );
};

export default SynchroPc;
