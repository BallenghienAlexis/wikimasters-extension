import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ID_CARTE_ETIQUETTES } from '../lib/actions';
import type { Collection } from '../lib/collection';
import { retirerIgnoree, type Ignoree } from '../lib/ignorees';
import { basculerTri, trierLignes, type SensTri, type ValeurTri } from '../lib/ordreTableau';
import { chargerIgnorees, ecouterIgnorees, enregistrerIgnorees } from '../lib/stockage';
import EnTeteTriable from './EnTeteTriable';
import { libelleType } from './Journal';

interface Props {
  collection: Collection;
}

type Cle = 'action' | 'carte' | 'jusqua';
const COLONNES: { cle: Cle; libelle: string }[] = [
  { cle: 'action', libelle: 'Action' },
  { cle: 'carte', libelle: 'Carte' },
  { cle: 'jusqua', libelle: 'Jusqu’à' },
];

const JOURS_30 = 30 * 86_400_000;
const CLASSE_REPRENDRE =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border border-muted bg-ink px-4 text-paper hover:bg-line active:bg-line focus-visible:shadow-(--halo-focus)';

const dateFr = (ms: number): string => {
  const d = new Date(ms);
  const deux = (n: number): string => String(n).padStart(2, '0');
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Ignorées (D-31, D-32) : section repliable, tableau triable, « Reprendre » sans aucune requête. */
const TableIgnorees: React.FC<Props> = ({ collection }) => {
  const [liste, setListe] = useState<Ignoree[]>([]);
  const [illisible, setIllisible] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tri, setTri] = useState<{ cle: Cle | null; sens: SensTri }>({ cle: null, sens: null });
  const precedent = useRef<number | null>(null);
  const idContenu = `ignorees-contenu${useId()}`;

  useEffect(() => {
    let actif = true;
    const lire = (): void => {
      chargerIgnorees()
        .then((l) => {
          if (!actif) return;
          // Juste après un « Ignorer » (la liste grandit après la première lecture), la section s’ouvre (D-32).
          if (precedent.current !== null && l.length > precedent.current) setOuvert(true);
          precedent.current = l.length;
          setListe(l);
          setIllisible(false);
        })
        .catch(() => {
          if (actif) setIllisible(true);
        });
    };
    lire();
    const arreter = ecouterIgnorees(lire);
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  const titres = useMemo(() => new Map(collection.cartes.map((c) => [c.id, c.titre])), [collection.cartes]);
  const carteDe = (i: Ignoree): string => {
    if (i.idCarte === ID_CARTE_ETIQUETTES) return 'Étiquettes du compte';
    const titre = titres.get(i.idCarte);
    if (titre !== undefined) return titre;
    const pos = i.idCarte.indexOf('|');
    return pos < 0 ? i.idCarte : i.idCarte.slice(pos + 1);
  };
  const actionDe = (i: Ignoree): string => {
    if (i.parametre === null) return libelleType(i.type);
    return `${libelleType(i.type)} ${i.type === 'enchere' ? `à ${i.parametre}` : i.parametre}`;
  };
  const valeur: Record<Cle, (i: Ignoree) => ValeurTri> = {
    action: actionDe,
    carte: carteDe,
    jusqua: (i) => i.date,
  };
  const lignes = tri.cle === null ? liste : trierLignes(liste, valeur[tri.cle], tri.sens);
  const basculer = (cle: Cle): void =>
    setTri((t) => {
      if (t.cle !== cle) return { cle, sens: 'croissant' };
      const sens = basculerTri(t.sens);
      return { cle: sens === null ? null : cle, sens };
    });
  const etat = (cle: Cle): SensTri => (tri.cle === cle ? tri.sens : null);

  const reprendre = (i: Ignoree): void => {
    setErreur(null);
    // Relecture juste avant l’écriture : une liste modifiée ailleurs ne doit pas être écrasée, une liste corrompue n’est jamais réécrite.
    chargerIgnorees()
      .then(
        (courante) => enregistrerIgnorees(retirerIgnoree(courante, i)).then(() => setListe(retirerIgnoree(courante, i))),
        () => {
          setIllisible(true);
        },
      )
      .catch(() => setErreur('Écriture impossible : l’action n’a pas été reprise.'));
  };
  const jusqua = (i: Ignoree): string => `prochaine synchro (au plus tard le ${dateFr(i.date + JOURS_30)})`;
  const bouton = (i: Ignoree): React.ReactNode => (
    <button type="button" className={CLASSE_REPRENDRE} aria-label={`Reprendre « ${actionDe(i)} » pour « ${carteDe(i)} »`} onClick={() => reprendre(i)}>
      Reprendre
    </button>
  );
  const cle = (i: Ignoree): string => `${i.type}|${i.idCarte}|${i.parametre ?? ''}`;

  return (
    <section className="mt-4 rounded-xl border border-muted bg-ink-2" data-testid="ignorees">
      <h3>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idContenu}
          onClick={() => setOuvert((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left font-bold focus-visible:shadow-(--halo-focus)"
        >
          <span>Ignorées ({liste.length})</span>
          <span aria-hidden="true" className="wm-chevron" data-ouvert={ouvert}>
            ▼
          </span>
        </button>
      </h3>
      <div id={idContenu} hidden={!ouvert} className="px-3 pb-3">
        {illisible && <p className="text-defausser">La liste des ignorées est illisible.</p>}
        {erreur !== null && (
          <p role="alert" className="mb-2 font-semibold text-defausser">
            {erreur}
          </p>
        )}
        {!illisible && liste.length === 0 && <p className="text-muted">Aucune action ignorée</p>}
        {liste.length > 0 && (
          <>
            <div className="hidden overflow-x-auto min-[600px]:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {COLONNES.map((c) => (
                      <EnTeteTriable key={c.cle} colonne={c} etat={etat(c.cle)} onBasculer={() => basculer(c.cle)} />
                    ))}
                    <th scope="col" className="px-3 font-normal">
                      Reprendre
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((i) => (
                    <tr key={cle(i)} className="border-b border-line">
                      <td className="break-words px-3 py-2">{actionDe(i)}</td>
                      <td className="break-words px-3 py-2">{carteDe(i)}</td>
                      <td className="px-3 py-2">{jusqua(i)}</td>
                      <td className="px-3 py-1">{bouton(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="min-[600px]:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <span>Trier par</span>
                  <select
                    className="min-h-11 rounded border border-muted bg-ink px-3 text-paper focus-visible:shadow-(--halo-focus)"
                    value={tri.cle ?? ''}
                    onChange={(e) => {
                      const c = e.target.value as Cle | '';
                      setTri(c === '' ? { cle: null, sens: null } : { cle: c, sens: 'croissant' });
                    }}
                  >
                    <option value="">Ordre d’ajout</option>
                    {COLONNES.map((c) => (
                      <option key={c.cle} value={c.cle}>
                        {c.libelle}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ul className="mt-2 grid gap-2">
                {lignes.map((i) => (
                  <li key={cle(i)} className="grid gap-1 rounded border border-line bg-ink p-3 text-sm">
                    <span>
                      <span className="text-muted">Action&nbsp;: </span>
                      {actionDe(i)}
                    </span>
                    <span>
                      <span className="text-muted">Carte&nbsp;: </span>
                      {carteDe(i)}
                    </span>
                    <span>
                      <span className="text-muted">Jusqu’à&nbsp;: </span>
                      {jusqua(i)}
                    </span>
                    <span>{bouton(i)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default TableIgnorees;
