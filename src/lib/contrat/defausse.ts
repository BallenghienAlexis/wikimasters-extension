import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'

/** Entrées du contrat pour la défausse. Vide tant que le relevé n’est pas écrit (G5). */
export const ENTREES_DEFAUSSE: Partial<Record<TypeAction, EntreeContrat>> = {}
