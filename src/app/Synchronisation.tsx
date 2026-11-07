import React, { useMemo, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type { Action, CarteEcartee, RaisonEcart, Registre, TypeAction, TypesDisponibles } from '../lib/actions';
import type { Carte, Collection } from '../lib/collection';
import { typesDisponibles } from '../lib/contrat';
import { construireLot, type LotConstruit } from '../lib/lot';

/** Secondes entre deux requêtes (cadence fixe de la file). */
const SECONDES_PAR_ACTION = 6;
/** Nombre maximal de lignes d’actions affichées (SC-025). */
const LIGNES_MAX = 100;
/** Au-delà, les cartes écartées sont regroupées par raison. */
const ECARTEES_MAX = 50;

export const CADENCE_TEXTE = 'Cadence fixe : 10 actions par minute · arrêt après 3 erreurs';

const RAISONS: Record<RaisonEcart, string> = {
  'non-reliee': 'non reliée au site',
  'identifiant-en-conflit': 'identifiant d’exemplaire en conflit avec une autre carte',
  'en-attente-place': 'en attente d’une place libre',
  'action-non-disponible': 'action non disponible',
  'prix-invalide': 'prix de départ invalide',
  'prix-superieur-valeur': 'prix de départ supérieur ou égal à la valeur marchande',
  'valeur-absente': 'valeur marchande absente',
  'nom-trop-long': 'nom d’étiquette trop long',
  homonyme: 'une étiquette du même nom existe déjà sur le site',
  'exemplaires-non-relies': 'exemplaires non reliés au site',
};

export const libelleRaison = (raison: RaisonEcart): string => RAISONS[raison];

export function libelleType(type: TypeAction): string {
  switch (type) {
    case 'enchere':
      return 'Mettre aux enchères';
    case 'defausse':
      return 'Défausser';
    case 'lecture':
      return 'Lecture';
    default:
      return 'Étiquette';
  }
}

/** Classe de couleur du libellé : jamais la couleur seule ne porte le sens (D-05). */
function classeType(type: TypeAction): string {
  if (type === 'enchere') return 'text-vendre';
  if (type === 'defausse') return 'text-defausser';
  if (type === 'lecture' || type === 'creation-etiquette') return 'text-paper';
  return 'text-echanger';
}

export function titreApercu(n: number): string {
  if (n === 0) return 'Aucune action à envoyer';
  return `Lot prêt : ${n} ${n > 1 ? 'actions' : 'action'}`;
}

export interface Totaux {
  etiquettes: number;
  encheres: number;
  defausses: number;
  lectures: number;
}

export function totauxParType(actions: readonly Action[]): Totaux {
  const t: Totaux = { etiquettes: 0, encheres: 0, defausses: 0, lectures: 0 };
  for (const a of actions) {
    if (a.type === 'enchere') t.encheres++;
    else if (a.type === 'defausse') t.defausses++;
    else if (a.type === 'lecture') t.lectures++;
    else t.etiquettes++;
  }
  return t;
}

export function texteTotaux(t: Totaux): string {
  const parts: string[] = [];
  const ajouter = (n: number, singulier: string, pluriel: string): void => {
    if (n > 0) parts.push(`${n} ${n > 1 ? pluriel : singulier}`);
  };
  ajouter(t.lectures, 'lecture', 'lectures');
  ajouter(t.etiquettes, 'étiquette', 'étiquettes');
  ajouter(t.encheres, 'enchère', 'enchères');
  ajouter(t.defausses, 'défausse', 'défausses');
  return parts.join(' · ');
}

export const dureeMinutes = (nbRequetes: number): number => Math.ceil((nbRequetes * SECONDES_PAR_ACTION) / 60);

export const texteDuree = (nbRequetes: number): string => `Durée estimée : ${dureeMinutes(nbRequetes)} min`;

export function separerDisponibles(
  actions: readonly Action[],
  disponibles: TypesDisponibles,
): { disponibles: Action[]; indisponibles: Action[] } {
  const r = { disponibles: [] as Action[], indisponibles: [] as Action[] };
  for (const a of actions) (disponibles.has(a.type) ? r.disponibles : r.indisponibles).push(a);
  return r;
}

export interface ConditionsLancement {
  nbOnglets: number;
  executionEnCours: boolean;
  nbDisponibles: number;
}

/** Raison pour laquelle « Lancer » est désactivé, ou `null` s’il peut l’être (D-18). */
export function raisonDesactivation(c: ConditionsLancement): string | null {
  if (c.executionEnCours) return 'Une exécution est déjà en cours.';
  if (c.nbOnglets === 0) return 'Aucun onglet WikiMasters ouvert.';
  if (c.nbOnglets > 1) return 'Plusieurs onglets WikiMasters sont ouverts : gardez-en un seul.';
  if (c.nbDisponibles === 0) return 'Aucune action n’est disponible pour le moment.';
  return null;
}

export function pageActions<T>(actions: readonly T[], max: number = LIGNES_MAX): { visibles: T[]; restantes: number } {
  return { visibles: actions.slice(0, max), restantes: Math.max(0, actions.length - max) };
}

export type Ecartees =
  | { type: 'liste'; lignes: CarteEcartee[] }
  | { type: 'groupes'; groupes: Array<{ raison: RaisonEcart; nombre: number }> };

export function regrouperEcartees(ecartees: readonly CarteEcartee[], seuil: number = ECARTEES_MAX): Ecartees {
  if (ecartees.length <= seuil) return { type: 'liste', lignes: [...ecartees] };
  const comptes = new Map<RaisonEcart, number>();
  for (const e of ecartees) comptes.set(e.raison, (comptes.get(e.raison) ?? 0) + 1);
  return { type: 'groupes', groupes: [...comptes].map(([raison, nombre]) => ({ raison, nombre })) };
}

/** Détail de chaque action, dans l’ordre du lot (numérotation des défausses par carte). */
export function detailsDuLot(actions: readonly Action[], cartes: ReadonlyMap<string, Carte>): string[] {
  const totalDefausses = new Map<string, number>();
  for (const a of actions) if (a.type === 'defausse') totalDefausses.set(a.idCarte, (totalDefausses.get(a.idCarte) ?? 0) + 1);
  const rang = new Map<string, number>();
  return actions.map((a) => {
    switch (a.type) {
      case 'defausse': {
        const k = (rang.get(a.idCarte) ?? 0) + 1;
        rang.set(a.idCarte, k);
        return `exemplaire ${k} sur ${totalDefausses.get(a.idCarte) ?? k}`;
      }
      case 'enchere': {
        const valeur = cartes.get(a.idCarte)?.valeurMarchande;
        return valeur == null ? `départ ${a.prix}` : `départ ${a.prix} · valeur marchande ${valeur}`;
      }
      case 'retrait-etiquette':
        return `retrait : ${a.nomEtiquette}`;
      case 'creation-etiquette':
        return `création : ${a.nomEtiquette}`;
      case 'pose-etiquette':
        return a.nomEtiquette;
      default:
        return '';
    }
  });
}

const CLASSE_BOUTON =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border bg-ink px-4';
const CLASSE_ACTIF = 'hover:bg-line active:bg-line text-paper';
const CLASSE_INACTIF = 'border-dashed border-muted text-muted cursor-not-allowed';
const GRILLE = 'grid grid-cols-1 gap-x-4 md:grid-cols-3 xl:grid-cols-[3fr_2fr_2fr]';

function carteTexte(idCarte: string, cartes: ReadonlyMap<string, Carte>): string {
  const c = cartes.get(idCarte);
  if (c) return `[${c.rarete}] ${c.titre}`;
  const i = idCarte.indexOf('|');
  return i < 0 ? idCarte : `[${idCarte.slice(0, i)}] ${idCarte.slice(i + 1)}`;
}

function BandeauRisque(): React.ReactElement {
  return (
    <section
      aria-labelledby="titre-risque"
      className="mt-4 rounded border border-line border-l-4 border-l-defausser bg-ink-2 p-4"
      data-testid="bandeau-risque"
    >
      <h2 id="titre-risque" className="font-semibold text-defausser">
        <span aria-hidden="true">! </span>Action sur le site à votre place
      </h2>
      <p className="mt-2 break-words">
        Cette synchronisation envoie des requêtes à WikiMasters à votre place. Les règles de la communauté (§ 3) interdisent la
        rétro-ingénierie et l’interception du trafic, les conditions d’utilisation (§ 6) prévoient un bannissement pour
        automatisation, et le fichier <code>robots.txt</code> du site indique « Disallow: /api/ ».
      </p>
      <p className="mt-2 font-semibold">Risque de bannissement accepté le 07/11/2026.</p>
      <p className="mt-2">Une enchère et une défausse ne s’annulent pas depuis l’extension.</p>
    </section>
  );
}

interface Props {
  collection: Collection;
  registre: Registre;
  /** Nombre d’onglets WikiMasters ouverts (comptés par la page d’exécution, T-017). */
  nbOnglets: number;
  executionEnCours: boolean;
  /** Types d’action dont l’entrée existe dans la table du contrat. */
  disponibles?: TypesDisponibles;
  /** Appelé par « Lancer » (câblé en T-017). */
  onLancer?: (actions: Action[]) => void;
}

const Synchronisation: React.FC<Props> = ({ collection, registre, nbOnglets, executionEnCours, disponibles, onLancer }) => {
  const [ouvert, setOuvert] = useState(false);
  const [essai, setEssai] = useState(0);

  const dispo = useMemo(() => disponibles ?? typesDisponibles(), [disponibles]);
  const cartes = useMemo(() => new Map(collection.cartes.map((c) => [c.id, c])), [collection.cartes]);

  // Le lot est calculé une fois, à l’ouverture de l’aperçu, puis mémoïsé.
  const calcul = useMemo((): { lot: LotConstruit } | { erreur: true } | null => {
    if (!ouvert) return null;
    void essai;
    try {
      const lot = construireLot(
        collection,
        registre,
        { maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees, longueurMaxEtiquette: null, nomsExistants: [] },
        dispo,
      );
      return { lot };
    } catch {
      return { erreur: true };
    }
  }, [ouvert, essai, collection, registre, dispo]);

  const lot = calcul && 'lot' in calcul ? calcul.lot : null;
  const separes = useMemo(() => (lot ? separerDisponibles(lot.actions, dispo) : null), [lot, dispo]);
  const details = useMemo(() => (separes ? detailsDuLot(separes.disponibles, cartes) : []), [separes, cartes]);
  const page = useMemo(() => pageActions(separes?.disponibles ?? []), [separes]);
  const ecartees = useMemo(() => {
    if (!lot || !separes) return [];
    // Les actions « non disponibles » sont listées avec les cartes non incluses (D-17).
    const indispo: CarteEcartee[] = separes.indisponibles.map((a) => ({
      idCarte: a.idCarte,
      titre: cartes.get(a.idCarte)?.titre ?? a.idCarte,
      raison: 'action-non-disponible',
    }));
    return [...lot.ecartees, ...indispo];
  }, [lot, separes, cartes]);
  const groupees = useMemo(() => regrouperEcartees(ecartees), [ecartees]);

  const n = separes?.disponibles.length ?? 0;
  const afficherLancer = n > 0 || ecartees.some((e) => e.raison === 'action-non-disponible');
  const raison = raisonDesactivation({ nbOnglets, executionEnCours, nbDisponibles: n });

  return (
    <div data-testid="synchronisation">
      <BandeauRisque />

      <section aria-labelledby="titre-synchro" className="mt-4 rounded border border-line bg-ink-2 p-4" aria-busy={ouvert && !calcul}>
        {!ouvert ? (
          <>
            <h2 id="titre-synchro" className="font-semibold">Synchronisation avec WikiMasters</h2>
            <p className="mt-2 text-sm text-muted">
              Voyez d’abord ce qui serait envoyé au site. Rien n’est envoyé tant que vous n’avez pas lancé le lot.
            </p>
            <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-paper font-semibold`} onClick={() => setOuvert(true)}>
              Voir l’aperçu du lot
            </button>
          </>
        ) : calcul === null || !lot || !separes ? (
          <>
            <h2 id="titre-synchro" className="font-semibold">Synchronisation avec WikiMasters</h2>
            {calcul === null ? (
              <p className="mt-2">Calcul du lot…</p>
            ) : (
              <>
                <p className="mt-2 font-semibold text-defausser">Le lot n’a pas pu être préparé : calcul impossible.</p>
                <div className="mt-3 flex flex-col gap-2 md:flex-row">
                  <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`} onClick={() => setEssai(essai + 1)}>
                    Réessayer
                  </button>
                  <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`} onClick={() => setOuvert(false)}>
                    Fermer
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h2 id="titre-synchro" className="font-semibold" data-testid="titre-apercu">{titreApercu(n)}</h2>

            {n === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Les favoris, les cartes à trier et les cartes non reliées au site ne produisent aucune action.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm">{texteTotaux(totauxParType(separes.disponibles))}</p>
                <p className="mt-1 text-sm">{texteDuree(n)}</p>

                <div className={`mt-3 hidden border-b border-line pb-1 text-sm font-semibold md:grid ${GRILLE}`}>
                  <span>Carte</span>
                  <span>Action sur le site</span>
                  <span>Détail</span>
                </div>
                <ul className="md:mt-0" aria-label="Actions du lot">
                  {page.visibles.map((a, i) => (
                    <li key={i} className={`border-b border-line px-0 py-2 text-sm md:px-2 ${GRILLE}`}>
                      <span className="break-words">{carteTexte(a.idCarte, cartes)}</span>
                      <span className={`break-words font-semibold ${classeType(a.type)}`}>
                        <span className="font-normal text-muted md:hidden">Action : </span>
                        {libelleType(a.type)}
                      </span>
                      <span className="break-words text-muted">
                        <span className="md:hidden">Détail : </span>
                        {details[i]}
                      </span>
                    </li>
                  ))}
                </ul>
                {page.restantes > 0 && (
                  <p className="mt-2 text-sm text-muted" data-testid="actions-restantes">
                    … et {page.restantes} {page.restantes > 1 ? 'autres actions' : 'autre action'}
                  </p>
                )}
              </>
            )}

            {(ecartees.length > 0 || lot.obsoletes.length > 0) && (
              <details className="mt-3 text-sm text-muted">
                <summary className="min-h-11 cursor-pointer py-2">
                  Cartes non incluses ({ecartees.length + lot.obsoletes.length})
                </summary>
                {groupees.type === 'liste' ? (
                  <ul>
                    {groupees.lignes.map((e, i) => (
                      <li key={i} className="break-words py-1">
                        {carteTexte(e.idCarte, cartes)} : {libelleRaison(e.raison)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul>
                    {groupees.groupes.map((g) => (
                      <li key={g.raison} className="py-1">
                        {g.nombre} {g.nombre > 1 ? 'cartes' : 'carte'} : {libelleRaison(g.raison)}
                      </li>
                    ))}
                  </ul>
                )}
                {lot.obsoletes.length > 0 && (
                  <ul>
                    {lot.obsoletes.map((o, i) => (
                      <li key={i} className="break-words py-1">
                        {carteTexte(o.idCarte, cartes)} : étiquette obsolète conservée
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}

            <p className="mt-3 text-sm text-muted">{CADENCE_TEXTE}</p>

            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              {afficherLancer && (
                <>
                  <button
                    type="button"
                    aria-disabled={raison !== null}
                    aria-describedby={raison !== null ? 'raison-lancer' : undefined}
                    className={`${CLASSE_BOUTON} font-semibold ${raison !== null ? CLASSE_INACTIF : `${CLASSE_ACTIF} border-paper`}`}
                    onClick={() => {
                      if (raison === null && separes) onLancer?.(separes.disponibles);
                    }}
                  >
                    {n === 0 ? 'Lancer' : n > 1 ? `Lancer les ${n} actions` : 'Lancer l’action'}
                  </button>
                </>
              )}
              <button type="button" className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`} onClick={() => setOuvert(false)}>
                {afficherLancer ? 'Annuler' : 'Fermer'}
              </button>
            </div>
            {afficherLancer && raison !== null && (
              <p id="raison-lancer" className="mt-2 text-sm text-muted">
                {raison}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default Synchronisation;
