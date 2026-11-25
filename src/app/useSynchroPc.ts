import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chargerEtatSynchro,
  chargerStatutSynchro,
  chargerPhaseDemarrage,
  chargerSynchroPc,
  ecouterSynchroAuto,
  ecrireDonneesSauvegarde,
  enregistrerPhaseDemarrage,
  enregistrerRelanceSynchro,
  enregistrerSynchroPc,
  ErreurImportSynchroEnCours,
  lireDonneesSauvegarde,
} from '../lib/stockage';
import { PC_PRIORITAIRE_INITIAL } from '../config/synchro';
import type { Donnees } from '../lib/sauvegarde';
import { aDesSaisies, empreinte, empreinteEdition, fusionnerFichiersPc, genererNomPc, instantane, INTERVALLE_ECRITURE_MS, INTERVALLE_LECTURE_MS, nomPcValide, sourceParDefaut, sourcesDisponibles, type FichierIgnore, type SourcePc } from '../lib/synchroPc';
import { autorisation, chargerDossier, choisirDossier, ecrireFichierPc, listerFichiersPc, oublierDossier, supprimerFichierPc, synchroPcDisponible, type Dossier } from './dossierPc';

export type EtatSynchroPc = 'indisponible' | 'sans-dossier' | 'autorisation' | 'actif' | 'erreur';

/** Étapes de la fenêtre de démarrage : PC d'abord, puis le site, puis la sauvegarde dans le Drive. */
export type EtapeDemarrage = 'inactif' | 'lecture' | 'choix' | 'fusion' | 'site' | 'sauvegarde' | 'termine' | 'erreur';

export interface Demarrage {
  etape: EtapeDemarrage;
  sources: SourcePc[];
  /** PC choisi comme source (`null` : ne rien reprendre, garder l'état de ce PC). */
  choisie: string | null;
  message: string | null;
}

export interface SynchroPc {
  demarrage: Demarrage;
  choisirSource: (nom: string | null) => void;
  continuerDemarrage: () => Promise<void>;
  passerSite: () => Promise<void>;
  relancerSite: () => Promise<void>;
  reessayerDemarrage: () => Promise<void>;
  /** Vrai tant que le démarrage obligatoire n'est pas terminé (la fenêtre de démarrage peut alors demander l'autorisation du dossier). */
  demarrageEnCours: boolean;
  /** Avancement lisible de la lecture du site pendant l'étape 2 (null tant que rien n'est lu). */
  progressionSite: string | null;
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
  /** Un dossier est configuré sur ce PC : la relance automatique attend alors une fusion récente. */
  actif: boolean;
  /** Dernière lecture des autres PC (ms) ; lue par le content script. */
  derniereLectureLe: number | null;
  /** Le PC prioritaire (`PC_PRIORITAIRE_INITIAL`) a déjà été proposé par défaut : plus de priorité ensuite, le plus récent est proposé. */
  prioriteInitialeFaite: boolean;
}

