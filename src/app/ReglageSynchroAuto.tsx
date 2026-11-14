import React from 'react';
import type { EtatSyncAuto } from './useSyncAuto';

/** Réglage « Synchronisation automatique » des Réglages : même préférence (`syncAuto`) que l’interrupteur de l’onglet Synchro. */
const ReglageSynchroAuto: React.FC<EtatSyncAuto> = ({ actif, erreur, basculer }) => (
  <div className="py-2">
    <label className="flex min-h-11 items-center gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={actif === true}
        disabled={actif === null}
        onChange={(e) => basculer(e.target.checked)}
        className="size-5 accent-[var(--color-paper)] focus-visible:shadow-(--halo-focus)"
      />
      <span>Synchronisation automatique</span>
    </label>
    <p className="mt-1 text-sm text-muted">
      Lit votre collection sur WikiMasters pendant qu’un onglet du site est ouvert : une requête toutes les 0,2 à 0,3 s, arrêt immédiat si le site
      refuse. Même réglage que l’interrupteur de l’onglet Synchro.
    </p>
    {erreur !== null && (
      <p role="alert" className="mt-2 font-semibold text-defausser">
        {erreur}
      </p>
    )}
  </div>
);

export default ReglageSynchroAuto;
