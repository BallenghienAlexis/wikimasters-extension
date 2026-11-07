import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG_PRIX } from '../config/prix';
import type { Action, CarteEcartee, RaisonEcart, Registre, TypeAction, TypesDisponibles } from '../lib/actions';
import type { Carte, Collection } from '../lib/collection';
import { typesDisponibles } from '../lib/contrat';
import { construireLot, type EtiquetteObsolete, type LotConstruit } from '../lib/lot';

/** Secondes entre deux requêtes (cadence fixe de la file). */
const SECONDES_PAR_ACTION = 6;
/** Nombre maximal de lignes d’actions affichées (SC-025). */
const LIGNES_MAX = 100;
/** Au-delà, les cartes écartées sont regroupées par raison. */
const ECARTEES_MAX = 50;

/** Espace insécable : typographie française avant « : » (D-40). */
const NB = ' ';

export const CADENCE_TEXTE = `Cadence fixe${NB}: 10 actions par minute · arrêt après 3 erreurs`;

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
  return `Lot prêt${NB}: ${n} ${n > 1 ? 'actions' : 'action'}`;
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

export const texteDuree = (nbRequetes: number): string => `Durée estimée${NB}: ${dureeMinutes(nbRequetes)} min`;

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
  /** L’état de l’exécution n’a pas pu être lu : on ne lance rien. */
  executionIllisible: boolean;
  executionEnCours: boolean;
  nbDisponibles: number;
}

/** Raison pour laquelle « Lancer » est désactivé, ou `null` s’il peut l’être (D-18). */
export function raisonDesactivation(c: ConditionsLancement): string | null {
  if (c.executionIllisible) return `L’état de l’exécution est illisible${NB}: Lancer est impossible.`;
  if (c.executionEnCours) return 'Une exécution est déjà en cours.';
  if (c.nbOnglets === 0) return 'Aucun onglet WikiMasters ouvert.';
  if (c.nbOnglets > 1) return `Plusieurs onglets WikiMasters sont ouverts${NB}: gardez-en un seul.`;
  if (c.nbDisponibles === 0) return 'Aucune action n’est disponible pour le moment.';
  return null;
}

export function pageActions<T>(actions: readonly T[], max: number = LIGNES_MAX): { visibles: T[]; restantes: number } {
  return { visibles: actions.slice(0, max), restantes: Math.max(0, actions.length - max) };
}

export type RaisonLigne = RaisonEcart | 'etiquette-obsolete';

/** Ligne de la liste « Cartes non incluses » : écartée ou étiquette obsolète conservée. */
export interface LigneNonIncluse {
  idCarte: string;
  titre: string;
  raison: RaisonLigne;
  nomEtiquette?: string;
}

export type Ecartees =
  | { type: 'liste'; lignes: LigneNonIncluse[] }
  | { type: 'groupes'; groupes: Array<{ raison: RaisonLigne; nombre: number }> };

/** Fusionne écartées et obsolètes : une ligne par carte et par raison (et par nom pour une obsolète). */
export function lignesNonIncluses(
  ecartees: readonly CarteEcartee[],
  obsoletes: readonly EtiquetteObsolete[],
): LigneNonIncluse[] {
  const vues = new Set<string>();
  const lignes: LigneNonIncluse[] = [];
  const ajouter = (l: LigneNonIncluse): void => {
    const cle = `${l.idCarte}\u0000${l.raison}\u0000${l.nomEtiquette ?? ''}`;
    if (vues.has(cle)) return;
    vues.add(cle);
    lignes.push(l);
  };
  for (const e of ecartees) ajouter({ idCarte: e.idCarte, titre: e.titre, raison: e.raison });
  for (const o of obsoletes) {
    ajouter({ idCarte: o.idCarte, titre: o.titre, raison: 'etiquette-obsolete', nomEtiquette: o.nomEtiquette });
  }
  return lignes;
}

export function libelleLigne(raison: RaisonLigne): string {
  return raison === 'etiquette-obsolete' ? 'étiquette obsolète conservée' : RAISONS[raison];
}

export function texteLotVide(avecIndisponibles: boolean): string {
  return avecIndisponibles
    ? 'Aucune action n’est disponible pour le moment.'
    : 'Les favoris, les cartes à trier et les cartes non reliées au site ne produisent aucune action.';
}

export type ResultatLot = { lot: LotConstruit } | { erreur: string };

