import React, { useMemo, useState } from 'react'
import type { Registre } from '../lib/actions'
import type { Carte } from '../lib/collection'
import { trierEtiquettes, trierEtiquettesSite, type EtiquetteSite } from '../lib/etiquettesPreexistantes'
import type { Ami } from '../lib/tri'

interface Props {
  cartes: readonly Carte[]
  registre: Registre
  amis?: readonly Ami[]
  /** Liste complète des étiquettes du compte (lue par la synchronisation), ou `null` si pas encore lue. */
  site?: readonly EtiquetteSite[] | null
  /** Lance la suppression sur le site ; appelé seulement après la confirmation explicite du joueur. */
  onSupprimer?: (etiquettes: Array<{ id: string; nom: string }>) => void
  /** Une exécution ou une synchronisation est en cours : la suppression est bloquée. */
  occupe?: boolean
}

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`
const BOUTON = 'inline-flex min-h-11 cursor-pointer items-center justify-center rounded border px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Étiquettes du compte qui ne viennent pas de l’extension. Rien n’est supprimé sans deux étapes : cocher les
 * étiquettes une à une, puis confirmer la liste exacte. La suppression est définitive sur le site.
 */
const EtiquettesPreexistantes: React.FC<Props> = ({ cartes, registre, amis, site = null, onSupprimer, occupe = false }) => {
  const [cochees, setCochees] = useState<ReadonlySet<string>>(new Set())
  const [confirmation, setConfirmation] = useState(false)
  const config = useMemo(() => ({ amis, limiteParExemplaire: null }), [amis])
  const triSite = useMemo(() => (site === null ? null : trierEtiquettesSite(site, cartes, registre, config)), [site, cartes, registre, config])
  const triCartes = useMemo(() => trierEtiquettes(cartes, registre, config), [cartes, registre, config])

  const preexistantes = triSite === null ? [] : triSite.filter((e) => e.origine === 'preexistante')
  const nbExtension = triSite === null ? triCartes.extension.length : triSite.length - preexistantes.length
  const choisies = preexistantes.filter((e) => cochees.has(e.id))

  const basculer = (id: string): void => {
    setConfirmation(false)
    setCochees((avant) => {
      const apres = new Set(avant)
      if (!apres.delete(id)) apres.add(id)
      return apres
    })
  }

  return (
    <section aria-labelledby="titre-preexistantes" className="rounded border border-line p-4">
      <h2 id="titre-preexistantes" className="text-lg font-semibold">Étiquettes préexistantes</h2>
      {triSite === null ? (
        <>
          <p className="text-sm text-muted">
            La liste complète des étiquettes du compte n’est pas encore lue : elle arrive avec la prochaine synchronisation.
            D’après les cartes lues, {pluriel(triCartes.preexistantes.length, 'étiquette ne vient', 'étiquettes ne viennent')} pas de l’extension.
          </p>
          {triCartes.preexistantes.length > 0 && (
            <ul className="mt-2 text-sm">
              {triCartes.preexistantes.map((e) => (
                <li key={e.nom}>{e.nom} · {pluriel(e.nbCartes, 'carte', 'cartes')}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            {pluriel(preexistantes.length, 'étiquette ne vient', 'étiquettes ne viennent')} pas de l’extension ({nbExtension} de l’extension).
            Cochez celles à supprimer du site : la suppression est définitive et les retire aussi des cartes qui les portent.
          </p>
          {preexistantes.length > 0 && (
            <ul className="mt-2 text-sm">
              {preexistantes.map((e) => (
                <li key={e.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={cochees.has(e.id)} onChange={() => basculer(e.id)} disabled={occupe} />
                    <span>{e.nom} · {pluriel(e.nbCartes, 'carte', 'cartes')}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {onSupprimer && !confirmation && (
            <button type="button" className={`${BOUTON} mt-2 border-line`} disabled={choisies.length === 0 || occupe} onClick={() => setConfirmation(true)}>
              Supprimer {pluriel(choisies.length, 'étiquette', 'étiquettes')} du site…
            </button>
          )}
          {onSupprimer && confirmation && (
            <div role="alertdialog" aria-labelledby="titre-confirmation-suppression" className="mt-2 rounded border border-line p-3">
              <p id="titre-confirmation-suppression" className="font-semibold">
                Supprimer définitivement {pluriel(choisies.length, 'étiquette', 'étiquettes')} du site ?
              </p>
              <ul className="my-2 text-sm">
                {choisies.map((e) => (
                  <li key={e.id}>{e.nom}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" className={`${BOUTON} border-line`} onClick={() => setConfirmation(false)}>Annuler</button>
                <button
                  type="button"
                  className={`${BOUTON} border-line`}
                  disabled={choisies.length === 0 || occupe}
                  onClick={() => {
                    setConfirmation(false)
                    setCochees(new Set())
                    onSupprimer(choisies.map((e) => ({ id: e.id, nom: e.nom })))
                  }}
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default EtiquettesPreexistantes
