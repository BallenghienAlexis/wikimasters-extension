import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Carte } from '../lib/collection';
import { enregistrerCacheWikipedia } from '../lib/stockage';
import { titresAVerifier, type CacheWikipedia } from '../lib/wikipedia';
import { verifierTitres, type RaisonArret } from './verifierWikipedia';

interface Props {
  cartes: Carte[];
  cache: CacheWikipedia;
  onCache: (cache: CacheWikipedia) => void;
}

const NB = ' ';

function texteArret(arret: RaisonArret, codeHttp: number | null): string {
  if (arret === 'manuel') return 'Vérification arrêtée par vous.';
  if (arret === 'code-http') return `Wikipédia a refusé${NB}(${codeHttp ?? '?'}) : réessayez plus tard.`;
  return 'Vérification arrêtée : trop d’échecs de lecture.';
}

/** Vérifie les thèmes des cartes d’après les catégories de leur page Wikipédia. Action du joueur, jamais automatique. */
const VerificationWikipedia: React.FC<Props> = ({ cartes, cache, onCache }) => {
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [faites, setFaites] = useState(0);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [total, setTotal] = useState(0);
  const controleur = useRef<AbortController | null>(null);

  const restantes = useMemo(() => titresAVerifier(cartes.map((c) => c.titre), cache, maintenant), [cartes, cache, maintenant]);

  useEffect(() => () => controleur.current?.abort(), []);

  const lancer = (): void => {
    const c = new AbortController();
    setMaintenant(Date.now());
    setTotal(restantes.length);
    controleur.current = c;
    setEnCours(true);
    setMessage(null);
    setFaites(0);
    void verifierTitres({
      titres: restantes,
      cache,
      signal: c.signal,
      surProgres: async (nouveau, n) => {
        setFaites(n);
        onCache(nouveau);
        await enregistrerCacheWikipedia(nouveau);
      },
    })
      .then((r) => setMessage(r.arret === null ? `${r.verifiees} page${r.verifiees > 1 ? 's' : ''} vérifiée${r.verifiees > 1 ? 's' : ''}.` : texteArret(r.arret, r.codeHttp)))
      .catch(() => setMessage('Enregistrement du cache impossible.'))
      .finally(() => setEnCours(false));
  };

  return (
    <section className="mt-6" aria-labelledby="titre-wikipedia" data-testid="verification-wikipedia">
      <h2 id="titre-wikipedia" className="text-lg font-semibold">Thèmes vérifiés sur Wikipédia</h2>
      <p className="mt-1 text-sm text-muted">
        Lit la page Wikipédia de chaque carte (une requête par seconde, titre de la carte seul) pour affiner ses thèmes. Les décisions que vous avez prises ne changent jamais.
      </p>
      <p className="mt-2 text-sm" role="status">
        {enCours ? `Vérification en cours${NB}: ${faites} sur ${total}` : `${restantes.length} carte${restantes.length > 1 ? 's' : ''} à vérifier.`}
        {message !== null && ` ${message}`}
      </p>
      <button
        type="button"
        className="mt-2 rounded border border-line px-3 py-1 text-sm disabled:opacity-50"
        disabled={!enCours && restantes.length === 0}
        onClick={enCours ? () => controleur.current?.abort() : lancer}
      >
        {enCours ? 'Arrêter' : 'Vérifier avec Wikipédia'}
      </button>
    </section>
  );
};

export default VerificationWikipedia;
