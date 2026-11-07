import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'

/** Entrées du contrat pour l’enchère. Vide tant que le relevé n’est pas écrit (G5). */
export const ENTREES_ENCHERE: Partial<Record<TypeAction, EntreeContrat>> = {}
