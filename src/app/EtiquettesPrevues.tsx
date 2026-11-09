import React from 'react';
import type { RaisonNonPosee } from '../lib/lot';
import { texteDureeLongue, type ApercuEtiquettes, type LigneEtiquette } from '../lib/apercuEtiquettes';
import type { Carte } from '../lib/collection';

/** Espace insécable : typographie française avant « : » (DT-14). */
const NB = ' ';

const TITRE_BASE = 'Étiquettes prévues';
const TITRE_INDISPONIBLE = `${TITRE_BASE} (envoi pas encore possible)`;

/** Texte exact de l’avertissement (DT-04, SC-015). */
const AVERTISSEMENT = `les étiquettes de thème, de statut et d’échange, dont les prénoms de vos amis, sont peut-être visibles par les autres joueurs.`;

const RAISONS: Record<RaisonNonPosee, string> = {
  homonyme: 'homonyme d’une étiquette à vous',
  'nom-trop-long': 'nom trop long',
  'au-dela-limite': 'au-delà de la limite du site',
};

const etat = (l: LigneEtiquette, disponible: boolean): string =>
  disponible ? (l.nouvelle ? 'nouvelle' : 'à poser') : l.nouvelle ? 'nouvelle · non disponible' : 'non disponible';

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;

function texteCarte(idCarte: string, titre: string, cartes: ReadonlyMap<string, Carte>): string {
  const c = cartes.get(idCarte);
  if (c) return `[${c.rarete}] ${c.titre}`;
  const i = idCarte.indexOf('|');
  return i < 0 ? titre : `[${idCarte.slice(0, i)}] ${titre}`;
}

interface Props {
  apercu: ApercuEtiquettes;
  cartes: ReadonlyMap<string, Carte>;
  /** L’envoi des étiquettes est possible. Par défaut : non disponible. */
  disponible?: boolean;
}

/** Étiquettes attendues, regroupées par nom (T-108). Composant pur : texte seul, aucune requête. */
const EtiquettesPrevues: React.FC<Props> = ({ apercu, cartes, disponible = false }) => {
  const TITRE = disponible ? TITRE_BASE : TITRE_INDISPONIBLE;
  const { lignes, restantes, totaux, nonPosees } = apercu;
  if (lignes.length === 0 && nonPosees.length === 0) return null;
  const attendue = lignes.length > 0;

  return (
    <section aria-label="Étiquettes prévues" className="mt-4" data-testid="etiquettes-prevues">
      {attendue && (
        <>
          <h3 className="font-semibold md:hidden">{TITRE}</h3>
          <table className="hidden w-full text-sm md:table">
            <caption className="pb-2 text-left font-semibold">{TITRE}</caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-2 py-2 font-semibold">Étiquette</th>
                <th scope="col" className="px-2 py-2 font-semibold">Cartes</th>
                <th scope="col" className="px-2 py-2 font-semibold">Exemplaires</th>
                <th scope="col" className="px-2 py-2 font-semibold">État</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.nom} className="border-b border-line">
                  <td className="break-words px-2 py-2 align-top font-semibold">{l.nom}</td>
                  <td className="px-2 py-2 align-top">{l.cartes}</td>
                  <td className="px-2 py-2 align-top">{l.exemplaires}</td>
                  <td className="px-2 py-2 align-top text-muted">{etat(l, disponible)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul aria-label={TITRE} className="md:hidden">
            {lignes.map((l) => (
              <li key={l.nom} className="grid grid-cols-1 gap-1 border-b border-line py-2 text-sm md:grid-cols-4">
                <span className="break-words font-semibold">{l.nom}</span>
                <span>Cartes{NB}: {l.cartes}</span>
                <span>Exemplaires{NB}: {l.exemplaires}</span>
                <span className="text-muted">État{NB}: {etat(l, disponible)}</span>
              </li>
            ))}
          </ul>
          {restantes > 0 && (
            <p className="mt-2 text-sm text-muted" data-testid="etiquettes-restantes">
              … et {restantes} {restantes > 1 ? 'autres étiquettes' : 'autre étiquette'}
            </p>
          )}
          <p className="mt-2 text-sm" data-testid="total-etiquettes">
            Total prévu{NB}: {pluriel(totaux.poses, 'pose', 'poses')} dont {totaux.themes} de thème et {totaux.echanges} d’échange
            {' · '}
            {pluriel(totaux.nomsNouveaux, 'nom nouveau', 'noms nouveaux')}
            {' · '}
            durée estimée{disponible ? '' : ' une fois disponible'}{NB}: {texteDureeLongue(totaux.minutes)}
          </p>
        </>
      )}

      {nonPosees.length > 0 && (
        <details className="mt-3 text-sm text-muted">
          <summary className="min-h-11 cursor-pointer py-2">Étiquettes non posées ({nonPosees.length})</summary>
          <ul>
            {nonPosees.map((n, i) => (
              <li key={i} className="break-words py-1">
                {texteCarte(n.idCarte, n.titre, cartes)}
                {NB}: {n.nomEtiquette} ({RAISONS[n.raison]})
              </li>
            ))}
          </ul>
        </details>
      )}

      {attendue && (
        <div
          role="note"
          className="mt-3 rounded border border-line border-l-4 border-l-vendre bg-ink-2 p-3 text-sm text-paper"
          data-testid="avertissement-visibilite"
        >
          <p className="break-words">
            <span className="font-semibold text-vendre">Visibilité non vérifiée{NB}:</span> {AVERTISSEMENT}
          </p>
        </div>
      )}
    </section>
  );
};

export default EtiquettesPrevues;
