import { useCallback, useEffect, useRef, useState } from 'react';
import { chargerSynchroPc, ecrireDonneesSauvegarde, enregistrerSynchroPc, ErreurImportSynchroEnCours, lireDonneesSauvegarde } from '../lib/stockage';
import type { Donnees } from '../lib/sauvegarde';
import { aDesSaisies, empreinte, empreinteEdition, fusionnerFichiersPc, genererNomPc, instantane, INTERVALLE_ECRITURE_MS, INTERVALLE_LECTURE_MS, nomPcValide, type FichierIgnore } from '../lib/synchroPc';
import { autorisation, chargerDossier, choisirDossier, ecrireFichierPc, listerFichiersPc, oublierDossier, supprimerFichierPc, synchroPcDisponible, type Dossier } from './dossierPc';

export type EtatSynchroPc = 'indisponible' | 'sans-dossier' | 'autorisation' | 'actif' | 'erreur';

export interface SynchroPc {
  etat: EtatSynchroPc;
  dossier: string | null;
  nomPc: string;
  dernierEnvoi: string | null;
  derniereLecture: string | null;
  pcVus: string[];
  ignores: FichierIgnore[];
  erreur: string | null;
  choisir: () => Promise<void>;
  autoriser: () => Promise<void>;
  renommer: (nom: string) => boolean;
  desactiver: () => Promise<void>;
  maintenant: () => Promise<void>;
}

interface Memoire {
  nomPc: string;
  dernierEnvoi: string | null;
  empreinte: string | null;
  /** Empreinte de ce que le joueur a saisi, au dernier cycle : un changement date `modifieLe`. */
  edition: string | null;
  /** Dernière modification saisie ici ; `null` tant qu'aucune n'est connue (PC neuf : l'autre PC l'emporte). */
  modifieLe: string | null;
  lus: Record<string, string>;
}

const memoireParDefaut = (): Memoire => ({ nomPc: genererNomPc(), dernierEnvoi: null, empreinte: null, edition: null, modifieLe: null, lus: {} });

function lireMemoire(brut: Record<string, unknown> | null): Memoire {
  if (!brut) return memoireParDefaut();
  const lus: Record<string, string> = {};
  if (typeof brut.lus === 'object' && brut.lus !== null) {
    for (const [k, v] of Object.entries(brut.lus)) if (nomPcValide(k) && typeof v === 'string') lus[k] = v;
  }
  return {
    nomPc: typeof brut.nomPc === 'string' && nomPcValide(brut.nomPc) ? brut.nomPc : genererNomPc(),
    dernierEnvoi: typeof brut.dernierEnvoi === 'string' ? brut.dernierEnvoi : null,
    empreinte: typeof brut.empreinte === 'string' ? brut.empreinte : null,
    edition: typeof brut.edition === 'string' ? brut.edition : null,
    modifieLe: typeof brut.modifieLe === 'string' ? brut.modifieLe : null,
    lus,
  };
}
const ecrireMemoire = (m: Memoire): void => void enregistrerSynchroPc({ ...m }).catch(() => undefined);

