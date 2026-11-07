import React, { useRef, useState } from 'react';
import type { EntreeJournal, Registre, TypeAction } from '../lib/actions';
import { dernierePoseParCouple } from '../lib/journal';
import DialogueVider from './DialogueVider';

/** Nombre d’entrées affichées d’abord, puis ajoutées à chaque « Afficher 50 de plus » (D-31). */
export const PAS_AFFICHAGE = 50;

export interface CoupleRetrait {
  idCarte: string;
  nomEtiquette: string;
}

const LIBELLES_TYPE: Record<TypeAction, string> = {
  lecture: 'Lecture',
  'creation-etiquette': 'Création d’étiquette',
  'retrait-etiquette': 'Retrait d’étiquette',
  'pose-etiquette': 'Étiquette',
  enchere: 'Mettre aux enchères',
  defausse: 'Défausser',
};

const CLASSES_TYPE: Record<TypeAction, string> = {
  lecture: 'text-paper',
  'creation-etiquette': 'text-paper',
  'retrait-etiquette': 'text-echanger',
  'pose-etiquette': 'text-echanger',
  enchere: 'text-vendre',
  defausse: 'text-defausser',
};

const LIBELLES_RESULTAT: Record<EntreeJournal['resultat'], string> = {
  reussie: 'réussie',
  echouee: 'échouée',
  passee: 'passée',
  interrompue: 'interrompue',
  inconnu: 'résultat inconnu, à vérifier sur le site',
  'en-cours': 'en cours',
};

const CLASSES_RESULTAT: Record<EntreeJournal['resultat'], string> = {
  reussie: 'text-garder',
  echouee: 'text-defausser',
  passee: 'text-muted',
  interrompue: 'text-muted',
  inconnu: 'text-vendre',
  'en-cours': 'text-muted',
};

export const libelleType = (type: TypeAction): string => LIBELLES_TYPE[type];
export const libelleResultat = (resultat: EntreeJournal['resultat']): string => LIBELLES_RESULTAT[resultat];

/** Paramètre affiché : « à 50 » pour une enchère, le nom pour une étiquette. */
export function libelleParametre(e: EntreeJournal): string | null {
  if (e.parametre === null) return null;
  return e.type === 'enchere' ? `à ${e.parametre}` : e.parametre;
}

/** Rareté d’une carte : partie de l’identifiant `rareté|titre` avant la première barre. */
export function rareteDe(idCarte: string): string {
  const i = idCarte.indexOf('|');
  return i === -1 ? '' : idCarte.slice(0, i);
}

