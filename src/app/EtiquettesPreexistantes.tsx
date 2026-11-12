import React, { useMemo } from 'react'
import type { Registre } from '../lib/actions'
import type { Carte } from '../lib/collection'
import { trierEtiquettes } from '../lib/etiquettesPreexistantes'
import type { Ami } from '../lib/tri'

interface Props {
  cartes: readonly Carte[]
  registre: Registre
  amis?: readonly Ami[]
}

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`

/**
 * Aperçu des étiquettes du site qui ne viennent pas de l’extension. Texte seul, aucune requête :
 * la suppression d’une étiquette sur le site n’est pas disponible (route non relevée).
 */
const EtiquettesPreexistantes: React.FC<Props> = ({ cartes, registre, amis }) => {
  const tri = useMemo(() => trierEtiquettes(cartes, registre, { amis, limiteParExemplaire: null }), [cartes, registre, amis])
  return (
    <section aria-labelledby="titre-preexistantes" className="rounded border border-line p-4">
      <h2 id="titre-preexistantes" className="text-lg font-semibold">Étiquettes préexistantes</h2>
      <p className="text-sm text-muted">
        {pluriel(tri.preexistantes.length, 'étiquette ne vient', 'étiquettes ne viennent')} pas de l’extension
        ({tri.extension.length} de l’extension). Aperçu seul : rien n’est supprimé sur le site.
      </p>
      {tri.preexistantes.length > 0 && (
        <ul className="mt-2 text-sm">
          {tri.preexistantes.map((e) => (
            <li key={e.nom}>{e.nom} · {pluriel(e.nbCartes, 'carte', 'cartes')}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default EtiquettesPreexistantes