/** Synchro entre PC (spec `synchro-pc`) : tant que la page de gestion est ouverte et le dossier autorisé. Aucune requête réseau. */
export function useSynchroPc(prete: boolean, onFusionnee: (donnees: Donnees) => void): SynchroPc {
  const memoire = useRef<Memoire>(memoireParDefaut());
  const memoireLue = useRef<Promise<void> | null>(null);
  const dossier = useRef<Dossier | null>(null);
  const avertissement = useRef<string | null>(null);
  const occupe = useRef(false);
  const derniereLectureMs = useRef(0);
  const [vue, setVue] = useState({ etat: (synchroPcDisponible() ? 'sans-dossier' : 'indisponible') as EtatSynchroPc, nomDossier: null as string | null, derniereLecture: null as string | null, pcVus: [] as string[], ignores: [] as FichierIgnore[], erreur: null as string | null });
  const [nomPc, setNomPc] = useState(memoire.current.nomPc);
  const [dernierEnvoi, setDernierEnvoi] = useState<string | null>(null);

  const cycle = useCallback(async (): Promise<void> => {
    const d = dossier.current;
    if (!d || occupe.current) return;
    occupe.current = true;
    try {
      if ((await autorisation(d, false)) !== 'granted') {
        setVue((v) => ({ ...v, etat: 'autorisation' }));
        return;
      }
      const m = memoire.current;
      const maintenant = new Date();
      // 1. Envoi de ce PC (au plus une fois par minute, et seulement si le contenu a changé).
      let donnees = await lireDonneesSauvegarde();
      const edition = empreinteEdition(donnees);
      if ((m.edition !== null && edition !== m.edition) || (m.edition === null && m.modifieLe === null && aDesSaisies(donnees))) m.modifieLe = maintenant.toISOString();
      m.edition = edition;
      const texte = instantane(donnees, maintenant, m.modifieLe);
      const peutEcrire = m.dernierEnvoi === null || maintenant.getTime() - Date.parse(m.dernierEnvoi) >= INTERVALLE_ECRITURE_MS;
      if (peutEcrire && empreinte(texte) !== m.empreinte) {
        await ecrireFichierPc(d, m.nomPc, texte);
        m.dernierEnvoi = maintenant.toISOString();
        m.empreinte = empreinte(texte);
        ecrireMemoire(m);
        setDernierEnvoi(m.dernierEnvoi);
      }
      // 2. Lecture des autres PC (au plus toutes les 5 minutes).
      if (Date.now() - derniereLectureMs.current >= INTERVALLE_LECTURE_MS) {
        derniereLectureMs.current = Date.now();
        const rapport = fusionnerFichiersPc(donnees, await listerFichiersPc(d), m.nomPc, m.lus, m.modifieLe);
        if (rapport.changements) {
          // Une saisie faite pendant la lecture des fichiers ne doit pas être écrasée : on recommence au prochain tour.
          if (empreinteEdition(await lireDonneesSauvegarde()) !== edition) {
            derniereLectureMs.current = 0;
            ecrireMemoire(m);
            return;
          }
          donnees = rapport.donnees;
          await ecrireDonneesSauvegarde(donnees);
          m.edition = empreinteEdition(donnees);
          onFusionnee(donnees);
        }
        m.lus = rapport.lus;
        ecrireMemoire(m);
        setVue((v) => ({ ...v, etat: 'actif', derniereLecture: new Date().toISOString(), pcVus: Object.keys(rapport.lus).sort(), ignores: rapport.ignores, erreur: avertissement.current }));
      } else {
        setVue((v) => ({ ...v, etat: 'actif', erreur: avertissement.current }));
      }
    } catch (e) {
      if (e instanceof ErreurImportSynchroEnCours) {
        // Une synchro du site tient le bail : on réessaie au prochain tour, sans afficher d'erreur.
        derniereLectureMs.current = 0;
        return;
      }
      setVue((v) => ({ ...v, etat: 'erreur', erreur: e instanceof Error ? e.message : 'Synchro entre PC impossible.' }));
    } finally {
      occupe.current = false;
    }
  }, [onFusionnee]);

  useEffect(() => {
    if (!prete || !synchroPcDisponible()) return undefined;
    let actif = true;
    memoireLue.current ??= chargerSynchroPc()
      .then((brut) => {
        memoire.current = lireMemoire(brut);
        setNomPc(memoire.current.nomPc);
        setDernierEnvoi(memoire.current.dernierEnvoi);
        ecrireMemoire(memoire.current);
      })
      .catch(() => undefined);
    void memoireLue.current
      .then(() => chargerDossier())
      .then(async (d) => {
        if (!actif || !d) return;
        dossier.current = d;
        setVue((v) => ({ ...v, nomDossier: d.name, etat: 'actif' }));
        await cycle();
      })
      .catch(() => setVue((v) => ({ ...v, etat: 'erreur', erreur: 'Le dossier mémorisé est illisible : choisis-le à nouveau.' })));
    const minuteur = setInterval(() => void cycle(), 30_000);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [prete, cycle]);

  const choisir = async (): Promise<void> => {
    try {
      const { dossier: d, erreurMemoire } = await choisirDossier();
      if (!d) {
        setVue((v) => ({ ...v, erreur: 'Aucun dossier retenu : la fenêtre a été fermée ou Chrome a refusé ce dossier. Essaie un autre dossier, par exemple un sous-dossier ordinaire du Drive.' }));
        return;
      }
      dossier.current = d;
      derniereLectureMs.current = 0;
      avertissement.current = erreurMemoire ? `Dossier choisi, mais Chrome ne l’a pas mémorisé (${erreurMemoire}) : il faudra le choisir à nouveau à chaque ouverture.` : null;
      setVue((v) => ({ ...v, nomDossier: d.name, etat: 'actif', erreur: avertissement.current }));
      await autorisation(d, true);
      await cycle();
    } catch (e) {
      setVue((v) => ({ ...v, etat: 'erreur', erreur: e instanceof Error ? `Dossier refusé (${e.name}) : ${e.message}` : 'Dossier refusé par Chrome.' }));
    }
  };
  const autoriser = async (): Promise<void> => {
    if (dossier.current) await autorisation(dossier.current, true);
    derniereLectureMs.current = 0;
    await cycle();
  };
  const renommer = (nom: string): boolean => {
    if (!nomPcValide(nom)) return false;
    const ancien = memoire.current.nomPc;
    if (dossier.current && ancien !== nom) void supprimerFichierPc(dossier.current, ancien);
    memoire.current = { ...memoire.current, nomPc: nom, dernierEnvoi: null, empreinte: null };
    ecrireMemoire(memoire.current);
    setNomPc(nom);
    setDernierEnvoi(null);
    return true;
  };
  const desactiver = async (): Promise<void> => {
    dossier.current = null;
    await oublierDossier().catch(() => undefined);
    avertissement.current = null;
    setVue((v) => ({ ...v, etat: 'sans-dossier', nomDossier: null, erreur: null }));
  };
  const maintenant = async (): Promise<void> => {
    derniereLectureMs.current = 0;
    memoire.current.dernierEnvoi = null;
    await cycle();
  };

  return { etat: vue.etat, dossier: vue.nomDossier, nomPc, dernierEnvoi, derniereLecture: vue.derniereLecture, pcVus: vue.pcVus, ignores: vue.ignores, erreur: vue.erreur, choisir, autoriser, renommer, desactiver, maintenant };
}
