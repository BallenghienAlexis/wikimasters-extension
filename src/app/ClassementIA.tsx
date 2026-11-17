import React, { useMemo, useRef, useState } from 'react';
import type { Carte } from '../lib/collection';
import { ajouterAuCache, cartesAClasser, estimerCout, exporterEnFichiers, lireImportThemes, MODELE_IA, type CacheIA } from '../lib/classificationIA';
import { sansThemeLocal } from '../lib/themes';
import { enregistrerCacheIA } from '../lib/stockage';
import { classerCartes } from './classerIA';

interface Props {
  cartes: readonly Carte[];
  cache: CacheIA;
  onCache: (cache: CacheIA) => void;
}

const NB = ' ';
/** Un fichier de thèmes pèse quelques dizaines de Ko ; au-delà, ce n'est pas le bon fichier. */
const TAILLE_MAX_IMPORT = 2 * 1024 * 1024;
const format = (n: number): string => n.toLocaleString('fr-FR');

const RAISONS: Record<string, string> = {
  manuel: 'Arrêté.',
  'code-http': 'Le service a refusé la demande.',
  echecs: 'Cinq échecs d’affilée : arrêt.',
  'aucune-lue': 'Aucune réponse exploitable : arrêt.',
};

/**
 * Classement des cartes sans thème fiable par l’API Claude (Alexis, 2026-11-15). Lancé à la main, après une estimation
 * du coût et une confirmation. La clé API n’est gardée que dans l’état du composant : jamais stockée ni sauvegardée.
 */
