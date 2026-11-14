import React, { useEffect, useMemo, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import { collectionVide, type Collection } from '../lib/collection';
import { chargerCollection, chargerPreferences, ecouterCollection } from '../lib/stockage';
import { calculerTableauDeBord, type ContexteTableauDeBord } from '../lib/tableauDeBord';
import { preferencesParDefaut, type Preferences } from '../lib/tri';
import BarreRepartition from './BarreRepartition';
import CarteKpi from './CarteKpi';
import SanteSynchro from './SanteSynchro';
import TableauRaretes from './TableauRaretes';
import { pastilleDe, useLectureSynchro } from './useLectureSynchro';

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
      <h2 className="sr-only">Tableau de bord</h2>
      <p className="sr-only" data-testid="resume">
        {chargee
          ? `${tableau.exemplaires} exemplaires · ${accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}`
          : 'Lecture de la collection…'}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CarteKpi
          libelle="Exemplaires"
          unite="exemplaires"
          valeur={v(tableau.exemplaires)}
          detail={`${accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}${tableau.enVente > 0 ? ` · + ${tableau.enVente} en vente` : ''}`}
        />
        <CarteKpi
          libelle="Valeur estimée"
          unite="pièces"
          valeur={v(tableau.valeur)}
          detail={tableau.partSansPrix === null ? 'Aucun prix connu' : `${tableau.partSansPrix}\u00a0% des cartes sans prix`}
        />
        <CarteKpi
          libelle="Places"
          unite="places"
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
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {chargee && !vide && (
          <section className="min-w-0 rounded border border-line bg-ink-2 p-4" aria-label="Répartition des décisions">
            <h3 className="mb-2 text-[17px] font-semibold">Répartition des décisions</h3>
            <BarreRepartition repartition={tableau.repartition} />
            <TableauRaretes cartes={collection.cartes} />
          </section>
        )}
        <SanteSynchro
          pastille={tableau.sante.pastille}
          ageLibelle={tableau.sante.ageLibelle}
          activee={synchro.activee}
          prixReleves={tableau.fraicheurPrix.releves}
        />
      </div>
    </section>
  );
};

export default OngletTableauDeBord;
