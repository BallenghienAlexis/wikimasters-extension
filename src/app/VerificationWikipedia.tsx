import React, { useEffect, useRef, useState } from 'react';
import { enregistrerCacheWikipedia } from '../lib/stockage';
import { titresAVerifier, type CacheWikipedia } from '../lib/wikipedia';
import { verifierTitres, type RaisonArret } from './verifierWikipedia';

interface Props {
  /** Titres des cartes consultées (affichées dans la liste). */
  titres: string[];
  cache: CacheWikipedia;
  onCache: (cache: CacheWikipedia) => void;
}

const NB = ' ';
/** Cartes interrogées d’un coup au plus ; les suivantes le sont quand le lot est fini. */
const TAILLE_LOT = 25;

function texteArret(arret: RaisonArret, codeHttp: number | null): string {
  if (arret === 'code-http') return `Wikipédia a refusé${NB}(${codeHttp ?? '?'}) : vérification suspendue jusqu’au rechargement de la page.`;
  return 'Vérification suspendue : trop d’échecs de lecture. Elle reprendra au rechargement de la page.';
}

/**
 * Vérifie automatiquement, d’après les catégories de leur page Wikipédia, les thèmes des cartes consultées.
 * Une requête à la fois, une par seconde, uniquement pour les cartes affichées et absentes du cache.
 */
const VerificationWikipedia: React.FC<Props> = ({ titres, cache, onCache }) => {
  const [suspendue, setSuspendue] = useState<string | null>(null);
  const [lot, setLot] = useState<{ faites: number; total: number } | null>(null);
  const enCours = useRef(false);
  const tentes = useRef(new Set<string>());
  const arretee = useRef(false);
  const cacheRef = useRef(cache);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);

  useEffect(() => {
    const prochains = titresAVerifier(titres, cache, Date.now()).filter((t) => !tentes.current.has(t)).slice(0, TAILLE_LOT);
    if (enCours.current || arretee.current || prochains.length === 0) return;
    enCours.current = true;
    prochains.forEach((t) => tentes.current.add(t));
    const controleur = new AbortController();
    // Le lot en cours n'est pas interrompu par un nouveau rendu : il s'arrête de lui-même (cadence, 403/429, échecs).
    void (async () => {
      try {
        const r = await verifierTitres({
          titres: prochains,
          cache: cacheRef.current,
          signal: controleur.signal,
          surProgres: async (nouveau, faites) => {
            cacheRef.current = nouveau;
            setLot({ faites, total: prochains.length });
            onCache(nouveau);
            await enregistrerCacheWikipedia(nouveau);
          },
        });
        if (r.arret === 'code-http' || r.arret === 'echecs') {
          arretee.current = true;
          setSuspendue(texteArret(r.arret, r.codeHttp));
        }
      } catch {
        arretee.current = true;
        setSuspendue('Enregistrement du cache Wikipédia impossible : vérification suspendue.');
      } finally {
        enCours.current = false;
        setLot(null);
      }
    })();
  }, [titres, cache, onCache]);

  if (suspendue === null && lot === null) return null;
  return (
    <p className="mt-2 text-sm text-muted" aria-live="polite" data-testid="verification-wikipedia">
      {suspendue ?? `Thèmes vérifiés sur Wikipédia${NB}: ${lot?.faites ?? 0} sur ${lot?.total ?? 0}`}
    </p>
  );
};

export default VerificationWikipedia;