const ClassementIA: React.FC<Props> = ({ cartes, cache, onCache }) => {
  const [cle, setCle] = useState('');
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [collage, setCollage] = useState('');
  const [etat, setEtat] = useState<string | null>(null);
  const controle = useRef<AbortController | null>(null);
  const aClasser = useMemo(() => cartesAClasser(cartes, cache, sansThemeLocal), [cartes, cache]);
  const estimation = useMemo(() => estimerCout(aClasser), [aClasser]);
  const dejaFaites = Object.keys(cache.entrees).length;
  const pret = !enCours && aClasser.length > 0 && confirme && cle.trim().length > 0;

  const exporter = (): void => {
    const fichiers = exporterEnFichiers(aClasser);
    for (const f of fichiers) {
      const url = URL.createObjectURL(new Blob([f.contenu], { type: 'application/json' }));
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = f.nom;
      lien.click();
      URL.revokeObjectURL(url);
    }
    setEtat(
      `${format(aClasser.length)} cartes exportées${fichiers.length > 1 ? ` en ${fichiers.length} fichiers de 150 cartes au plus` : ''}. Chaque fichier contient son prompt : transfère-le tel quel dans un chat IA (un fichier par message), puis colle ici sa réponse.`,
    );
  };

  const enregistrer = async (texte: string): Promise<boolean> => {
    const lecture = lireImportThemes(texte, new Set(aClasser.map((c) => c.titre)));
    if (lecture.type === 'invalide') {
      setEtat(lecture.raison);
      return false;
    }
    const nouveau = ajouterAuCache(cache, lecture.resultats);
    try {
      await enregistrerCacheIA(nouveau);
    } catch {
      setEtat('Enregistrement impossible : le stockage est indisponible.');
      return false;
    }
    onCache(nouveau);
    setEtat(`${format(lecture.resultats.size)} carte${lecture.resultats.size > 1 ? 's' : ''} importée${lecture.resultats.size > 1 ? 's' : ''}${lecture.ignores > 0 ? `, ${format(lecture.ignores)} entrée${lecture.ignores > 1 ? 's' : ''} ignorée${lecture.ignores > 1 ? 's' : ''}` : ''}.`);
    return true;
  };

  const importer = async (fichiers: FileList | null): Promise<void> => {
    const liste = [...(fichiers ?? [])];
    if (liste.length === 0) return;
    if (liste.length > 10 || liste.reduce((n, f) => n + f.size, 0) > TAILLE_MAX_IMPORT) return void setEtat('Fichiers trop volumineux (10 fichiers et 2 Mo au total au plus).');
    // Plusieurs fichiers (un par lot) sont lus ensemble : un seul enregistrement, un seul compte rendu.
    const textes = await Promise.all(liste.map((f) => f.text()));
    await enregistrer(textes.join('\n'));
  };

  const importerCollage = async (): Promise<void> => {
    if (collage.trim() === '') return void setEtat('Colle d’abord la réponse de l’IA.');
    if (collage.length > TAILLE_MAX_IMPORT) return void setEtat('Texte trop volumineux (2 Mo au plus).');
    if (await enregistrer(collage)) setCollage('');
  };

  const lancer = (): void => {
    const arret = new AbortController();
    controle.current = arret;
    setEnCours(true);
    setEtat('Classement en cours…');
    void classerCartes({
      cartes: aClasser,
      cle: cle.trim(),
      cache,
      signal: arret.signal,
      surProgres: async (c, lues) => {
        await enregistrerCacheIA(c);
        onCache(c);
        setEtat(`Classement en cours${NB}: ${format(lues)} sur ${format(aClasser.length)}`);
      },
    })
      .then((r) => setEtat(`${format(r.lues)} carte${r.lues > 1 ? 's' : ''} classée${r.lues > 1 ? 's' : ''}.${r.sautes > 0 ? ` ${r.sautes} lot${r.sautes > 1 ? 's' : ''} sauté${r.sautes > 1 ? 's' : ''}.` : ''}${r.arret ? ` ${RAISONS[r.arret] ?? ''}` : ''}${(r.arret !== 'manuel' && r.detail && (r.arret || r.sautes > 0)) ? ` Détail${NB}: ${r.detail}` : ''}`))
      .catch(() => setEtat('Le classement a échoué.'))
      .finally(() => {
        setEnCours(false);
        setConfirme(false);
        setCle('');
      });
  };

  return (
    <div className="flex flex-col gap-3 py-2 text-sm" data-testid="classement-ia">
      <p>
        Pour les cartes que les mots-clés, Wikipédia et Wikidata ne savent pas classer, l’extension peut demander à l’IA Claude ({MODELE_IA}) de choisir
        1 à 4 thèmes dans la liste de l’extension. Seuls le titre et la description de la carte sont envoyés à Anthropic, avec ta clé API, jamais une donnée de ton compte.
        Les résultats sont gardés : une carte n’est classée qu’une fois, et le même titre donne toujours le même thème.
      </p>
      <p data-testid="classement-ia-estimation">
        {aClasser.length === 0
          ? `Aucune carte à classer${dejaFaites > 0 ? ` (${format(dejaFaites)} déjà classées)` : ''}.`
          : `${format(aClasser.length)} cartes à classer en ${format(estimation.requetes)} requêtes, environ ${format(estimation.jetonsEntree)} jetons envoyés et ${format(estimation.jetonsSortie)} reçus : coût estimé ${estimation.cout.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' })} (à vérifier sur ta console Anthropic).`}
      </p>
      <label className="flex flex-col gap-1">
        <span>Clé API Anthropic (non enregistrée, effacée après le classement)</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={cle}
          onChange={(e) => setCle(e.target.value)}
          disabled={enCours}
          className="rounded border border-line bg-ink px-2 py-1 text-paper"
          data-testid="classement-ia-cle"
        />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={confirme} onChange={(e) => setConfirme(e.target.checked)} disabled={enCours} className="mt-1" data-testid="classement-ia-confirme" />
        <span>J’ai lu le coût estimé et j’accepte l’envoi des titres et descriptions de ces cartes à Anthropic.</span>
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={lancer} disabled={!pret} className="rounded border border-line px-3 py-1 disabled:opacity-50" data-testid="classement-ia-lancer">
          Classer avec l’IA
        </button>
        {enCours ? (
          <button type="button" onClick={() => controle.current?.abort()} className="rounded border border-line px-3 py-1" data-testid="classement-ia-arreter">
            Arrêter
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2" data-testid="classement-ia-fichier">
        <button type="button" onClick={exporter} disabled={enCours || aClasser.length === 0} className="rounded border border-line px-3 py-1 disabled:opacity-50" data-testid="classement-ia-exporter">
          Exporter les cartes sans thème
        </button>
        <label className="rounded border border-line px-3 py-1">
          Importer les thèmes classés
          <input type="file" multiple accept="application/json,.json,.txt,text/plain" className="sr-only" disabled={enCours} onChange={(e) => { void importer(e.target.files); e.target.value = ''; }} aria-label="Fichier des thèmes classés à importer" data-testid="classement-ia-importer" />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          Ou colle ici la réponse de l’IA (une ou plusieurs, avec ou sans texte autour)
          <textarea value={collage} onChange={(e) => setCollage(e.target.value)} rows={4} disabled={enCours} className="rounded border border-line bg-transparent p-2 font-mono text-xs" data-testid="classement-ia-collage" />
        </label>
        <button type="button" onClick={() => { void importerCollage(); }} disabled={enCours || collage.trim() === ''} className="self-start rounded border border-line px-3 py-1 disabled:opacity-50" data-testid="classement-ia-importer-collage">
          Importer le texte collé
        </button>
      </div>
      <p aria-live="polite" data-testid="classement-ia-etat">{etat}</p>
    </div>
  );
};

export default ClassementIA;
