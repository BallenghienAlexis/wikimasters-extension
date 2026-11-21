/**
 * Émission réelle des requêtes d’écriture vers l’hôte REST du site (spec synchro-complete).
 *
 * Seul module, avec `jeton.ts` en amont, à envoyer le jeton de session : lu en mémoire à chaque
 * requête, jamais gardé, journalisé ni renvoyé. Aucun résultat ne contient de corps de réponse :
 * seuls une classe, un code HTTP, un libellé fixe et, pour une création, l’identifiant validé.
 * Le délai variable est tiré par l’appelant, sauf entre la relecture de la tendance et l’enchère (`gigueAleatoire`, injectable).
 */
import { CAUSE_VERIFICATION_HUMAINE, CODE_VERIFICATION_HUMAINE, type Action, type ResultatAction } from './actions'
import type { EntreeContrat, TableContrat } from './contrat'
import { enteteAuthentification, sessionCourante, type SessionLue } from './jeton'
import { analyserPrix, analyserTendance, type TendancePrix } from './lectureApi'
import { prixDepartSelonTendance } from './prixTendance'
import { prixDepartAjuste } from './ventes'
import { INTERVALLE_MS } from './file'
import { gigueAleatoire } from './gigue'
import { COULEUR_ETIQUETTE, CLE_PUBLIQUE, DELAI_REQUETE_MS, ORIGINE_REST, ORIGINE_SITE } from '../config/synchro'

export interface DependancesReseau {
  table: TableContrat
  /** Origine de l’onglet qui émet (`location.origin`). */
  origineOnglet: string
  /** Session courante, relue à chaque requête (par défaut : cookie du site). */
  session?: () => SessionLue | null
  fetchImpl?: typeof fetch
  /** Attente (injectée pour les tests) et délai variable entre la relecture de la tendance et l’envoi. */
  attendre?: (ms: number) => Promise<void>
  gigue?: () => number
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

/** Le site demande une vérification humaine : champ `code` de la réponse JSON, à défaut le texte brut. */
export function verificationHumaine(json: unknown, texte: string): boolean {
  if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
    const c = (json as Record<string, unknown>).code
    if (typeof c === 'string') return c === CODE_VERIFICATION_HUMAINE
  }
  return texte.includes(CODE_VERIFICATION_HUMAINE)
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
  const attendre = deps.attendre ?? ((ms: number) => new Promise<void>((fin) => setTimeout(fin, ms)))
  const gigue = deps.gigue ?? gigueAleatoire

  /**
   * Tendance relue juste avant une mise en vente (Alexis, 2026-11-21) : une lecture `GET .../price-history`, même origine,
   * cookies du navigateur, aucun en-tête, aucun jeton. Renvoie la tendance, ou le résultat à rendre à la place de l’envoi :
   * `passee` (prix du marché introuvable ou illisible : on ne met pas en vente à l’aveugle), ou `echec`/`arret` pour les
   * mêmes codes que toute requête (401, 403, 429 ; anti-bot jamais contourné).
   */
  async function relireTendance(idCarteSite: string, rarete: string): Promise<{ valeur: number; tendance: TendancePrix | null } | ResultatAction> {
    if (deps.origineOnglet !== ORIGINE_SITE) return NON_DISPONIBLE
    const chemin = `/api/marketplace/cards/${encodeURIComponent(idCarteSite)}/price-history`
    const controle = new AbortController()
    const minuteur = setTimeout(() => controle.abort(), DELAI_REQUETE_MS)
    try {
      const reponse = await appel(`${ORIGINE_SITE}${chemin}`, { method: 'GET', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controle.signal })
      const { json, texte } = await lireCorps(reponse)
      if (reponse.status === 403 && verificationHumaine(json, texte)) return { classe: 'echec', codeHttp: 403, cause: CAUSE_VERIFICATION_HUMAINE }
      if (reponse.status === 401 || reponse.status === 429) return { classe: 'echec', codeHttp: reponse.status, cause: 'action non disponible' }
      if (reponse.status !== 200) return { classe: 'passee', codeHttp: reponse.status, cause: 'prix du marché indisponible' }
      const maintenant = Date.now()
      const valeur = analyserPrix(json, rarete, maintenant)
      if (valeur === null) return { classe: 'passee', codeHttp: 200, cause: 'aucune vente récente : prix du marché inconnu' }
      return { valeur, tendance: analyserTendance(json, rarete, maintenant) }
    } catch (e) {
      const delai = e instanceof Error && e.name === 'AbortError'
      // Aucune enchère n'est partie : un échec ordinaire (« Réessayer » reste possible), pas un résultat inconnu.
      return { classe: 'echec', codeHttp: null, cause: delai ? 'délai dépassé' : 'erreur réseau' }
    } finally {
      clearTimeout(minuteur)
    }
  }

  const emettreBrut = async (ordre: Action): Promise<ResultatAction> => {
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
      // Vérification anti-bot du site (Alexis, 2026-11-15) : 403 + code `human_verification_required`. Ni exemplaire
      // indisponible ni quota : on le signale tel quel, sans tenter de la franchir.
      if (reponse.status === 403 && verificationHumaine(json, texte)) {
        return { classe: 'echec', codeHttp: 403, cause: CAUSE_VERIFICATION_HUMAINE, ...(diagnostic ? { diagnostic } : {}) }
      }
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
      const ventes = entree.lireVentes?.(json) ?? null
      return { classe: 'reussie', codeHttp: reponse.status, cause: 'action réussie', ...(id !== null ? { idEtiquette: id } : {}), ...(ventes !== null ? { ventes } : {}) }
    } catch (e) {
      const delai = e instanceof Error && e.name === 'AbortError'
      return { classe: 'inconnu', codeHttp: null, cause: delai ? 'délai dépassé' : 'erreur réseau' }
    } finally {
      clearTimeout(minuteur)
    }
  }

  return async (ordre) => {
    if (ordre.type !== 'enchere' || ordre.prixFixe === true || ordre.idCarteSite === undefined || ordre.rarete === undefined) return emettreBrut(ordre)
    const lue = await relireTendance(ordre.idCarteSite, ordre.rarete)
    if ('classe' in lue) return lue
    const depart = prixDepartSelonTendance(lue.valeur, lue.tendance)
    if (depart === null) return { classe: 'passee', codeHttp: null, cause: 'prix du marché trop bas pour une mise en vente' }
    const prix = prixDepartAjuste(depart.prix, ordre.reductions ?? 0)
    // Cadence : 0,2 s plus gigue entre la lecture et l’envoi, comme entre deux requêtes quelconques.
    await attendre(INTERVALLE_MS + gigue())
    const debutEnvoi = Date.now()
    const resultat = await emettreBrut({ ...ordre, prix })
    // La file et le verrou ne voient que l'ordre entier : l'écart de 0,2 s plus gigue après le vrai départ de l'enchère est garanti ici.
    const reste = debutEnvoi + INTERVALLE_MS + gigue() - Date.now()
    if (reste > 0) await attendre(reste)
    return resultat.classe === 'reussie' ? { ...resultat, prix } : resultat
  }
}

