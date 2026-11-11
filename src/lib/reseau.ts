/**
 * Émission réelle des requêtes d’écriture vers l’hôte REST du site (spec synchro-complete).
 *
 * Seul module, avec `jeton.ts` en amont, à envoyer le jeton de session : lu en mémoire à chaque
 * requête, jamais gardé, journalisé ni renvoyé. Aucun résultat ne contient de corps de réponse :
 * seuls une classe, un code HTTP, un libellé fixe et, pour une création, l’identifiant validé.
 * Aucun aléatoire ici : le délai variable est tiré par l’appelant (`Synchronisation.tsx`).
 */
import type { Action, ResultatAction } from './actions'
import type { EntreeContrat, TableContrat } from './contrat'
import { enteteAuthentification, sessionCourante, type SessionLue } from './jeton'
import { COULEUR_ETIQUETTE, CLE_PUBLIQUE, DELAI_REQUETE_MS, ORIGINE_REST } from '../config/synchro'

export interface DependancesReseau {
  table: TableContrat
  /** Origine de l’onglet qui émet (`location.origin`). */
  origineOnglet: string
  /** Session courante, relue à chaque requête (par défaut : cookie du site). */
  session?: () => SessionLue | null
  fetchImpl?: typeof fetch
}

const CODES_ARRET = [401, 403, 429]
const NON_DISPONIBLE: ResultatAction = { classe: 'echec', codeHttp: null, cause: 'action non disponible' }

async function lireJson(reponse: Response): Promise<unknown> {
  try {
    const texte = await reponse.text()
    return texte === '' ? null : JSON.parse(texte)
  } catch {
    return null
  }
}

export function creerEmetteur(deps: DependancesReseau): (ordre: Action) => Promise<ResultatAction> {
  const appel = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  return async (ordre) => {
    const entree: EntreeContrat | undefined = deps.table[ordre.type]
    if (entree === undefined) return NON_DISPONIBLE

    const session = (deps.session ?? sessionCourante)()
    let chemin: string
    let corps: unknown
    try {
      chemin = entree.construireChemin(ordre)
      corps = entree.construireCorps(ordre, { idJoueur: session?.idJoueur ?? '', couleurEtiquette: COULEUR_ETIQUETTE })
    } catch {
      return NON_DISPONIBLE
    }
    if (entree.methode !== 'DELETE' && entree.methode !== 'GET' && corps === null) return NON_DISPONIBLE

    const url = `${ORIGINE_REST}${chemin}`
    const jeton = entree.auth
      ? enteteAuthentification(url, deps.origineOnglet, 'Authorization', () => (session ? `Bearer ${session.jeton}` : null))
      : null
    if (entree.auth && jeton === null) return { classe: 'arret', codeHttp: null, cause: 'jeton-absent' }

    const entetes: Record<string, string> = {
      Accept: 'application/json',
      apikey: CLE_PUBLIQUE,
      'Content-Profile': 'public',
      ...(corps !== null ? { 'Content-Type': 'application/json' } : {}),
      ...(entree.entetes ?? {}),
    }
    if (jeton) entetes[jeton.nom] = jeton.valeur

    const controle = new AbortController()
    const minuteur = setTimeout(() => controle.abort(), DELAI_REQUETE_MS)
    try {
      const reponse = await appel(url, {
        method: entree.methode,
        headers: entetes,
        body: corps !== null ? JSON.stringify(corps) : undefined,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: controle.signal,
      })
      const json = await lireJson(reponse)
      if (CODES_ARRET.includes(reponse.status)) {
        return { classe: 'echec', codeHttp: reponse.status, cause: 'action non disponible' }
      }
      if (reponse.status < 200 || reponse.status > 299) {
        return { classe: 'echec', codeHttp: reponse.status, cause: 'erreur d’émission' }
      }
      if (entree.validerReponse(reponse.status, json) !== 'reussie') {
        return { classe: 'inconnu', codeHttp: reponse.status, cause: 'réponse hors contrat' }
      }
      const id = entree.lireIdEtiquette?.(json) ?? null
      return { classe: 'reussie', codeHttp: reponse.status, cause: 'action réussie', ...(id !== null ? { idEtiquette: id } : {}) }
    } catch (e) {
      const delai = e instanceof Error && e.name === 'AbortError'
      return { classe: 'inconnu', codeHttp: null, cause: delai ? 'délai dépassé' : 'erreur réseau' }
    } finally {
      clearTimeout(minuteur)
    }
  }
}
