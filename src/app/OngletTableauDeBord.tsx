import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import { collectionVide, type Collection } from '../lib/collection';
import type { EtatOrdonnanceur } from '../lib/ordonnanceur';
import {
  chargerBailSynchro,
  chargerCollection,
  chargerDerniereSynchro,
  chargerEtatSynchro,
  chargerPreferences,
  chargerStatutSynchro,
  chargerSyncAuto,
  ecouterCollection,
  ecouterSynchroAuto,
} from '../lib/stockage';
import type { StatutSynchroV2 } from '../lib/statutSynchro';
import { calculerTableauDeBord, type ContexteTableauDeBord, type PastilleSynchro } from '../lib/tableauDeBord';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import BarreRepartition from './BarreRepartition';
import CarteKpi from './CarteKpi';
import SanteSynchro from './SanteSynchro';

/** Relecture périodique : l’expiration du bail ou de la pause se constate sans événement. */
const RELECTURE_MS = 15_000;

interface LectureSynchro {
  activee: boolean;
  statut: StatutSynchroV2 | null;
  bail: number | null;
  derniere: number | null;
  etat: EtatOrdonnanceur | null;
  maintenant: number;
}

const LECTURE_INITIALE: LectureSynchro = { activee: true, statut: null, bail: null, derniere: null, etat: null, maintenant: 0 };

/** Pastille D-40 déduite du statut, du bail et de la pause. Une lecture illisible n’empêche pas l’affichage. */
function pastilleDe(l: LectureSynchro): PastilleSynchro {
  const { activee, statut, bail, etat, maintenant } = l;
  if (!activee) return 'arretee';
  if (statut?.etat === 'en-cours' && bail !== null && bail > maintenant) return 'en-cours';
  if (statut?.etat === 'arret' && statut.raison !== 'manuel') return 'erreur';
  if (statut?.etat === 'arret' || (etat?.arretJusqua ?? 0) > maintenant) return 'arretee';
  return 'a-jour';
}

function useLectureSynchro(): LectureSynchro {
  const [lecture, setLecture] = useState<LectureSynchro>(LECTURE_INITIALE);
  const relire = useCallback(async (): Promise<void> => {
    const sans = <T,>(p: Promise<T>, defaut: T): Promise<T> => p.catch(() => defaut);
    const [activee, statut, bail, derniere, etat] = await Promise.all([
      sans(chargerSyncAuto(), true),
      sans(chargerStatutSynchro(), null),
      sans(chargerBailSynchro(), null),
      sans(chargerDerniereSynchro(), null),
      sans(chargerEtatSynchro(), null),
    ]);
    setLecture({ activee, statut, bail, derniere, etat, maintenant: Date.now() });
  }, []);
  useEffect(() => {
    const premiere = setTimeout(() => void relire(), 0);
    const minuteur = setInterval(() => void relire(), RELECTURE_MS);
    const retirer = ecouterSynchroAuto(() => void relire());
    return () => {
      clearTimeout(premiere);
      clearInterval(minuteur);
      retirer();
    };
  }, [relire]);
  return lecture;
}

const accorder = (n: number, singulier: string, pluriel: string): string => `${n} ${n > 1 ? pluriel : singulier}`;

/**
 * Onglet Tableau de bord (T-305) : quatre chiffres clés, répartition des décisions, santé de la synchro.
 * Lecture seule du stockage (collection, préférences, état de synchro) ; aucune requête, aucune vérification Wikipédia.
 */
const OngletTableauDeBord: React.FC = () => {
  const [collection, setCollection] = useState<Collection>(collectionVide);
  const [preferences, setPreferences] = useState<Preferences>(preferencesParDefaut);
  const [chargee, setChargee] = useState(false);
  const synchro = useLectureSynchro();

  useEffect(() => {
    void chargerPreferences().then(setPreferences).catch(() => undefined);
    void chargerCollection()
      .then(setCollection)
      .catch(() => undefined)
      .finally(() => setChargee(true));
    return ecouterCollection(setCollection);
  }, []);

  const tableau = useMemo(() => {
    const contexte: ContexteTableauDeBord = {
      maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees,
      ventesSite: synchro.etat?.ventesSite ?? null,
      synchro: { activee: synchro.activee, etat: pastilleDe(synchro), derniereTerminee: synchro.derniere },
      prix: synchro.etat?.prix ?? {},
      amis: preferences.amis,
    };
    return calculerTableauDeBord(collection, contexte, synchro.maintenant);
  }, [collection, preferences.amis, synchro]);

  // Avant la lecture du stockage, les chiffres partent de 0 : le compteur défile ensuite jusqu’à la valeur (D-61).
  const v = (n: number | null): number | null => (chargee ? n : 0);
  const vide = chargee && collection.cartes.length === 0;
  const { places } = tableau;

  return (
    <section className="mt-4" aria-busy={!chargee}>
      <h2 className="text-xl font-semibold">Tableau de bord</h2>
      <p className="mt-2 text-sm" data-testid="resume">
        {chargee
          ? `${tableau.exemplaires} exemplaires · ${accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}`
          : 'Lecture de la collection…'}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CarteKpi
          libelle="Exemplaires"
          valeur={v(tableau.exemplaires)}
          detail={`${accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}${tableau.enVente > 0 ? ` · + ${tableau.enVente} en vente` : ''}`}
        />
        <CarteKpi
          libelle="Valeur estimée"
          valeur={v(tableau.valeur)}
          detail={tableau.partSansPrix === null ? 'Aucun prix connu' : `${tableau.partSansPrix}\u00a0% des cartes sans prix`}
        />
        <CarteKpi
          libelle="Places"
          valeur={v(places.occupees)}
          suffixe={`/ ${places.max}`}
          detail="Places d’enchères occupées"
        />
        <CarteKpi
          libelle="Écarts"
          valeur={v(tableau.ecarts)}
          detail={tableau.ecarts === 0 ? 'Étiquettes conformes au plan' : 'Cartes dont les étiquettes diffèrent du plan'}
        />
      </div>

      {vide && <p className="mt-4 rounded border border-line bg-ink-2 p-4">Aucune carte</p>}
      {chargee && !vide && <BarreRepartition repartition={tableau.repartition} />}

      <SanteSynchro
        pastille={tableau.sante.pastille}
        ageLibelle={tableau.sante.ageLibelle}
        activee={synchro.activee}
        prixReleves={tableau.fraicheurPrix.releves}
      />
    </section>
  );
};

export default OngletTableauDeBord;
