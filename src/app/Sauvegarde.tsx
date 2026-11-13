import React, { useRef, useState } from 'react';
import { appliquerImport, apercuImport, creerSauvegarde, lireSauvegarde, nomFichierSauvegarde, serialiserSauvegarde, TAILLE_MAX_SAUVEGARDE, type Apercu, type Donnees, type PolitiqueConflit, type Sauvegarde as DonneesSauvegarde } from '../lib/sauvegarde';
import { ecrireDonneesSauvegarde, lireDonneesSauvegarde } from '../lib/stockage';

const CLASSE_BOUTON = 'inline-flex min-h-11 cursor-pointer items-center rounded border border-line bg-ink-2 px-4';

interface Props {
  /** Appelé après une importation réussie, avec les données écrites. */
  onImportee: (donnees: Donnees) => void;
}

function telecharger(contenu: string, nom: string): void {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(url);
}

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;

const Sauvegarde: React.FC<Props> = ({ onImportee }) => {
  const champ = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lue, setLue] = useState<{ sauvegarde: DonneesSauvegarde; apercu: Apercu } | null>(null);
  const [politique, setPolitique] = useState<PolitiqueConflit>('garder-ici');
  const [occupe, setOccupe] = useState(false);

  const exporter = async (): Promise<void> => {
    setErreur(null);
    try {
      const maintenant = new Date();
      telecharger(serialiserSauvegarde(creerSauvegarde(await lireDonneesSauvegarde(), maintenant)), nomFichierSauvegarde(maintenant));
      setMessage('Sauvegarde téléchargée. Elle ne contient ni jeton ni cookie.');
    } catch {
      setErreur('Sauvegarde impossible : les données stockées sont illisibles.');
    }
  };

  const choisir = async (fichier: File): Promise<void> => {
    setMessage(null);
    setLue(null);
    if (fichier.size > TAILLE_MAX_SAUVEGARDE) {
      setErreur('Fichier trop volumineux (20 Mo au plus).');
      return;
    }
    const resultat = lireSauvegarde(await fichier.text());
    if (!resultat.ok) {
      setErreur(`Importation refusée : ${resultat.erreur} Rien n’a été modifié.`);
      return;
    }
    try {
      setErreur(null);
      setLue({ sauvegarde: resultat.sauvegarde, apercu: apercuImport(await lireDonneesSauvegarde(), resultat.sauvegarde) });
    } catch {
      setErreur('Importation impossible : les données stockées sont illisibles.');
    }
  };

  const appliquer = async (): Promise<void> => {
    if (!lue) return;
    setOccupe(true);
    try {
      // Relecture juste avant l'écriture : une synchro a pu modifier le stockage depuis l'aperçu.
      const resultat = appliquerImport(await lireDonneesSauvegarde(), lue.sauvegarde, politique);
      if (!resultat.ok) {
        setErreur(`Importation refusée : ${resultat.erreur} Rien n’a été modifié.`);
        return;
      }
      await ecrireDonneesSauvegarde(resultat.donnees);
      onImportee(resultat.donnees);
      setLue(null);
      setErreur(null);
      setMessage('Sauvegarde importée.');
    } catch {
      setErreur('Importation interrompue : vérifiez le stockage, puis réessayez (l’importation est sans danger si on la relance).');
    } finally {
      setOccupe(false);
    }
  };

  const a = lue?.apercu;
  return (
    <section aria-labelledby="titre-sauvegarde" className="mt-4 rounded border border-line bg-ink-2 p-4">
      <h2 id="titre-sauvegarde" className="text-lg font-semibold">Sauvegarde complète</h2>
      <p className="mt-1 text-sm text-muted">
        Un seul fichier pour passer d’un PC à l’autre : statuts, prix cibles, notes, thèmes, amis et ventes. Les cartes et étiquettes du site se récupèrent par la synchronisation.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className={CLASSE_BOUTON} onClick={() => void exporter()}>
          Exporter une sauvegarde
        </button>
        <button type="button" className={CLASSE_BOUTON} onClick={() => champ.current?.click()}>
          Importer une sauvegarde
        </button>
        <input
          ref={champ}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Fichier de sauvegarde à importer"
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            e.target.value = '';
            if (fichier) void choisir(fichier);
          }}
        />
      </div>
      {erreur && <p role="alert" className="mt-3">{erreur}</p>}
      {message && <p role="status" className="mt-3">{message}</p>}
      {a && (
        <div className="mt-3" data-testid="apercu-sauvegarde">
          <p className="font-medium">Aperçu avant d’appliquer (sauvegarde du {new Date(a.creeLe).toLocaleDateString('fr-FR')})</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{pluriel(a.cartesNouvelles, 'carte nouvelle', 'cartes nouvelles')}</li>
            <li>{pluriel(a.cartesCompletees, 'carte complétée (rien saisi ici)', 'cartes complétées (rien saisi ici)')}</li>
            <li>{pluriel(a.cartesIdentiques, 'carte identique', 'cartes identiques')}</li>
            <li>{pluriel(a.cartesEnConflit, 'carte en conflit (saisie différente des deux côtés)', 'cartes en conflit (saisie différente des deux côtés)')}</li>
            <li>{pluriel(a.themesAjoutes, 'thème ajouté', 'thèmes ajoutés')}, {pluriel(a.amisAjoutes, 'ami ajouté', 'amis ajoutés')}, {pluriel(a.ventesAjoutees, 'vente notée', 'ventes notées')}</li>
          </ul>
          <fieldset className="mt-3">
            <legend className="font-medium">En cas de conflit</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="politique-sauvegarde" checked={politique === 'garder-ici'} onChange={() => setPolitique('garder-ici')} />
              Garder ce que j’ai saisi ici (recommandé)
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="politique-sauvegarde" checked={politique === 'remplacer'} onChange={() => setPolitique('remplacer')} />
              Prendre la sauvegarde (remplace aussi mes thèmes, mes amis et le réglage de la synchro automatique)
            </label>
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={CLASSE_BOUTON} disabled={occupe} onClick={() => void appliquer()}>
              Appliquer la sauvegarde
            </button>
            <button type="button" className={CLASSE_BOUTON} disabled={occupe} onClick={() => setLue(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default Sauvegarde;