/** Construit le lot. Un registre illisible (`null`) ou une exception donnent une cause fixe en français. */
export function preparerLot(collection: Collection, registre: Registre | null, dispo: TypesDisponibles): ResultatLot {
  if (registre === null) return { erreur: 'le registre des étiquettes est illisible' };
  try {
    return {
      lot: construireLot(
        collection,
        registre,
        { maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees, longueurMaxEtiquette: null, nomsExistants: [] },
        dispo,
      ),
    };
  } catch {
    return { erreur: 'calcul impossible' };
  }
}

export function regrouperEcartees(ecartees: readonly LigneNonIncluse[], seuil: number = ECARTEES_MAX): Ecartees {
  if (ecartees.length <= seuil) return { type: 'liste', lignes: [...ecartees] };
  const comptes = new Map<RaisonLigne, number>();
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
        return `retrait${NB}: ${a.nomEtiquette}`;
      case 'creation-etiquette':
        return `création${NB}: ${a.nomEtiquette}`;
      case 'pose-etiquette':
        return a.nomEtiquette;
      default:
        return '';
    }
  });
}

const CLASSE_BOUTON = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border bg-ink px-4';
const CLASSE_ACTIF = 'cursor-pointer hover:bg-line active:bg-line text-paper';
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
  /** Le registre n’a pas pu être lu : aucun lot ne peut être préparé. */
  registreIllisible?: boolean;
  /** L’état de l’exécution n’a pas pu être lu : « Lancer » reste désactivé. */
  executionIllisible?: boolean;
  /** Nombre d’onglets WikiMasters ouverts (comptés par la page d’exécution, T-017). */
  nbOnglets: number;
  executionEnCours: boolean;
  /** Types d’action dont l’entrée existe dans la table du contrat. */
  disponibles?: TypesDisponibles;
  /** Relit vraiment le stockage ; renvoie le registre, ou `null` s’il reste illisible. */
  onReessayer?: () => Promise<Registre | null>;
  /** Appelé par « Lancer » (câblé en T-017). */
  onLancer?: (actions: Action[]) => void;
}

