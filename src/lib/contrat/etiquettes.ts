import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'

/** Entrées du contrat pour les étiquettes. Vide tant que le relevé n’est pas écrit (G5). */
export const ENTREES_ETIQUETTES: Partial<Record<TypeAction, EntreeContrat>> = {}
