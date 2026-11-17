// Thèmes choisis à la main par le joueur (Alexis, 2026-11-17) : validation pure, sans dépendance au reste de la logique.
// Même contrat que les étiquettes automatiques : 1 à 4 thèmes du catalogue fermé, jamais « autres » ni « à classer ».

export const MAX_THEMES_CHOISIS = 4;

/** Identifiants autorisés, injectés par `themes.ts` (évite une dépendance circulaire avec le catalogue). */
let autorises: ReadonlySet<string> | null = null;

export function definirThemesAutorises(ids: readonly string[]): void {
  autorises = new Set(ids);
}

/** Format seul (1 à 4 identifiants distincts, jamais « autres ») : le catalogue peut évoluer, le stockage ne doit pas devenir illisible. */
export function formatThemesChoisisValide(v: unknown): v is string[] {
  return Array.isArray(v) && v.length >= 1 && v.length <= MAX_THEMES_CHOISIS && v.every((id) => typeof id === 'string' && id !== '' && id !== 'autres') && new Set(v).size === v.length;
}

/** Retire les identifiants que le catalogue ne connaît plus ; null si plus rien. */
export function filtrerThemesChoisis(v: readonly string[]): string[] | null {
  const restants = autorises === null ? [...v] : v.filter((id) => autorises!.has(id));
  return restants.length > 0 ? restants : null;
}

/** Vrai pour une liste de 1 à 4 identifiants distincts du catalogue ; sans catalogue connu, seul le format est contrôlé. */
export function themesChoisisValides(v: unknown): v is string[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_THEMES_CHOISIS) return false;
  if (!v.every((id) => typeof id === 'string' && id !== '' && id !== 'autres')) return false;
  if (new Set(v).size !== v.length) return false;
  return autorises === null || v.every((id) => autorises!.has(id as string));
}
