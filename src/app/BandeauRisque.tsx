import React from 'react';
import { AVERTISSEMENT_AMIS, NB } from './apercuLot';

/** Encadré compact (maquette v15) : l’essentiel sur une ligne, les règles du site dans un détail repliable. */
const BandeauRisque: React.FC<{ avertirAmis: boolean }> = ({ avertirAmis }) => {
  return (
    <section
      aria-labelledby="titre-risque"
      className="mt-4 rounded border border-line border-l-4 border-l-vendre bg-ink-2 px-4 py-3 text-sm"
      data-testid="bandeau-risque"
    >
      <p className="break-words">
        <strong id="titre-risque" className="font-semibold text-vendre">
          <span aria-hidden="true">⚠ </span>Action sur le site à votre place.
        </strong>{' '}
        Une enchère et une défausse ne s’annulent pas depuis l’extension. <span className="font-semibold">Risque de bannissement accepté le 07/11/2026.</span>
      </p>
      <details className="mt-1">
        <summary className="inline-flex min-h-11 cursor-pointer items-center underline focus-visible:shadow-(--halo-focus)">Voir les règles du site</summary>
        <p className="break-words pb-1 text-muted">
          Cette synchronisation envoie des requêtes à WikiMasters à votre place. Les règles de la communauté (§{NB}3) interdisent la
          rétro-ingénierie et l’interception du trafic, les conditions d’utilisation (§{NB}6) prévoient un bannissement pour
          automatisation, et le fichier <code>robots.txt</code> du site indique «{NB}Disallow:{NB}/api/{NB}».
        </p>
      </details>
      {avertirAmis && <p className="mt-2 font-semibold text-vendre">{AVERTISSEMENT_AMIS}</p>}
    </section>
  );
};

export default BandeauRisque;
