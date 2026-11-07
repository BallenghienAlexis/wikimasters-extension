// Suivi des pages de la collection déjà lues : le joueur voit où il en est et quelle page il manque.

export interface Synchro {
  // Un tri ou un filtre différent change le contenu des pages : le suivi repart de zéro.
  cle: string;
  total: number;
  pages: number[];
}

export interface Pagination {
  page: number;
  total: number;
}

export function analyserPagination(texte: string): Pagination | null {
  const trouve = /^Page (\d+) \/ (\d+)$/.exec(texte.trim());
  if (!trouve) return null;
  const page = Number(trouve[1]);
  const total = Number(trouve[2]);
  return page >= 1 && page <= total ? { page, total } : null;
}

export function noterPage(synchro: Synchro | null, cle: string, { page, total }: Pagination): Synchro {
  const pages = synchro && synchro.cle === cle && synchro.total === total ? synchro.pages : [];
  return { cle, total, pages: pages.includes(page) ? pages : [...pages, page].sort((a, b) => a - b) };
}

export interface Progression {
  lues: number;
  total: number;
  prochaine: number | null;
}

export function progression({ pages, total }: Synchro): Progression {
  let prochaine: number | null = null;
  for (let page = 1; page <= total && prochaine === null; page += 1) {
    if (!pages.includes(page)) prochaine = page;
  }
  return { lues: pages.length, total, prochaine };
}

export const texteProgression = ({ lues, total, prochaine }: Progression): string =>
  prochaine === null
    ? `Collection entière lue : ${total} pages sur ${total}.`
    : `${lues} ${lues > 1 ? 'pages lues' : 'page lue'} sur ${total}. Prochaine page à ouvrir : ${prochaine}.`;

export function lireSynchro(brut: unknown): Synchro | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const { cle, total, pages } = brut as Partial<Synchro>;
  if (typeof cle !== 'string' || !Number.isSafeInteger(total) || !Array.isArray(pages) || !pages.every(Number.isSafeInteger)) return null;
  return { cle, total: total as number, pages };
}
