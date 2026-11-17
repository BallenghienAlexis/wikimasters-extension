// Ligne de base : la déduction de production telle quelle, à partir du titre et de la description seuls (aucun cache Wikipédia).
// Lecture seule : ce fichier importe la logique de production, il ne la modifie pas.
import { themesPrincipaux } from '../../src/lib/themes';
import type { FonctionDeduction } from './types';

export const deductionProduction: FonctionDeduction = ({ titre, description }) => themesPrincipaux({ titre, description });
