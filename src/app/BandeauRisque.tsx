import React from 'react';
import { AVERTISSEMENT_AMIS, NB } from './apercuLot';

const BandeauRisque: React.FC<{ avertirAmis: boolean }> = ({ avertirAmis }) => {
  return (
    <section
      aria-labelledby="titre-risque"
      className="mt-4 rounded border border-line border-l-4 border-l-defausser bg-ink-2 p-4"
      data-testid="bandeau-risque"
    >
      <h2 id="titre-risque" className="font-semibold text-defausser">
        <span aria-hidden="true">! </span>Action sur le site à votre place
      </h2>
      <p className="mt-2 break-words">
        Cette synchronisation envoie des requêtes à WikiMasters à votre place. Les règles de la communauté (§{NB}3) interdisent la
        rétro-ingénierie et l’interception du trafic, les conditions d’utilisation (§{NB}6) prévoient un bannissement pour
        automatisation, et le fichier <code>robots.txt</code> du site indique «{NB}Disallow:{NB}/api/{NB}».
      </p>
      <p className="mt-2 font-semibold">Risque de bannissement accepté le 07/11/2026.</p>
      <p className="mt-2">Une enchère et une défausse ne s’annulent pas depuis l’extension.</p>
      {avertirAmis && <p className="mt-2 font-semibold text-vendre">{AVERTISSEMENT_AMIS}</p>}
    </section>
  );
};

export default BandeauRisque;
