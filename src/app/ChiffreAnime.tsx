import React, { useEffect, useState } from 'react';
import { dureeToken, useMouvement } from './useMouvement';

interface Props {
  valeur: number;
  /** Nom du chiffre (« Exemplaires »). */
  libelle: string;
}

const formater = (n: number): string => Math.round(n).toLocaleString('fr-FR');

/** Chiffre clé (D-61) : le compteur défile en `aria-hidden`, la valeur finale est écrite dès le premier rendu. */
const ChiffreAnime: React.FC<Props> = ({ valeur, libelle }) => {
  const mouvement = useMouvement();
  const [affiche, setAffiche] = useState(valeur);

  useEffect(() => {
    if (!mouvement) return;
    const duree = dureeToken('--d-base', 400);
    const debut = performance.now();
    let image = 0;
    const pas = (t: number) => {
      const p = Math.min(1, (t - debut) / duree);
      setAffiche(valeur * (1 - (1 - p) ** 3));
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [valeur, mouvement]);

  const final = formater(valeur);
  return (
    <span className="inline-block whitespace-nowrap">
      <span className="sr-only">{`${libelle}\u00a0: ${final}`}</span>
      <span aria-hidden="true" className="inline-block tabular-nums" style={{ minWidth: `${final.length}ch` }}>
        {formater(mouvement ? affiche : valeur)}
      </span>
    </span>
  );
};

export default ChiffreAnime;
