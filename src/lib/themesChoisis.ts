// Thèmes choisis à la main par le joueur (Alexis, 2026-11-17) : validation pure, sans dépendance au reste de la logique.
// Même contrat que les étiquettes automatiques : 1 à 4 thèmes du catalogue fermé, jamais « autres » ni « à classer ».

export const MAX_THEMES_CHOISIS = 4;

/** Identifiants autorisés, injectés par `themes.ts` (évite une dépendance circulaire avec le catalogue). */
let autorises: ReadonlySet<string> | null = null;

export function definirThemesAutorises(ids: readonly string[]): void {
  autorises = new Set(ids);
}

/** Vrai pour une liste de 1 à 4 identifiants distincts du catalogue ; sans catalogue connu, seul le format est contrôlé. */
export function themesChoisisValides(v: unknown): v is string[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_THEMES_CHOISIS) return false;
  if (!v.every((id) => typeof id === 'string' && id !== '' && id !== 'autres')) return false;
  if (new Set(v).size !== v.length) return false;
  return autorises === null || v.every((id) => autorises!.has(id as string));
}
