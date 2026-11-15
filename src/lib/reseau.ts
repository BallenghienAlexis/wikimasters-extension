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
import { COULEUR_ETIQUETTE, CLE_PUBLIQUE, DELAI_REQUETE_MS, ORIGINE_REST, ORIGINE_SITE } from '../config/synchro'

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

/** Corps de réponse : JSON s’il l’est, et le texte brut (pour le seul diagnostic d’un refus, jamais stocké tel quel). */
async function lireCorps(reponse: Response): Promise<{ json: unknown; texte: string }> {
  let texte = ''
  try {
    texte = await reponse.text()
    return { json: texte === '' ? null : JSON.parse(texte), texte }
  } catch {
    return { json: null, texte }
  }
}

/**
 * Cause fixe d’un conflit 409 de l’enchère ou de la défausse : on ne recopie jamais le corps, on choisit
 * un libellé selon quelques mots du message d’erreur (limite d’enchères actives, sinon conflit générique).
 */
export function classerConflit(json: unknown): string {
  const message =
    typeof json === 'object' && json !== null
      ? [(json as Record<string, unknown>).message, (json as Record<string, unknown>).error]
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .slice(0, 300)
      : ''
  return /actives?|simultan|concurrent|maximum|limite|limit/i.test(message) ? 'limite d’enchères atteinte' : 'conflit signalé par le site'
}

/** Types dont le corps (identifiants d’exemplaire raccourcis, prix, durée) peut figurer dans le diagnostic d’un refus. */
const TYPES_AVEC_CORPS_DIAGNOSTIC: readonly string[] = ['enchere', 'defausse', 'favori']

/** Raccourcit les identifiants (UUID) et masque tout texte ressemblant à un jeton. */
function assainir(texte: string, max: number): string {
  return texte
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (u) => `${u.slice(0, 8)}…`)
    .replace(/eyJ[\w-]*\.[\w-]*\.[\w-]*/g, '[jeton masqué]')
    .replace(/[A-Za-z0-9_\-+/=.]{40,}/g, '[masqué]')
    .replace(/\s+/g, ' ')
    .slice(0, max)
}

/**
 * Ligne de diagnostic d’un refus (Alexis, 2026-11-15) : méthode, chemin, corps envoyé (enchère, défausse, favori
 * seulement), code et message du site (champs `message`, `error`, `code`, `details` ou `hint`, tronqués).
 * Jamais d’en-tête, de cookie ni de jeton ; les identifiants sont raccourcis.
 */
export function diagnosticDeRefus(methode: string, chemin: string, type: string, corps: unknown, statut: number, json: unknown, texte = '', secret = ''): string {
  const champs = typeof json === 'object' && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : {}
  const deJson = ['message', 'error', 'code', 'details', 'hint']
    .map((k) => champs[k])
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .join(' · ')
  // Corps non JSON (page d’erreur, pare-feu) : début du texte, sans balise ni secret.
  const brut = texte.replace(/<[^>]*>/g, ' ').trim().slice(0, 160)
  const message = (deJson !== '' ? deJson : brut).split(secret === '' ? '\u0000' : secret).join('[jeton masqué]')
  const envoye = TYPES_AVEC_CORPS_DIAGNOSTIC.includes(type) && corps !== null && corps !== undefined ? ` corps ${JSON.stringify(corps)}` : ''
  return assainir(`${methode} ${chemin.split('?')[0]}${chemin.includes('?') ? '?…' : ''}${envoye} → ${statut}${message === '' ? ' (sans message)' : ` ${message}`}`, 500)
}

export function creerEmetteur(deps: DependancesReseau): (ordre: Action) => Promise<ResultatAction> {
  const appel = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  return async (ordre) => {
    const entree: EntreeContrat | undefined = deps.table[ordre.type]
    if (entree === undefined) return NON_DISPONIBLE

    // Validation sans toucher à la session : chemin, corps et origine d'abord.
    let chemin: string
    try {
      chemin = entree.construireChemin(ordre)
      const essai = entree.construireCorps(ordre, { idJoueur: '', couleurEtiquette: COULEUR_ETIQUETTE })
      if (essai === null && entree.methode !== 'DELETE' && entree.methode !== 'GET' && entree.sansCorps !== true) return NON_DISPONIBLE
    } catch {
      return NON_DISPONIBLE
    }
    const siteSeul = entree.hote === 'site'
    // Hôte du site : même origine que l’onglet, cookies du navigateur, ni jeton ni clé d’API.
    if (siteSeul && deps.origineOnglet !== ORIGINE_SITE) return NON_DISPONIBLE
    const url = `${siteSeul ? ORIGINE_SITE : ORIGINE_REST}${chemin}`
    if (!siteSeul && entree.auth && enteteAuthentification(url, deps.origineOnglet, 'Authorization', () => 'x') === null) {
      return { classe: 'arret', codeHttp: null, cause: 'jeton-absent' }
    }

    // Seule lecture du jeton : juste avant l'envoi, et seulement si l'entrée l'exige.
    const session = entree.auth ? (deps.session ?? sessionCourante)() : null
    if (entree.auth && session === null) return { classe: 'arret', codeHttp: null, cause: 'jeton-absent' }
    const corps = entree.construireCorps(ordre, { idJoueur: session?.idJoueur ?? '', couleurEtiquette: COULEUR_ETIQUETTE })
    const jeton = entree.auth && session
      ? enteteAuthentification(url, deps.origineOnglet, 'Authorization', () => `Bearer ${session.jeton}`)
      : null

    const entetes: Record<string, string> = siteSeul
      ? corps !== null ? { 'Content-Type': 'application/json' } : {}
      : {
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
        credentials: siteSeul ? 'same-origin' : 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: controle.signal,
      })
      const { json, texte } = await lireCorps(reponse)
      const diagnostic = reponse.status < 200 || reponse.status > 299 ? diagnosticDeRefus(entree.methode, chemin, ordre.type, corps, reponse.status, json, texte, session?.jeton ?? '') : null
      if (CODES_ARRET.includes(reponse.status)) {
        return { classe: 'echec', codeHttp: reponse.status, cause: 'action non disponible', ...(diagnostic ? { diagnostic } : {}) }
      }
      if (siteSeul && reponse.status === 409) {
        return { classe: 'echec', codeHttp: 409, cause: classerConflit(json), ...(diagnostic ? { diagnostic } : {}) }
      }
      if (reponse.status < 200 || reponse.status > 299) {
        return { classe: 'echec', codeHttp: reponse.status, cause: 'erreur d’émission', ...(diagnostic ? { diagnostic } : {}) }
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