const Synchronisation: React.FC<Props> = ({
  collection,
  registre,
  registreIllisible = false,
  executionIllisible = false,
  nbOnglets,
  executionEnCours,
  disponibles,
  onReessayer,
  onLancer,
}) => {
  // Lot figé au clic sur « Voir l’aperçu du lot » ou « Réessayer » : aucun recalcul ensuite.
  const [etat, setEtat] = useState<ResultatLot | null>(null);
  const titreRef = useRef<HTMLHeadingElement>(null);
  const ouvrirRef = useRef<HTMLButtonElement>(null);
  const dejaOuvert = useRef(false);

  const dispo = useMemo(() => disponibles ?? typesDisponibles(), [disponibles]);
  const cartes = useMemo(() => new Map(collection.cartes.map((c) => [c.id, c])), [collection.cartes]);

  const ouvert = etat !== null;
  useEffect(() => {
    if (ouvert) {
      titreRef.current?.focus();
      dejaOuvert.current = true;
    } else if (dejaOuvert.current) {
      ouvrirRef.current?.focus();
    }
  }, [ouvert]);

  const ouvrir = (): void => setEtat(preparerLot(collection, registreIllisible ? null : registre, dispo));
  const reessayer = async (): Promise<void> => {
    const r = onReessayer ? await onReessayer() : registreIllisible ? null : registre;
    setEtat(preparerLot(collection, r, dispo));
  };

  const lot = etat && 'lot' in etat ? etat.lot : null;
  const separes = useMemo(() => (lot ? separerDisponibles(lot.actions, dispo) : null), [lot, dispo]);
  const details = useMemo(() => (separes ? detailsDuLot(separes.disponibles, cartes) : []), [separes, cartes]);
  const page = useMemo(() => pageActions(separes?.disponibles ?? []), [separes]);
  const lignes = useMemo(() => {
    if (!lot || !separes) return [];
    // Les actions « non disponibles » sont listées avec les cartes non incluses (D-17).
    const indispo: CarteEcartee[] = separes.indisponibles.map((a) => ({
      idCarte: a.idCarte,
      titre: cartes.get(a.idCarte)?.titre ?? a.idCarte,
      raison: 'action-non-disponible',
    }));
    return lignesNonIncluses([...lot.ecartees, ...indispo], lot.obsoletes);
  }, [lot, separes, cartes]);
  const groupees = useMemo(() => regrouperEcartees(lignes), [lignes]);

  const n = separes?.disponibles.length ?? 0;
  const avecIndisponibles = lignes.some((l) => l.raison === 'action-non-disponible');
  const afficherLancer = n > 0 || avecIndisponibles;
  const raison = raisonDesactivation({ nbOnglets, executionEnCours, executionIllisible, nbDisponibles: n });
  const classeSecondaire = `${CLASSE_BOUTON} ${CLASSE_ACTIF} border-muted`;

  return (
    <div data-testid="synchronisation">
      <BandeauRisque />

      <section aria-labelledby="titre-synchro" className="mt-4 rounded border border-line bg-ink-2 p-4">
        <h2 id="titre-synchro" ref={titreRef} tabIndex={-1} className="font-semibold" data-testid="titre-apercu">
          {lot ? titreApercu(n) : 'Synchronisation avec WikiMasters'}
        </h2>

        {!ouvert ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Voyez d’abord ce qui serait envoyé au site. Rien n’est envoyé tant que vous n’avez pas lancé le lot.
            </p>
            <button
              ref={ouvrirRef}
              type="button"
              className={`${CLASSE_BOUTON} ${CLASSE_ACTIF} mt-3 border-paper font-semibold`}
              onClick={ouvrir}
            >
              Voir l’aperçu du lot
            </button>
          </>
        ) : !lot || !separes ? (
          <>
            <p className="mt-2 break-words font-semibold text-defausser" role="alert">
              Le lot n’a pas pu être préparé{NB}: {etat && 'erreur' in etat ? etat.erreur : ''}.
            </p>
            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              <button type="button" className={classeSecondaire} onClick={() => void reessayer()}>
                Réessayer
              </button>
              <button type="button" className={classeSecondaire} onClick={() => setEtat(null)}>
                Fermer
              </button>
            </div>
          </>
        ) : (
          <>
            {n === 0 ? (
              <p className="mt-2 text-sm text-muted">{texteLotVide(avecIndisponibles)}</p>
            ) : (
              <>
                <p className="mt-2 text-sm">{texteTotaux(totauxParType(separes.disponibles))}</p>
                <p className="mt-1 text-sm">{texteDuree(n)}</p>

                <div
                  aria-hidden="true"
                  className={`mt-3 hidden border-b border-line pb-1 text-sm font-semibold md:grid ${GRILLE}`}
                >
                  <span>Carte</span>
                  <span>Action sur le site</span>
                  <span>Détail</span>
                </div>
                <ul aria-label="Actions du lot">
                  {page.visibles.map((a, i) => (
                    <li key={i} className={`border-b border-line px-0 py-2 text-sm md:px-2 ${GRILLE}`}>
                      <span className="break-words">{carteTexte(a.idCarte, cartes)}</span>
                      <span className={`break-words font-semibold ${classeType(a.type)}`}>
                        <span className="font-normal text-muted md:sr-only">Action{NB}: </span>
                        {libelleType(a.type)}
                      </span>
                      <span className="break-words text-muted">
                        <span className="md:sr-only">Détail{NB}: </span>
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

            {lignes.length > 0 && (
              <details className="mt-3 text-sm text-muted">
                <summary className="min-h-11 cursor-pointer py-2">Cartes non incluses ({lignes.length})</summary>
                {groupees.type === 'liste' ? (
                  <ul>
                    {groupees.lignes.map((e, i) => (
                      <li key={i} className="break-words py-1">
                        {carteTexte(e.idCarte, cartes)}
                        {NB}: {libelleLigne(e.raison)}
                        {e.nomEtiquette ? ` (${e.nomEtiquette})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul>
                    {groupees.groupes.map((g) => (
                      <li key={g.raison} className="py-1">
                        {g.nombre} {g.nombre > 1 ? 'cartes' : 'carte'}
                        {NB}: {libelleLigne(g.raison)}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            )}

            <p className="mt-3 text-sm text-muted">{CADENCE_TEXTE}</p>

            <div className="mt-3 flex flex-col gap-2 md:flex-row">
              {afficherLancer && (
                <button
                  type="button"
                  aria-disabled={raison !== null}
                  aria-describedby={raison !== null ? 'raison-lancer' : undefined}
                  className={`${CLASSE_BOUTON} font-semibold ${raison !== null ? CLASSE_INACTIF : `${CLASSE_ACTIF} border-paper`}`}
                  onClick={() => {
                    if (raison === null) onLancer?.(separes.disponibles);
                  }}
                >
                  {n === 0 ? 'Lancer' : n > 1 ? `Lancer les ${n} actions` : 'Lancer l’action'}
                </button>
              )}
              <button type="button" className={classeSecondaire} onClick={() => setEtat(null)}>
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
