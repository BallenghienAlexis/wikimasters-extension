import React, { useEffect, useMemo, useState } from 'react';
import { collectionVide, type Collection } from '../lib/collection';
import { chargerCollection, chargerPreferences, ecouterCollection } from '../lib/stockage';
import { calculerTableauDeBord, type ContexteTableauDeBord } from '../lib/tableauDeBord';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import CarteKpi from './CarteKpi';
import SanteSynchro from './SanteSynchro';
import { pastilleDe, useLectureSynchro } from './useLectureSynchro';

const accorder = (n: number, singulier: string, pluriel: string): string => `${n} ${n > 1 ? pluriel : singulier}`;

/**
 * Onglet Tableau de bord (T-305) : trois chiffres clés, santé de la synchro.
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
      synchro: { activee: synchro.activee, etat: pastilleDe(synchro), derniereTerminee: synchro.derniere },
      prix: synchro.etat?.prix ?? {},
      amis: preferences.amis,
    };
    return calculerTableauDeBord(collection, contexte, synchro.maintenant);
  }, [collection, preferences.amis, synchro]);

  // Avant la lecture du stockage, les chiffres partent de 0 : le compteur défile ensuite jusqu’à la valeur (D-61).
  const v = (n: number | null): number | null => (chargee ? n : 0);
  const vide = chargee && collection.cartes.length === 0;

  return (
    <section className="mt-4" aria-busy={!chargee}>
      <h2 className="text-xl font-semibold">Tableau de bord</h2>
      <p className="mt-2 text-sm" data-testid="resume">
        {chargee
          ? `${tableau.exemplaires} exemplaires · ${accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}`
          : 'Lecture de la collection…'}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CarteKpi
          libelle="Exemplaires"
          unite="exemplaires"
          valeur={v(tableau.exemplaires)}
          detail={accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}
        />
        <CarteKpi
          libelle="Valeur estimée"
          unite="pièces"
          valeur={v(tableau.valeur)}
          detail={tableau.partSansPrix === null ? 'Aucun prix connu' : `${tableau.partSansPrix}\u00a0% des cartes sans prix`}
        />
        <CarteKpi
          libelle="Écarts"
          valeur={v(tableau.ecarts)}
          detail={tableau.ecarts === 0 ? 'Étiquettes conformes au plan' : 'Cartes dont les étiquettes diffèrent du plan'}
        />
      </div>

      {vide && <p className="mt-4 rounded border border-line bg-ink-2 p-4">Aucune carte</p>}

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