/** « 2026-11-07 14:02:11 », en heure locale. */
export function formaterHorodatage(iso: string): string {
  const d = new Date(iso);
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())} ${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}`;
}

/** Enchères et défausses réussies : non annulables par l’extension (SC-016). */
export const mentionNonAnnulable = (e: EntreeJournal): boolean =>
  e.resultat === 'reussie' && (e.type === 'enchere' || e.type === 'defausse');

/**
 * Entrées qui portent « Retirer l’étiquette » : la pose réussie la plus récente de chaque couple
 * (carte, étiquette) dont l’étiquette figure encore au registre. Le registre ne relie pas un
 * exemplaire à une carte : on vérifie que le nom y figure encore.
 */
export function entreesAvecRetrait(entrees: EntreeJournal[], registre: Registre): Map<string, CoupleRetrait> {
  const auRegistre = new Set(registre.couples.map((c) => c.nom));
  const sortie = new Map<string, CoupleRetrait>();
  for (const e of dernierePoseParCouple(entrees).values()) {
    if (e.parametre !== null && auRegistre.has(e.parametre)) {
      sortie.set(e.id, { idCarte: e.idCarte, nomEtiquette: e.parametre });
    }
  }
  return sortie;
}

/** Raison visible de la désactivation de « Retirer l’étiquette », ou `null` si possible. */
export function raisonRetrait(p: { retraitDisponible: boolean; ongletPret: boolean }): string | null {
  if (!p.ongletPret) return 'Aucun onglet WikiMasters ouvert.';
  if (!p.retraitDisponible) return 'Action non disponible.';
  return null;
}

/** Les plus récentes d’abord, limitées à `nombre`. */
export function entreesAffichees(entrees: EntreeJournal[], nombre: number): { visibles: EntreeJournal[]; restantes: number } {
  const recentes = [...entrees].reverse();
  return { visibles: recentes.slice(0, nombre), restantes: Math.max(0, recentes.length - nombre) };
}

const BOUTON = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-4';
const BOUTON_SECONDAIRE = `${BOUTON} cursor-pointer border-muted bg-ink text-paper hover:bg-line active:bg-line`;
const BOUTON_DESACTIVE = `${BOUTON} cursor-not-allowed border-dashed border-muted bg-ink text-muted`;

interface Props {
  entrees: EntreeJournal[];
  registre: Registre;
  retraitDisponible: boolean;
  ongletPret: boolean;
  /** Le journal stocké est illisible : il n’a pas été modifié. */
  illisible?: boolean;
  onRetirer: (couple: CoupleRetrait) => void;
  onVider: () => void;
}

const Journal: React.FC<Props> = ({ entrees, registre, retraitDisponible, ongletPret, illisible = false, onRetirer, onVider }) => {
  const [nombre, setNombre] = useState(PAS_AFFICHAGE);
  const [dialogue, setDialogue] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);
  const boutonVider = useRef<HTMLButtonElement>(null);

  const { visibles, restantes } = entreesAffichees(entrees, nombre);
  const retraits = entreesAvecRetrait(entrees, registre);
  const raison = raisonRetrait({ retraitDisponible, ongletPret });
  const vide = entrees.length === 0;
  const viderDesactive = vide || illisible;

  const fermerDialogue = () => {
    setDialogue(false);
    // Le focus retourne sur « Vider », ou sur le titre si le journal est devenu vide.
    setTimeout(() => (boutonVider.current?.getAttribute('aria-disabled') === 'true' ? titre : boutonVider).current?.focus(), 0);
  };

  return (
    <section aria-labelledby="titre-journal" className="mt-4 rounded border border-line bg-ink-2 p-4" data-testid="journal">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titre-journal" ref={titre} tabIndex={-1} className="font-semibold">
          Journal
        </h2>
        <div className="flex flex-col items-end gap-1">
          <button
            ref={boutonVider}
            type="button"
            aria-disabled={viderDesactive ? 'true' : undefined}
            aria-describedby={viderDesactive ? 'raison-vider' : undefined}
            className={viderDesactive ? BOUTON_DESACTIVE : BOUTON_SECONDAIRE}
            onClick={() => {
              if (!viderDesactive) setDialogue(true);
            }}
          >
            Vider
          </button>
          {viderDesactive && (
            <span id="raison-vider" className="text-sm text-muted">
              {illisible ? 'Le journal est illisible.' : 'Le journal est vide.'}
            </span>
          )}
        </div>
      </div>

      {illisible && <p className="mt-3 font-semibold text-defausser">Le journal est illisible et n’a pas été modifié.</p>}
      {!illisible && vide && <p className="mt-3 text-muted">Le journal est vide. Les actions envoyées au site apparaîtront ici.</p>}

      {!illisible && !vide && (
        <ol className="mt-3">
          {visibles.map((e) => {
            const couple = retraits.get(e.id);
            const parametre = libelleParametre(e);
            const idRaison = `raison-retrait-${e.id}`;
            return (
              <li key={e.id} className="flex flex-col gap-2 border-b border-line py-2 text-sm md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 break-words">
                  <time dateTime={e.horodatage} className="text-muted">
                    {formaterHorodatage(e.horodatage)}
                  </time>{' '}
                <span>
                  {rareteDe(e.idCarte) !== '' && `[${rareteDe(e.idCarte)}] `}
                  {e.titre}
                </span>{' '}
                <span className={`font-semibold ${CLASSES_TYPE[e.type]}`}>{libelleType(e.type)}</span>
                {parametre !== null && <> {parametre}</>}
                {' : '}
                <span className={`font-semibold ${CLASSES_RESULTAT[e.resultat]}`}>{libelleResultat(e.resultat)}</span>
                {e.codeHttp !== null && <span className="text-muted"> · HTTP {e.codeHttp}</span>}
            {mentionNonAnnulable(e) && <p className="text-sm text-muted">Non annulable par l’extension</p>}
                </div>
                {couple && (
                  <div className="flex flex-col gap-1 md:items-end">
                    <button
                      type="button"
                      aria-label={`Retirer l’étiquette « ${couple.nomEtiquette} » de ${rareteDe(e.idCarte) !== '' ? `[${rareteDe(e.idCarte)}] ` : ''}${e.titre}`}
                      aria-disabled={raison !== null ? 'true' : undefined}
                      aria-describedby={raison !== null ? idRaison : undefined}
                      className={`${raison !== null ? BOUTON_DESACTIVE : BOUTON_SECONDAIRE} w-full md:w-auto`}
                      onClick={() => {
                        if (raison !== null) return;
                        onRetirer(couple);
                        titre.current?.focus();
                      }}
                    >
                      Retirer l’étiquette
                    </button>
                    {raison !== null && (
                      <span id={idRaison} className="text-sm text-muted">
                        {raison}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {restantes > 0 && (
        <button type="button" className={`${BOUTON_SECONDAIRE} mt-3`} onClick={() => setNombre((n) => n + PAS_AFFICHAGE)}>
          Afficher {PAS_AFFICHAGE} de plus ({restantes} restantes)
        </button>
      )}

      {dialogue && (
        <DialogueVider
          onAnnuler={fermerDialogue}
          onConfirmer={() => {
            onVider();
            setDialogue(false);
            setTimeout(() => titre.current?.focus(), 0);
          }}
        />
      )}
    </section>
  );
};

export default Journal;
