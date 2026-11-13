import { useEffect, useState } from 'react';
import { AFFICHAGE_DEFAUT, type Affichage } from '../lib/affichage';
import { chargerAffichage, ecouterAffichage } from '../lib/stockage';

/**
 * Réglage « Animations » (clé `affichage`, D-17) : pose `data-animations="off"` sur `<html>` quand il est coupé.
 * La valeur lue est aussi fournie à `ContexteAffichage` (voir `useMouvement`). Illisible : défaut, rien n’est écrasé.
 */
export function useAffichage(): Affichage {
  const [affichage, setAffichage] = useState<Affichage>({ ...AFFICHAGE_DEFAUT });

  useEffect(() => {
    let actif = true;
    const relire = (): void => {
      void chargerAffichage()
        .then((a) => {
          if (actif) setAffichage(a);
        })
        .catch(() => {
          if (actif) setAffichage({ ...AFFICHAGE_DEFAUT });
        });
    };
    relire();
    const arreter = ecouterAffichage(relire);
    return () => {
      actif = false;
      arreter();
    };
  }, []);

  useEffect(() => {
    const racine = document.documentElement;
    if (affichage.animations) racine.removeAttribute('data-animations');
    else racine.setAttribute('data-animations', 'off');
  }, [affichage.animations]);

  return affichage;
}
