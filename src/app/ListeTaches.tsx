import React from 'react';
import type { EntreeJournal, FamilleLot } from '../lib/actions';
import type { ListesTaches, Tache } from '../lib/progression';
import { formaterHorodatage, libelleParametre, libelleResultat, libelleType } from './Journal';
import { LIBELLES_ETAPE } from './ProgressionSynchro';

interface Props {
  listes: ListesTaches;
}

const LIBELLES_FAMILLE: Record<FamilleLot, string> = {
  etiquettes: 'Étiquettes',
  encheres: 'Enchères',
  defausses: 'Défausses',
  suppressions: 'Suppressions',
  lectures: 'Lectures',
};

const libelleTache = (t: Tache): string =>
  t.genre === 'etape'
    ? LIBELLES_ETAPE[t.etape]
    : `${LIBELLES_FAMILLE[t.famille]}\u00a0: ${t.nombre} ${t.nombre > 1 ? 'actions' : 'action'}`;

const cleTache = (t: Tache): string => (t.genre === 'etape' ? `etape-${t.etape}` : `lot-${t.famille}`);

function libelleEntree(e: EntreeJournal): string {
  const parametre = libelleParametre(e);
  return `${formaterHorodatage(e.horodatage)} · ${libelleType(e.type)}${parametre ? ` ${parametre}` : ''} · ${e.titre} · ${libelleResultat(e.resultat)}`;
}

/** Listes En cours / À venir / Terminées (D-20) et lien vers l’historique (réservé à T-307). */
const ListeTaches: React.FC<Props> = ({ listes }) => {
  const defiler = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    const cible = document.getElementById('historique');
    cible?.scrollIntoView();
    cible?.focus();
  };
  return (
    <section aria-label="Tâches" className="mt-4 grid grid-cols-1 gap-4 rounded border border-line bg-ink-2 p-4">
      {listes.aucuneActivite ? (
        <p data-testid="aucune-activite" className="font-medium">
          Aucune activité en cours
        </p>
      ) : (
        <>
          <div>
            <h3 className="text-[15px] font-semibold">En cours</h3>
            <ul data-testid="liste-en-cours" className="mt-2 flex flex-col text-sm [&>li]:border-b [&>li]:border-line [&>li]:py-1.5">
              {listes.enCours.map((t) => (
                <li key={cleTache(t)}>{libelleTache(t)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold">À venir</h3>
            <ul data-testid="liste-a-venir" className="mt-2 flex flex-col text-sm [&>li]:border-b [&>li]:border-line [&>li]:py-1.5">
              {listes.aVenir.map((t) => (
                <li key={cleTache(t)}>{libelleTache(t)}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      <div>
        <h3 className="text-[15px] font-semibold">Terminées</h3>
        <ul data-testid="liste-terminees" className="mt-2 flex flex-col text-sm [&>li]:border-b [&>li]:border-line [&>li]:py-1.5">
          {listes.terminees.map((e) => (
            <li key={e.id} className="break-words">
              {libelleEntree(e)}
            </li>
          ))}
        </ul>
        <a href="#historique" onClick={defiler} className="mt-2 inline-flex min-h-11 items-center rounded px-2 underline focus-visible:shadow-(--halo-focus)">
          Voir l’historique complet
        </a>
      </div>
    </section>
  );
};

export default ListeTaches;