const memoireParDefaut = (): Memoire => ({ nomPc: genererNomPc(), dernierEnvoi: null, empreinte: null, edition: null, modifieLe: null, lus: {}, actif: false, derniereLectureLe: null, prioriteInitialeFaite: false });

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
    actif: brut.actif === true,
    derniereLectureLe: typeof brut.derniereLectureLe === 'number' ? brut.derniereLectureLe : null,
    prioriteInitialeFaite: brut.prioriteInitialeFaite === true,
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
  const [demarrage, setDemarrage] = useState<Demarrage>({ etape: 'inactif', sources: [], choisie: null, message: null });
  const demarrageLance = useRef(false);
  const [demarrageEnCours, setDemarrageEnCours] = useState(false);
  const [progressionSite, setProgressionSite] = useState<string | null>(null);
  const etapeRef = useRef<EtapeDemarrage>('inactif');
  const changerEtape = (e: Partial<Demarrage> & Pick<Demarrage, 'etape'>): void => {
    etapeRef.current = e.etape;
    setDemarrage((v) => ({ ...v, message: null, ...e }));
  };


  /** Lecture du dossier : propose les PC sources, le prioritaire (une fois) ou le plus récent par défaut. */
  const preparerDemarrage = async (d: Dossier): Promise<void> => {
    changerEtape({ etape: 'lecture' });
    try {
      if ((await chargerPhaseDemarrage()) === null) await enregistrerPhaseDemarrage('bloque');
      const sources = sourcesDisponibles(await listerFichiersPc(d), memoire.current.nomPc);
      if (sources.length === 0) {
        // Aucun autre PC n'a encore écrit : rien à reprendre, on passe au site.
        await lancerEtapeSite();
        return;
      }
      changerEtape({ etape: 'choix', sources, choisie: sourceParDefaut(sources, memoire.current.prioriteInitialeFaite ? null : PC_PRIORITAIRE_INITIAL) });
    } catch (e) {
      demarrageLance.current = false;
      changerEtape({ etape: 'erreur', message: e instanceof Error ? e.message : 'Lecture du dossier impossible.' });
    }
  };

  /** Étape 2 : lecture du site (forçage, onglet WikiMasters ouvert) ; la fin de la lecture de la collection ouvre l'étape 3. */
  const lancerEtapeSite = async (): Promise<void> => {
    await enregistrerPhaseDemarrage('site');
    changerEtape({ etape: 'site' });
    await enregistrerRelanceSynchro(Date.now());
    debutSite.current = Date.now();
    setProgressionSite(null);
  };
  const debutSite = useRef(0);

  /** Étape 3 : sauvegarde de l'état actuel dans le Drive, puis fin du démarrage. */
  const sauvegarderEtTerminer = async (): Promise<void> => {
    const d = dossier.current;
    if (!d) return;
    changerEtape({ etape: 'sauvegarde' });
    try {
      const m = memoire.current;
      const donnees = await lireDonneesSauvegarde();
      m.edition = empreinteEdition(donnees);
      const maintenant = new Date();
      const texte = instantane(donnees, maintenant, m.modifieLe);
      await ecrireFichierPc(d, m.nomPc, texte);
      m.dernierEnvoi = maintenant.toISOString();
      m.empreinte = empreinte(texte);
      ecrireMemoire(m);
      setDernierEnvoi(m.dernierEnvoi);
      await enregistrerPhaseDemarrage('pret');
      derniereLectureMs.current = 0;
      changerEtape({ etape: 'termine' });
    } catch (e) {
      changerEtape({ etape: 'erreur', message: e instanceof Error ? `Sauvegarde dans le Drive impossible : ${e.message}` : 'Sauvegarde dans le Drive impossible.' });
    }
  };

  const continuerDemarrage = async (): Promise<void> => {
    const d = dossier.current;
    if (!d || etapeRef.current !== 'choix') return;
    const source = demarrage.choisie;
    changerEtape({ etape: 'fusion' });
    try {
      const m = memoire.current;
      if (source !== null) {
        const fichiers = (await listerFichiersPc(d)).filter((f) => f.nom === source);
        const rapport = fusionnerFichiersPc(await lireDonneesSauvegarde(), fichiers, m.nomPc, {}, null, true);
        if (rapport.fusionnes.length === 0) throw new Error(`Le fichier de ${source} est illisible ou introuvable : ${rapport.ignores.map((i) => i.raison).join(' ; ') || 'absent'}.`);
        await ecrireDonneesSauvegarde(rapport.donnees);
        m.edition = empreinteEdition(rapport.donnees);
        m.lus = { ...m.lus, ...rapport.lus };
        onFusionnee(rapport.donnees);
      }
      m.prioriteInitialeFaite = true;
      m.actif = true;
      m.derniereLectureLe = Date.now();
      ecrireMemoire(m);
      await lancerEtapeSite();
    } catch (e) {
      const bail = e instanceof ErreurImportSynchroEnCours;
      changerEtape({ etape: 'erreur', message: bail ? 'Une synchro du site est en cours : attends sa fin, puis réessaie.' : e instanceof Error ? e.message : 'Reprise du dossier impossible.' });
    }
  };

  const verifierSite = useCallback(async (): Promise<void> => {
    if (etapeRef.current !== 'site') return;
    const statut = await chargerStatutSynchro().catch(() => null);
    if (statut && etapeRef.current === 'site') {
      if (statut.etat === 'arret') setProgressionSite('La synchro du site s’est arrêtée (pause du site ou vérification anti-bot) : relance la lecture ou passe cette étape.');
      else if (statut.etat === 'en-cours' && statut.page !== null && statut.pages !== null) setProgressionSite(`Lecture en cours : page ${statut.page} sur ${statut.pages}.`);
      else if (statut.etat === 'en-cours') setProgressionSite('Lecture en cours…');
    }
    const etat = await chargerEtatSynchro().catch(() => null);
    if (etat?.derniereComplete != null && etat.derniereComplete >= debutSite.current) await sauvegarderEtTerminer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (demarrage.etape !== 'site') return undefined;
    void verifierSite();
    const retirer = ecouterSynchroAuto(() => void verifierSite());
    const minuteur = setInterval(() => void verifierSite(), 5_000);
    return () => {
      retirer();
      clearInterval(minuteur);
    };
  }, [demarrage.etape, verifierSite]);

  const cycle = useCallback(async (): Promise<void> => {
    const d = dossier.current;
    if (!d || occupe.current) return;
    occupe.current = true;
    try {
      if ((await autorisation(d, false)) !== 'granted') {
        setDemarrageEnCours((await chargerPhaseDemarrage()) !== 'pret');
        setVue((v) => ({ ...v, etat: 'autorisation' }));
        return;
      }
      const m = memoire.current;
      // Démarrage obligatoire (Alexis, 2026-11-25) : tant que la fenêtre de démarrage n'est pas passée, ni fusion ni envoi automatiques.
      if ((await chargerPhaseDemarrage()) !== 'pret') {
        if (!demarrageLance.current) {
          demarrageLance.current = true;
          await preparerDemarrage(d);
        }
        setVue((v) => ({ ...v, etat: 'actif', erreur: avertissement.current }));
        return;
      }
      const maintenant = new Date();
      // 1. Envoi de ce PC (au plus toutes les 15 s, et seulement si le contenu a changé).
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
      // 2. Lecture des autres PC (au plus toutes les 15 s).
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
        m.actif = true;
        m.derniereLectureLe = Date.now();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!memoire.current.actif) {
          memoire.current.actif = true;
          ecrireMemoire(memoire.current);
        }
        setVue((v) => ({ ...v, nomDossier: d.name, etat: 'actif' }));
        await cycle();
      })
      .catch(() => setVue((v) => ({ ...v, etat: 'erreur', erreur: 'Le dossier mémorisé est illisible : choisis-le à nouveau.' })));
    const minuteur = setInterval(() => void cycle(), 10_000);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [prete, cycle]);

  const choisir = async (): Promise<void> => {
    try {
      const { dossier: d, erreurMemoire, detailAnnulation } = await choisirDossier();
      if (!d) {
        setVue((v) => ({ ...v, erreur: 'Aucun dossier retenu : la fenêtre a été fermée ou Chrome a refusé ce dossier. Essaie un autre dossier, par exemple un sous-dossier ordinaire du Drive (détail renvoyé par Chrome : ' + (detailAnnulation ?? 'aucun') + ').' }));
        return;
      }
      dossier.current = d;
      memoire.current.actif = true;
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
    memoire.current.actif = false;
    ecrireMemoire(memoire.current);
    avertissement.current = null;
    setVue((v) => ({ ...v, etat: 'sans-dossier', nomDossier: null, erreur: null }));
  };
  const maintenant = async (): Promise<void> => {
    derniereLectureMs.current = 0;
    memoire.current.dernierEnvoi = null;
    await cycle();
  };

  const choisirSource = (nom: string | null): void => setDemarrage((v) => ({ ...v, choisie: nom }));
  const passerSite = async (): Promise<void> => {
    if (etapeRef.current === 'site') await sauvegarderEtTerminer();
  };
  const relancerSite = async (): Promise<void> => {
    debutSite.current = Date.now();
    await enregistrerRelanceSynchro(debutSite.current);
  };
  const reessayerDemarrage = async (): Promise<void> => {
    demarrageLance.current = false;
    changerEtape({ etape: 'lecture' });
    await cycle();
  };

  return { demarrage, choisirSource, continuerDemarrage, passerSite, relancerSite, reessayerDemarrage, demarrageEnCours, progressionSite, etat: vue.etat, dossier: vue.nomDossier, nomPc, dernierEnvoi, derniereLecture: vue.derniereLecture, pcVus: vue.pcVus, ignores: vue.ignores, erreur: vue.erreur, choisir, autoriser, renommer, desactiver, maintenant };
}
