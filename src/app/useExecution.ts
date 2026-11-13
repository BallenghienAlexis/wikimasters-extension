import { useEffect, useState } from 'react';
import type { EntreeJournal, Registre } from '../lib/actions';
import type { EtatFile } from '../lib/file';
import { chargerEtatSynchro, chargerExecution, chargerJournal, chargerRegistre } from '../lib/stockage';
import type { Bilan } from './apercuLot';
import { contexteExecution } from './pilotageLots';

export interface EtatExec {
  etat: EtatFile;
  bilan: Bilan;
  deconnecte: boolean;
}

/** Abonnements à l’exécution (file, onglets), au journal, au registre et aux ventes du site. */
export function useExecution() {
  const [exec, setExec] = useState<EtatExec | null>(null);
  const [interrompu, setInterrompu] = useState(false);
  const [fermee, setFermee] = useState(false);
  const [ongletsLive, setOngletsLive] = useState<number | null>(null);
  /** État d’exécution relu au montage : `null` tant que la page n’a pas vérifié. */
  const [enCoursStocke, setEnCoursStocke] = useState<boolean | null>(null);
  // Enchères en cours sur le site (relevé de la synchronisation), pour ne pas dépasser le plafond du site.
  const [ventesSiteLues, setVentesSiteLues] = useState<{ enCours: number; max: number } | null>(null);
  useEffect(() => {
    let actif = true;
    void chargerEtatSynchro()
      .then((e) => {
        if (actif && e?.ventesSite) setVentesSiteLues({ enCours: e.ventesSite.enCours, max: e.ventesSite.max });
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);
  const [entrees, setEntrees] = useState<EntreeJournal[]>([]);
  const [journalIllisible, setJournalIllisible] = useState(false);
  const [registreMaj, setRegistreMaj] = useState<Registre | null>(null);

  useEffect(() => {
    let actif = true;
    const ctx = contexteExecution();
    const relire = async (): Promise<void> => {
      try {
        const j = await chargerJournal();
        if (actif) {
          setEntrees(j);
          setJournalIllisible(false);
        }
      } catch {
        if (actif) setJournalIllisible(true);
      }
      try {
        const r = await chargerRegistre();
        if (actif) setRegistreMaj(r);
      } catch {
        /* le registre reste celui de la page */
      }
    };
    const majOnglets = (): void => setOngletsLive(ctx.execution.nbOngletsWikiMasters());
    majOnglets();
    const desabonnerOnglets = ctx.execution.abonner(majOnglets);
    const publier = (etat: EtatFile): void => {
      setExec({ etat, bilan: { ...ctx.pont.bilan }, deconnecte: ctx.pont.deconnecte });
      void relire();
    };
    const desabonnerFile = ctx.file.abonner(publier);
    const courant = ctx.file.etat();
    if (courant) publier(courant);
    void relire();
    void (async () => {
      const avant = await chargerExecution().catch(() => null);
      await ctx.execution.cloreInterrompues().catch(() => {});
      const apres = await chargerExecution().catch(() => null);
      if (!actif) return;
      if (avant?.etat === 'en-cours' && apres?.etat === 'arretee') setInterrompu(true);
      setEnCoursStocke(apres?.etat === 'en-cours');
    })();
    return () => {
      actif = false;
      desabonnerOnglets();
      desabonnerFile();
    };
  }, []);

  return {
    exec,
    setExec,
    interrompu,
    setInterrompu,
    fermee,
    setFermee,
    ongletsLive,
    enCoursStocke,
    ventesSiteLues,
    entrees,
    setEntrees,
    journalIllisible,
    setJournalIllisible,
    registreMaj,
  };
}
