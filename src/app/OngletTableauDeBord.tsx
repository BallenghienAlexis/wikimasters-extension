import React, { useEffect, useMemo, useState } from 'react';
import { collectionVide, type Collection } from '../lib/collection';
import { chargerCollection, chargerIgnorees, chargerPreferences, ecouterCollection, ecouterIgnorees } from '../lib/stockage';
import { calculerTableauDeBord, lignesSante as lignesSanteDe, type ContexteTableauDeBord, type LigneSante } from '../lib/tableauDeBord';
import { peremptionPrixMs } from '../lib/ordonnanceur';
import { plafondDefausse, preferencesParDefaut, type Preferences } from '../lib/tri';
import { idsSansPrixConfirme, FRAICHEUR_SANS_PRIX_MS, verdictsDesCartes } from '../lib/selectionLot';
import { repartitionDestinations, repartitionThemes, type IdDestination, type Part } from '../lib/graphiquesTableauDeBord';
import type { CacheWikipedia } from '../lib/wikipedia';
import CalendrierActivite from './CalendrierActivite';
import CamembertRepartition from './CamembertRepartition';
import ProfilAffluenceSemaine from './ProfilAffluenceSemaine';
import { useDonneesGraphiques } from './useDonneesGraphiques';
import CarteKpi from './CarteKpi';
import SanteSynchro from './SanteSynchro';
import { pastilleDe, useLectureSynchro } from './useLectureSynchro';

const accorder = (n: number, singulier: string, pluriel: string): string => `${n} ${n > 1 ? pluriel : singulier}`;

/**
 * Onglet Tableau de bord (T-305) : chiffres clés, graphiques et santé de la synchro, tous visibles (aucun bloc repliable, Alexis 2026-11-24).
 * Lecture seule du stockage (collection, préférences, état de synchro) ; aucune requête, aucune vérification Wikipédia.
 */
const COULEURS_DESTINATION: Record<IdDestination, string> = {
  moi: 'var(--color-garder)',
  amis: 'var(--color-echanger)',
  vendre: 'var(--color-vendre)',
  defausser: 'var(--color-defausser)',
  'a-traiter': 'var(--color-muted)',
};

interface Props {
  /** Cache Wikipédia de la page : change les thèmes lus, donc les répartitions (surcouche en mémoire). */
  cacheWiki?: CacheWikipedia;
}

