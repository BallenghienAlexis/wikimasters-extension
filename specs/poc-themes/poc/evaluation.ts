// POC thèmes — mesures. « Faux thème » = thème posé qui n'est ni attendu, ni toléré, ni un ancêtre d'un thème attendu.
import { ancetres } from './signaux';
import type { CarteTest } from './types';

export interface Mesure {
  methode: string;
  cartes: number;
  /** Thèmes posés / attendus / posés exacts. */
  poses: number;
  attendus: number;
  exacts: number;
  /** Thèmes posés trop généraux (ancêtres d'un attendu) : pas faux mais pas précis. */
  generaux: number;
  faux: number;
  cartesAvecFaux: number;
  cartesSansTheme: number;
  /** Cartes dont l'attendu est vide et qui restent bien sans thème. */
  abstentionsCorrectes: number;
  cartesSansThemeAttendu: number;
  precision: number;
  rappel: number;
  tauxFaux: number;
}

export function mesurer(methode: string, cartes: readonly CarteTest[], predire: (c: CarteTest) => string[]): Mesure {
  const m: Mesure = { methode, cartes: cartes.length, poses: 0, attendus: 0, exacts: 0, generaux: 0, faux: 0, cartesAvecFaux: 0, cartesSansTheme: 0, abstentionsCorrectes: 0, cartesSansThemeAttendu: 0, precision: 0, rappel: 0, tauxFaux: 0 };
  for (const c of cartes) {
    const pred = predire(c);
    const attendu = new Set(c.attendu);
    const tolere = new Set([...(c.toleres ?? []), ...c.attendu.flatMap((id) => [...ancetres(id)])]);
    m.attendus += attendu.size;
    m.poses += pred.length;
    let fauxCarte = 0;
    for (const id of pred) {
      if (attendu.has(id)) m.exacts++;
      else if (tolere.has(id)) m.generaux++;
      else fauxCarte++;
    }
    m.faux += fauxCarte;
    if (fauxCarte > 0) m.cartesAvecFaux++;
    if (pred.length === 0) m.cartesSansTheme++;
    if (attendu.size === 0) {
      m.cartesSansThemeAttendu++;
      if (pred.length === 0) m.abstentionsCorrectes++;
    }
  }
  m.precision = m.poses === 0 ? 1 : m.exacts / m.poses;
  m.rappel = m.attendus === 0 ? 1 : m.exacts / m.attendus;
  m.tauxFaux = m.poses === 0 ? 0 : m.faux / m.poses;
  return m;
}

const pct = (x: number): string => `${(x * 100).toFixed(0)} %`;

export function tableau(mesures: readonly Mesure[]): string {
  const lignes = ['| Méthode | Précision | Rappel | Faux thèmes / posés | Cartes avec faux thème | Sans thème | Abstentions correctes |', '|---|---|---|---|---|---|---|'];
  for (const x of mesures) {
    lignes.push(`| ${x.methode} | ${pct(x.precision)} | ${pct(x.rappel)} | ${x.faux} / ${x.poses} (${pct(x.tauxFaux)}) | ${x.cartesAvecFaux} / ${x.cartes} | ${x.cartesSansTheme} / ${x.cartes} | ${x.abstentionsCorrectes} / ${x.cartesSansThemeAttendu} |`);
  }
  return lignes.join('\n');
}
