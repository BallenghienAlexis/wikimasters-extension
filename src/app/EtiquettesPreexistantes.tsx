import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Registre } from '../lib/actions'
import type { Carte } from '../lib/collection'
import {
  aSupprimer,
  annulerConfirmation,
  basculerSelection,
  demanderConfirmation,
  selectionVide,
  trierEtiquettes,
  trierEtiquettesSite,
  type EtiquetteSite,
} from '../lib/etiquettesPreexistantes'
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
const Contenu: React.FC<Props> = ({ cartes, registre, amis, site = null, onSupprimer, occupe = false }) => {
  const [selection, setSelection] = useState(selectionVide)
  const annuler = useRef<HTMLButtonElement>(null)
  const config = useMemo(() => ({ amis, limiteParExemplaire: null }), [amis])
  const triSite = useMemo(() => (site === null ? null : trierEtiquettesSite(site, cartes, registre, config)), [site, cartes, registre, config])
  const triCartes = useMemo(() => trierEtiquettes(cartes, registre, config), [cartes, registre, config])

  const preexistantes = useMemo(() => (triSite === null ? [] : triSite.filter((e) => e.origine === 'preexistante')), [triSite])
  const nbExtension = triSite === null ? triCartes.extension.length : triSite.length - preexistantes.length
  const supprimables = useMemo(() => new Set(preexistantes.map((e) => e.id)), [preexistantes])
  const choisies = preexistantes.filter((e) => selection.cochees.has(e.id))
  const confirmation = selection.confirmation

  // Le focus passe sur « Annuler » à l’ouverture de la confirmation (navigation au clavier).
  useEffect(() => {
    if (confirmation) annuler.current?.focus()
  }, [confirmation])

  const basculer = (id: string): void => setSelection((s) => basculerSelection(s, id))

  return (
    <>
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
                    <input type="checkbox" checked={selection.cochees.has(e.id)} onChange={() => basculer(e.id)} disabled={occupe} />
                    <span>{e.nom} · {pluriel(e.nbCartes, 'carte', 'cartes')}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {onSupprimer && !confirmation && (
            <button type="button" className={`${BOUTON} mt-2 border-line`} disabled={choisies.length === 0 || occupe} onClick={() => setSelection((s) => demanderConfirmation(s, supprimables))}>
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
                <button type="button" ref={annuler} className={`${BOUTON} border-line`} onClick={() => setSelection(annulerConfirmation)}>Annuler</button>
                <button
                  type="button"
                  className={`${BOUTON} border-line`}
                  disabled={choisies.length === 0 || occupe}
                  onClick={() => {
                    const ids = new Set(aSupprimer(selection, supprimables, occupe))
                    setSelection(selectionVide())
                    if (ids.size > 0) onSupprimer(preexistantes.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, nom: e.nom })))
                  }}
                >
                  Confirmer la suppression
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

/** Dépliée à la demande : le tri (toutes les cartes) n’est calculé qu’à l’ouverture, pour ne pas ralentir la page. */
const EtiquettesPreexistantes: React.FC<Props> = (props) => {
  const [ouverte, setOuverte] = useState(false)
  return (
    <details
      className="rounded border border-line p-4"
      onToggle={(e) => setOuverte((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary id="titre-preexistantes" className="cursor-pointer text-lg font-semibold">Étiquettes préexistantes</summary>
      {ouverte && <Contenu {...props} />}
    </details>
  )
}

export default EtiquettesPreexistantes
