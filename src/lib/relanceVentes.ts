/**
 * Relance automatique des mises en vente (Alexis, 2026-11-17 : « quand une enchère est finie, lance une nouvelle »).
 *
 * Logique pure : choisit la prochaine carte à mettre aux enchères quand une place se libère, par la règle de pré-cochage
 * existante (`precocher`, choix 1 d’Alexis) puis `construireEncheres` (favoris exclus, valeur connue, prix de départ sous la
 * valeur, plus chères d’abord, durée 1 h, places libres). Une carte « à classer » n’est jamais proposable.
 */
import { CONFIG_PRIX } from '../config/prix'
import type { Action, TypesDisponibles } from './actions'
import type { Carte, Collection } from './collection'
import { construireEncheres, type Config } from './lot'
import { estProposable, precocher } from './selectionLot'
import type { TendancePrix } from './lectureApi'
import { plafondDefausse, type Preferences } from './tri'

export interface EntreeChoix {
  collection: Collection
  preferences: Preferences
  /** Enchères en cours et maximum du site à la dernière lecture. */
  enCours: number
  max: number
  /** Exemplaires déjà en vente (lus sur le site) : jamais remis en vente. */
  exemplairesEnVente: ReadonlySet<string>
  /** Exemplaires écartés (refus récent) : jamais retentés tout de suite. */
  exemplairesEcartes: ReadonlySet<string>
  /** Cartes retirées de la relance par le joueur (choix explicite après l’avertissement). */
  titresRetires?: ReadonlySet<string>
  /** Retente cet exemplaire seulement (enchère terminée sans vente : la même carte est remise en vente moins chère). */
  seulementExemplaire?: string
  /** Identifiant local → `card_id` du site et dernière tendance mémorisée : relecture du prix juste avant l’envoi. */
  idsCartesSite?: Readonly<Record<string, string>>
  tendances?: Readonly<Record<string, TendancePrix>>
}

/** Prochaine mise aux enchères à lancer, ou `null` (aucune place libre ou aucune carte éligible). */
export function choisirProchaineEnchere(e: EntreeChoix): { action: Extract<Action, { type: 'enchere' }>; titre: string } | null {
  if (e.enCours >= Math.min(e.max, CONFIG_PRIX.maxVentesSimultanees)) return null
  const cartes: Carte[] = []
  for (const c of e.collection.cartes) {
    if (!estProposable(c) || e.titresRetires?.has(c.titre)) continue
    const libres = (c.idsSite ?? []).filter((id) => !e.exemplairesEnVente.has(id) && !e.exemplairesEcartes.has(id) && (e.seulementExemplaire === undefined || id === e.seulementExemplaire))
    if (libres.length === 0) continue
    cartes.push({ ...c, idsSite: libres })
  }
  const choix = precocher(cartes, e.preferences, new Map())
  const aVendre = cartes.filter((c) => choix.get(c.id)?.choix === 'vendre')
  const config: Config = {
    maxVentesSimultanees: CONFIG_PRIX.maxVentesSimultanees,
    plafondDefausse: plafondDefausse(e.preferences),
    mesThemes: e.preferences.mesThemes,
    longueurMaxEtiquette: null,
    nomsExistants: [],
    amis: e.preferences.amis,
    lienCardId: true,
    ventesSite: { enCours: e.enCours, max: e.max },
    ...(e.idsCartesSite ? { idsCartesSite: e.idsCartesSite } : {}),
    ...(e.tendances ? { tendances: e.tendances } : {}),
  }
  const dispo: TypesDisponibles = new Set(['enchere'])
  const { actions } = construireEncheres(aVendre, e.enCours, config, dispo)
  const action = actions.find((a): a is Extract<Action, { type: 'enchere' }> => a.type === 'enchere')
  if (!action) return null
  const carte = aVendre.find((c) => c.id === action.idCarte)
  return { action, titre: carte?.titre ?? action.idCarte }
}
