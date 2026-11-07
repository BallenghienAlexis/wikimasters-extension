import type { EntreeContrat } from '../contrat'
import type { TypeAction } from '../actions'

/** Entrées du contrat pour la lecture. Vide tant que le relevé n’est pas écrit (G5). */
export const ENTREES_LECTURE: Partial<Record<TypeAction, EntreeContrat>> = {}
