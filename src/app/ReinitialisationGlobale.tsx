import React, { useMemo, useState } from 'react';
import type { Registre } from '../lib/actions';
import type { EtiquetteSite } from '../lib/etiquettesPreexistantes';
import {
  MOT_CONFIRMATION_LOCAL,
  MOT_CONFIRMATION_SITE,
  OPTIONS_REINIT_PAR_DEFAUT,
  creerSauvegardeReinit,
  nomFichierSauvegardeReinit,
  planLocal,
  planSite,
  type OptionsReinitSite,
} from '../lib/reinitialisation';
import { effacerStockageSaufThemes, lireToutLeStockage } from '../lib/stockage';
import { lancerReinitialisationSite, libellesThemesConnus } from './pilotageLots';

interface Props {
  etiquettesSite: readonly EtiquetteSite[] | null;
  registre: Registre;
  /** Une exécution ou une synchronisation est en cours : tout est bloqué. */
  occupe: boolean;
}

const BOUTON = 'inline-flex min-h-11 cursor-pointer items-center justify-center rounded border px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const LIBELLES = { theme: 'Thèmes (#…)', statut: 'Statut · …', echange: '#À échanger …', autre: 'Inconnues de l’extension' } as const;

function telecharger(contenu: string, nom: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

/**
 * Réinitialisation globale : aperçu chiffré (aucune requête), sauvegarde obligatoire, puis deux volets séparés, chacun armé
 * par un mot à saisir. Le site d’abord (étiquettes seulement, jamais un favori), le local ensuite.
 */
const ReinitialisationGlobale: React.FC<Props> = ({ etiquettesSite, registre, occupe }) => {
  const [options, setOptions] = useState<OptionsReinitSite>(OPTIONS_REINIT_PAR_DEFAUT);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [motSite, setMotSite] = useState('');
  const [motLocal, setMotLocal] = useState('');
  const [apercuLocal, setApercuLocal] = useState<ReturnType<typeof planLocal> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const plan = useMemo(() => (etiquettesSite === null ? null : planSite(etiquettesSite, libellesThemesConnus(), registre, options)), [etiquettesSite, registre, options]);
  const bascule = (cle: keyof OptionsReinitSite): void => setOptions((o) => ({ ...o, [cle]: !o[cle] }));

  const sauvegarder = async (): Promise<void> => {
    try {
      const maintenant = new Date();
      telecharger(JSON.stringify(creerSauvegardeReinit(await lireToutLeStockage(), etiquettesSite === null ? null : [...etiquettesSite], registre, maintenant), null, 2), nomFichierSauvegardeReinit(maintenant));
      setSauvegarde(true);
      setApercuLocal(planLocal(await lireToutLeStockage()));
      setMessage('Sauvegarde téléchargée (stockage complet et liste des étiquettes du site).');
    } catch {
      setMessage('Sauvegarde impossible : rien n’a été modifié.');
    }
  };

  const supprimerSite = (limite?: number): void => {
    setMessage(null);
    lancerReinitialisationSite(options, limite).then(
      (n) => setMessage(`Suppression lancée : ${n} étiquette(s). Suivez le journal de l’onglet Synchro ; en cas d’arrêt, relancez : seules les étiquettes restantes sont reprises.`),
      (e: unknown) => setMessage(e instanceof Error ? e.message : 'La suppression n’a pas pu démarrer.'),
    );
  };

  const effacerLocal = (): void => {
    setMessage(null);
    effacerStockageSaufThemes().then(
      (cles) => {
        setMotLocal('');
        setMessage(`${cles.length} clé(s) effacée(s). Rechargez la page : tout repart de zéro, seuls vos thèmes aimés, ceux de vos amis et vos choix de favori sont gardés.`);
      },
      () => setMessage('Effacement impossible : rien n’a été retiré.'),
    );
  };

  const nbSupprimees = plan?.aSupprimer.length ?? 0;
  const armeSite = !occupe && sauvegarde && plan !== null && nbSupprimees > 0 && motSite === MOT_CONFIRMATION_SITE;
  // Le site d’abord : l’effacement local supprime la liste des étiquettes du site, donc il attend que plus aucune ne reste à supprimer.
  const armeLocal = !occupe && sauvegarde && plan !== null && nbSupprimees === 0 && motLocal === MOT_CONFIRMATION_LOCAL;

  return (
    <section aria-labelledby="titre-reinit" className="py-2" data-testid="reinitialisation">
      <h4 id="titre-reinit" className="font-semibold">Réinitialisation globale</h4>
      <p className="mt-1 text-sm text-muted">
        Irréversible. Les favoris du site ne sont jamais touchés (seules des étiquettes sont supprimées). L’aperçu ci-dessous n’envoie aucune requête.
      </p>

      <h5 className="mt-3 font-medium">1. Aperçu du site</h5>
      {plan === null ? (
        <p className="text-sm text-muted">La liste des étiquettes du compte n’est pas lue : lancez une synchronisation.</p>
      ) : (
        <>
          <ul className="mt-1 text-sm">
            {(Object.keys(LIBELLES) as Array<keyof typeof LIBELLES>).map((c) => (
              <li key={c}>
                {LIBELLES[c]} : {plan.parCategorie[c].etiquettes} étiquette(s) sur {plan.parCategorie[c].cartes} pose(s) de carte{c === 'theme' ? ' — supprimées' : ''}
              </li>
            ))}
          </ul>
          <fieldset className="mt-2 flex flex-col gap-1 text-sm">
            <legend className="sr-only">Étiquettes à supprimer en plus des thèmes</legend>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={options.statut} onChange={() => bascule('statut')} /> Supprimer aussi « Statut · … »</label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={options.echange} onChange={() => bascule('echange')} /> Supprimer aussi « #À échanger … »</label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={options.autres} onChange={() => bascule('autres')} /> Supprimer aussi les étiquettes inconnues de l’extension</label>
          </fieldset>
          <p className="mt-1 text-sm font-medium">{nbSupprimees} étiquette(s) seront supprimées, {plan.gardees.length} gardée(s).</p>
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer">Liste des étiquettes supprimées</summary>
            <p>{plan.aSupprimer.map((e) => e.nom).join(', ') || 'Aucune'}</p>
          </details>
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer">Liste des étiquettes gardées</summary>
            <p>{plan.gardees.map((e) => e.nom).join(', ') || 'Aucune'}</p>
          </details>
        </>
      )}

      <h5 className="mt-3 font-medium">2. Sauvegarde obligatoire</h5>
      <button type="button" className={`${BOUTON} mt-1 border-line bg-ink-2`} onClick={() => void sauvegarder()}>Télécharger la sauvegarde complète</button>
      {sauvegarde ? <span className="ml-2 text-sm">Sauvegarde faite.</span> : null}

      <h5 className="mt-3 font-medium">3. Supprimer les étiquettes sur le site</h5>
      <p className="text-sm text-muted">Une suppression par étiquette, même cadence et mêmes arrêts que les autres écritures. Essayez d’abord sur une seule étiquette.</p>
      <label className="mt-1 block text-sm">Saisir « {MOT_CONFIRMATION_SITE} » :{' '}
        <input className="min-h-11 rounded border border-line bg-ink-2 px-2" value={motSite} onChange={(e) => setMotSite(e.target.value)} />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={`${BOUTON} border-line bg-ink-2`} disabled={!armeSite} onClick={() => supprimerSite(1)}>Essai sur 1 étiquette</button>
        <button type="button" className={`${BOUTON} border-line bg-ink-2`} disabled={!armeSite} onClick={() => supprimerSite()}>Supprimer les {nbSupprimees} étiquettes</button>
      </div>

      <h5 className="mt-3 font-medium">4. Effacer les données de l’extension</h5>
      <p className="text-sm text-muted">
        Garde seulement vos thèmes aimés, ceux de vos amis et vos choix de favori (étoiles de la Collection). Efface le reste de la collection (exemplaires, notes, prix cibles, thèmes choisis), les caches, le journal, le registre, l’historique et les autres préférences.
        Disponible quand plus aucune étiquette n’est à supprimer sur le site (étape 3 faite, liste relue).
      </p>
      {apercuLocal === null ? null : (
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer">{apercuLocal.supprimees.length} clé(s) effacée(s), {apercuLocal.gardees.length} gardée(s) ({apercuLocal.gardees.join(', ') || 'aucune'})</summary>
          <p>{apercuLocal.supprimees.map((c) => `${c.cle} (${Math.ceil(c.octets / 1024)} Ko)`).join(', ')}</p>
        </details>
      )}
      <label className="mt-1 block text-sm">Saisir « {MOT_CONFIRMATION_LOCAL} » :{' '}
        <input className="min-h-11 rounded border border-line bg-ink-2 px-2" value={motLocal} onChange={(e) => setMotLocal(e.target.value)} />
      </label>
      <button type="button" className={`${BOUTON} mt-2 border-line bg-ink-2`} disabled={!armeLocal} onClick={effacerLocal}>Effacer les données de l’extension</button>

      {occupe ? <p className="mt-2 text-sm">Une synchronisation ou un lot est en cours : attendez la fin.</p> : null}
      {message !== null ? <p role="status" className="mt-2 text-sm">{message}</p> : null}
    </section>
  );
};

export default ReinitialisationGlobale;
