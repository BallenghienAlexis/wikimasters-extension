import React, { useState } from 'react';
import { CLASSE_BOUTON } from './outilsReglages';
import { LIBELLES_THEMES, IDS_THEMES, THEME_AUTRES } from '../lib/themes';
import { erreurDeNom, fusionner, renommer, retablir, supprimer, SEUIL_CARTES_APPRIS, type EtatAppris } from '../lib/themesAppris';

interface Props {
  etat: EtatAppris;
  onChange: (etat: EtatAppris) => void;
}

const CLASSE_CHAMP = 'min-h-11 rounded border border-line bg-ink px-3';
const maintenant = (): number => Date.now();
const HEURE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Thèmes appris des catégories Wikipédia (Alexis, 2026-11-17) : posés automatiquement dès que le seuil de cartes est atteint,
 * avec leur famille. Le joueur peut les renommer, les fusionner dans un autre thème ou les supprimer ; le journal garde la trace.
 */
const ThemesAppris: React.FC<Props> = ({ etat, onChange }) => {
  const [noms, setNoms] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<{ id: string; texte: string } | null>(null);
  const actifs = etat.themes.filter((t) => t.etat === 'actif');
  const ecartes = etat.themes.filter((t) => t.etat !== 'actif');
  return (
    <div className="py-2">
      <p className="text-sm">
        Une catégorie Wikipédia qui revient sur au moins {SEUIL_CARTES_APPRIS} cartes sans correspondre à un thème du catalogue devient un thème,
        rangé dans la famille la plus fréquente de ces cartes. Ces thèmes sont posés comme les autres (4 au plus par carte).
      </p>
      {actifs.length === 0 && <p className="mt-3 text-muted">Aucun thème appris pour l’instant : ils naissent au fil de la lecture de Wikipédia.</p>}
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {actifs.map((t) => {
          const famille = t.parents[0];
          return (
            <li key={t.id} className="py-2">
              <p className="font-medium break-words">
                {t.libelle} <span className="font-normal text-muted">· {t.cartes} cartes · {famille === undefined ? 'famille à part' : `famille ${LIBELLES_THEMES[famille] ?? famille}`}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  aria-label={`Nouveau nom de ${t.libelle}`}
                  placeholder="Nouveau nom"
                  maxLength={40}
                  className={CLASSE_CHAMP}
                  value={noms[t.id] ?? ''}
                  onChange={(e) => setNoms({ ...noms, [t.id]: e.target.value })}
                />
                <button
                  type="button"
                  className={CLASSE_BOUTON}
                  onClick={() => {
                    const nom = noms[t.id] ?? '';
                    const e = erreurDeNom(nom, etat, t.id);
                    if (e !== null) return setErreur({ id: t.id, texte: e });
                    setErreur(null);
                    setNoms({ ...noms, [t.id]: '' });
                    onChange(renommer(etat, t.id, nom, maintenant()));
                  }}
                >
                  Renommer
                </button>
                <label className="inline-flex items-center gap-2">
                  <span className="sr-only">Fusionner {t.libelle} dans</span>
                  <select
                    aria-label={`Fusionner ${t.libelle} dans`}
                    className={CLASSE_CHAMP}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) onChange(fusionner(etat, t.id, e.target.value, maintenant()));
                    }}
                  >
                    <option value="">Fusionner dans…</option>
                    {IDS_THEMES.filter((id) => id !== t.id && id !== THEME_AUTRES).map((id) => (
                      <option key={id} value={id}>{LIBELLES_THEMES[id] ?? id}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className={CLASSE_BOUTON} onClick={() => onChange(supprimer(etat, t.id, maintenant()))}>Supprimer</button>
              </div>
              {erreur?.id === t.id && <p role="alert" className="mt-1 text-sm">{erreur.texte}</p>}
            </li>
          );
        })}
      </ul>
      {ecartes.length > 0 && (
        <div className="mt-3">
          <h4 className="font-medium">Supprimés ou fusionnés</h4>
          <ul>
            {ecartes.map((t) => (
              <li key={t.id} className="flex min-h-11 flex-wrap items-center gap-2">
                <span className="break-words">
                  {t.libelle} <span className="text-muted">· {t.etat === 'fusionne' ? `fusionné dans ${LIBELLES_THEMES[t.fusionneVers ?? ''] ?? 'un autre thème'}` : 'supprimé'}</span>
                </span>
                <button type="button" className={CLASSE_BOUTON} onClick={() => onChange(retablir(etat, t.id, maintenant()))}>Rétablir</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {etat.journal.length > 0 && (
        <div className="mt-3">
          <h4 className="font-medium">Journal</h4>
          <ul className="max-h-60 overflow-y-auto text-sm">
            {[...etat.journal].reverse().map((j, i) => (
              <li key={`${j.le}-${i}`}>
                <span className="text-muted">{HEURE.format(j.le)}</span> · {j.texte}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ThemesAppris;