const OngletTableauDeBord: React.FC<Props> = ({ cacheWiki }) => {
  const [collection, setCollection] = useState<Collection>(collectionVide);
  const [preferences, setPreferences] = useState<Preferences>(preferencesParDefaut);
  const [chargee, setChargee] = useState(false);
  const synchro = useLectureSynchro();
  const [nbIgnorees, setNbIgnorees] = useState(0);
  const graphiques = useDonneesGraphiques();

  useEffect(() => {
    void chargerPreferences().then(setPreferences).catch(() => undefined);
    void chargerCollection()
      .then(setCollection)
      .catch(() => undefined)
      .finally(() => setChargee(true));
    const relireIgnorees = (): void => void chargerIgnorees().then((l) => setNbIgnorees(l.length)).catch(() => undefined);
    relireIgnorees();
    const arretIgnorees = ecouterIgnorees(relireIgnorees);
    const arretCollection = ecouterCollection(setCollection);
    return () => {
      arretIgnorees();
      arretCollection();
    };
  }, []);

  const tableau = useMemo(() => {
    const contexte: ContexteTableauDeBord = {
      synchro: { activee: synchro.activee, etat: pastilleDe(synchro), derniereTerminee: synchro.derniere },
      prix: synchro.etat?.prix ?? {},
      amis: preferences.amis,
    };
    return calculerTableauDeBord(collection, contexte, synchro.maintenant);
  }, [collection, preferences.amis, synchro]);

  const lignesSante = useMemo(
    (): LigneSante[] =>
      lignesSanteDe({
        exemplaires: tableau.exemplaires,
        ageLibelle: tableau.sante.ageLibelle,
        derniereTerminee: synchro.derniere,
        etiquettesLues: synchro.statut?.etiquettes ?? 0,
        releves: Object.values(synchro.etat?.prix ?? {}).map((r) => r.releveLe),
        perimes: Object.values(synchro.etat?.prix ?? {}).filter((r) => synchro.maintenant - r.releveLe > peremptionPrixMs(r)).length,
        ignorees: nbIgnorees,
        maintenant: synchro.maintenant,
      }),
    [synchro, tableau, nbIgnorees],
  );

  const sansPrix = useMemo(
    () => new Set(idsSansPrixConfirme(collection.cartes, synchro.etat?.prix ?? {}, synchro.maintenant, FRAICHEUR_SANS_PRIX_MS, plafondDefausse(preferences))),
    [collection.cartes, synchro.etat?.prix, synchro.maintenant, preferences],
  );
  const partsThemes = useMemo(
    (): Part[] => repartitionThemes(collection.cartes),
    // `cacheWiki` change les thèmes lus (surcouche Wikipédia, état de module).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection.cartes, cacheWiki],
  );
  const partsDestinations = useMemo(
    (): Part[] => repartitionDestinations(verdictsDesCartes(collection.cartes, preferences, sansPrix)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collection.cartes, preferences, sansPrix, cacheWiki],
  );

  // Avant la lecture du stockage, les chiffres partent de 0 : le compteur défile ensuite jusqu’à la valeur (D-61).
  const v = (n: number | null): number | null => (chargee ? n : 0);
  const vide = chargee && collection.cartes.length === 0;

  return (
    <section className="mt-4" aria-busy={!chargee}>
      <div className="flex flex-wrap items-baseline gap-x-3">
      <h2 className="text-xl font-semibold">Tableau de bord</h2>
      <p className="text-sm" data-testid="resume">
        {chargee
          ? `${tableau.exemplaires} exemplaires · ${accorder(tableau.distinctes, 'carte distincte', 'cartes distinctes')}`
          : 'Lecture de la collection…'}
      </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="chiffres-cles">
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
      <p className="mt-2 text-xs text-muted" data-testid="sans-theme">
        {tableau.sansTheme === 0
          ? 'Toutes les cartes reliées ont un thème fiable.'
          : `${accorder(tableau.sansTheme, 'carte reliée sans thème fiable', 'cartes reliées sans thème fiable')} : aucune étiquette de thème posée pour l’instant.`}
      </p>

      {vide && <p className="mt-3 rounded border border-line bg-ink-2 p-4">Aucune carte</p>}

      {/* Grille responsive : une colonne sur mobile, deux dès 768 px (blocs toujours visibles, sans repli). */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <CalendrierActivite activite={graphiques.activite} />
        <ProfilAffluenceSemaine evenements={graphiques.affluence} />
      <CamembertRepartition
        id="repartition-themes"
        titre="Répartition des thèmes"
        explication="Thème principal de chaque carte (le mieux établi), cartes distinctes, un secteur par thème."
        parts={partsThemes}
        etiquettes
        className="md:col-span-2"
        vide="Aucune carte à répartir."
        unite="cartes"
        couleurDe={(p) => (p.id === 'sans-theme' ? 'var(--color-muted)' : undefined)}
      />
      <CamembertRepartition
        id="repartition-destinations"
        titre="Ma collection : gardée, amis, vente, défausse"
        explication="Verdict de garde de chaque carte (mêmes règles que les lots et les filtres « Cartes gardées » de la Collection), cartes distinctes."
        parts={partsDestinations}
        vide="Aucune carte à répartir."
        unite="cartes"
        couleurDe={(p) => COULEURS_DESTINATION[p.id as IdDestination]}
      />


      <SanteSynchro
        pastille={tableau.sante.pastille}
        ageLibelle={tableau.sante.ageLibelle}
        activee={synchro.activee}
        prixReleves={tableau.fraicheurPrix.releves}
        lignes={lignesSante}
      />
      </div>
    </section>
  );
};

export default OngletTableauDeBord;
