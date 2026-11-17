import React from 'react';
import { CONFIG_PRIX } from '../config/prix';
import {
  DERNIERE_MINUTE_MS,
  cartesAAvertir,
  etatTerminee,
  formaterDecompte,
  nombreRelances,
  nonVentesDe,
  cleNonVente,
  PRIX_DEPART_PLANCHER,
  origineDe,
  prolongations,
  resteMs,
  type Origine,
} from '../lib/ventes';
import SectionRepliable from './SectionRepliable';
import { useMiseEnVente } from './useMiseEnVente';

const CLASSE_BOUTON =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded border border-muted bg-ink px-4 text-paper hover:bg-line active:bg-line focus-visible:shadow-(--halo-focus)';

const heureFr = (ms: number): string => {
  if (ms <= 0) return 'jamais';
  const d = new Date(ms);
  const deux = (n: number): string => String(n).padStart(2, '0');
  return `${deux(d.getHours())} h ${deux(d.getMinutes())} min ${deux(d.getSeconds())} s`;
};

const libelleOrigine = (o: Origine): string => (o.type === 'auto' ? 'Relance automatique' : o.type === 'lot' ? `Lot ${o.idLot.slice(0, 6)}` : 'Hors extension');

const LIBELLE_ETAT = { vendue: 'Vendue', 'non-vendue-relancee': 'Non vendue, relancée', 'non-vendue': 'Non vendue', annulee: 'Annulée' } as const;

/**
 * Onglet Mise en vente (Alexis, 2026-11-17) : suivi des enchères en cours (décompte, prolongations, prix), historique des
 * ventes terminées et relance automatique. Aucune requête depuis cette page : la lecture et la relance tournent dans
 * l’onglet WikiMasters visible ; tout est replié par défaut avec un résumé.
 */
const OngletMiseEnVente: React.FC = () => {
  const e = useMiseEnVente();
  const { suivi, lancements, lots, ecartes, relance, statut, maintenant, suiviActif, etatSuivi } = e;
  const max = suivi.max ?? CONFIG_PRIX.maxVentesSimultanees;
  const avertissements = cartesAAvertir(lancements, ecartes, suivi.terminees);
  const retirees = Object.keys(ecartes)
    .filter((c) => c.startsWith('carte:'))
    .map((c) => c.slice('carte:'.length));
  const terminees = suivi.terminees;
  const vendues = terminees.filter((v) => etatTerminee(v, lancements) === 'vendue').length;
  const enDirect = suivi.actives.some((v) => resteMs(v, maintenant) <= DERNIERE_MINUTE_MS);

  return (
    <div className="mt-6 flex flex-col gap-4" data-testid="onglet-mise-en-vente">
      <div className="rounded-xl border border-muted bg-ink-2 p-3" data-testid="synchro-suivi-ventes">
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            checked={suiviActif}
            onChange={(ev) => e.basculerSuivi(ev.target.checked)}
            className="size-5 accent-[var(--color-paper)] focus-visible:shadow-(--halo-focus)"
          />
          <span className="font-bold">Suivi des ventes en cours</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          Synchro séparée de la synchro globale : sa propre cadence (5 min, puis 10 s dans la dernière minute d’une enchère), ses propres pauses et son propre
          interrupteur. Elle n’attend pas la synchro globale et ne la bloque pas ; les deux se partagent seulement le verrou de requête (une requête à la fois vers le site).
          Elle lit tant qu’un onglet WikiMasters est visible, ou à la demande avec « Forcer ».
        </p>
        <p className="mt-2 text-sm" aria-live="polite" data-testid="sante-suivi">
          {!suiviActif ? 'Suivi coupé.' : etatSuivi === null ? 'Suivi en attente du premier passage.' : etatSuivi.message}
          {suiviActif && etatSuivi?.jusqua != null && etatSuivi.jusqua > maintenant ? ` (reprise dans ${formaterDecompte(etatSuivi.jusqua - maintenant)})` : ''}
        </p>
        <p className="mt-1 text-sm text-muted" data-testid="passage-suivi">
          Dernier passage : {etatSuivi?.dernierPassage != null ? heureFr(etatSuivi.dernierPassage) : 'jamais'} · dernière lecture réussie :{' '}
          {etatSuivi?.dernierSucces != null ? heureFr(etatSuivi.dernierSucces) : 'jamais'}
          {suiviActif && enDirect ? ' · cadence 10 s (dernière minute)' : ''}
        </p>
        <div className="mt-2">
          <button type="button" className={CLASSE_BOUTON} onClick={() => e.forcerSuivi()} disabled={!suiviActif} data-testid="forcer-suivi">
            Forcer le suivi
          </button>
          <span className="ml-2 text-sm text-muted">Une lecture tout de suite, sans attendre l’échéance ni l’attente en cours ; elle passe aussi outre la pause de 30 min après un 401 ou un 429 du suivi (le site vient de demander de ralentir : risque assumé). Une par minute au plus ; ni l’anti-bot, ni le verrou de requête, ni la pause des envois ne sont contournés.</span>
        </div>
      </div>

      <div className="rounded-xl border border-muted bg-ink-2 p-3">
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            checked={relance}
            onChange={(ev) => e.basculerRelance(ev.target.checked)}
            className="size-5 accent-[var(--color-paper)] focus-visible:shadow-(--halo-focus)"
          />
          <span className="font-bold">Relance automatique des mises en vente</span>
        </label>
        <p className="mt-1 text-sm text-muted">
          Quand une enchère se termine et qu’une place se libère, l’extension met en vente la carte suivante, sans clic « Lancer » : règle de pré-cochage des Lots
          (favoris, thèmes gardés, amis et cartes « à classer » exclus), les plus chères d’abord, 1 h, au plus {max} enchères en même temps. Une enchère non vendue
          remet sa carte dans la file. Elle fait partie du suivi : elle ne tourne que si le suivi est activé.
        </p>
        <p className="mt-2 text-sm" aria-live="polite" data-testid="statut-relance">
          {statut === null ? 'Relance en attente.' : statut.message}
          {statut?.etat === 'pause' && statut.jusqua !== null && statut.jusqua > maintenant ? ` (reprise dans ${formaterDecompte(statut.jusqua - maintenant)})` : ''}
        </p>
        {statut?.carte != null && statut.carte.essais - (ecartes[`attend:${statut.carte.idExemplaire}`] ?? 0) >= 5 && (
          <div role="alert" className="mt-2 rounded border border-vendre p-2" data-testid="avertissement-ecriture">
            <p className="font-bold">
              La mise en vente de {statut.carte.titre} échoue depuis {statut.carte.essais} essais. Rien n’est arrêté : la relance continue d’attendre.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={CLASSE_BOUTON} onClick={() => e.passerExemplaire(statut.carte!.idExemplaire)}>
                Passer cette carte
              </button>
              <button type="button" className={CLASSE_BOUTON} onClick={() => e.continuerAttendre(statut.carte!.idExemplaire, statut.carte!.essais)}>
                Continuer d’attendre
              </button>
            </div>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          Dernier relevé de la liste : {heureFr(suivi.releveLe)}. Cadence : toutes les 5 min, puis toutes les 10 s dans la dernière minute d’une enchère
          {enDirect ? ' (en cours)' : ''}.
        </p>
        {e.erreur !== null && (
          <p role="alert" className="mt-2 font-semibold text-defausser">
            {e.erreur}
          </p>
        )}
      </div>

      {avertissements.length > 0 && (
        <SectionRepliable
          id="relances-repetees"
          titre="Cartes relancées plusieurs fois"
          resume={`${avertissements.length} ${avertissements.length > 1 ? 'cartes' : 'carte'} à examiner`}
          testId="avertissements-relance"
          ouvertParDefaut
        >
          <p className="text-sm text-muted">Ces cartes reviennent souvent sans se vendre. Rien n’est arrêté : tu choisis.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {avertissements.map((a) => (
              <li key={a.titre} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">
                  {a.titre} : relancée {a.relances} fois
                </span>
                <button type="button" className={CLASSE_BOUTON} onClick={() => e.continuerCarte(a.titre, a.relances)}>
                  Continuer
                </button>
                <button type="button" className={CLASSE_BOUTON} onClick={() => e.retirerCarte(a.titre)}>
                  Retirer de la relance
                </button>
              </li>
            ))}
          </ul>
        </SectionRepliable>
      )}

      <SectionRepliable id="encheres-en-cours" titre="Enchères en cours" resume={`${suivi.actives.length} sur ${max}`} testId="encheres-en-cours">
        {suivi.actives.length === 0 ? (
          <p className="text-sm text-muted">Aucune enchère en cours au dernier relevé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-sm text-muted">
                  {['Carte', 'Origine', 'Départ', 'Prix actuel', 'Décompte', 'Prolongations'].map((c) => (
                    <th key={c} scope="col" className="px-2 py-1 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...suivi.actives]
                  .sort((a, b) => a.finLe - b.finLe)
                  .map((v) => {
                    const reste = resteMs(v, maintenant);
                    const p = prolongations(v);
                    return (
                      <tr key={v.id} className="border-t border-line">
                        <td className="px-2 py-2">{v.titre}</td>
                        <td className="px-2 py-2">{libelleOrigine(origineDe(v, lancements, lots))}</td>
                        <td className="px-2 py-2">{v.prixDepart}</td>
                        <td className="px-2 py-2">
                          {v.prixActuel}
                          {v.avecMise ? ' (mise posée)' : ''}
                        </td>
                        <td className={`px-2 py-2 ${reste <= DERNIERE_MINUTE_MS ? 'font-bold text-vendre' : ''}`}>{formaterDecompte(reste)}</td>
                        <td className="px-2 py-2">{p === 0 ? '–' : `${p} × 60 s`}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          Règle du site : la mise est débitée tout de suite, remboursée si quelqu’un surenchérit, et une mise dans les 10 dernières secondes prolonge la fin de 60 s.
        </p>
      </SectionRepliable>

      <SectionRepliable id="historique-ventes" titre="Historique des ventes" resume={`${terminees.length} terminées, ${vendues} vendues`} testId="historique-ventes">
        {terminees.length === 0 ? (
          <p className="text-sm text-muted">Aucune vente terminée relevée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-sm text-muted">
                  {['Carte', 'Résultat', 'Origine', 'Départ', 'Prix final', 'Relances de la carte', 'Non-ventes de suite', 'Division du prochain départ (état actuel de la carte)'].map((c) => (
                    <th key={c} scope="col" className="px-2 py-1 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {terminees.map((v) => {
                  const etat = etatTerminee(v, lancements);
                  const nv = nonVentesDe(suivi, cleNonVente(v.rarete, v.titre));
                  return (
                    <tr key={v.id} className="border-t border-line">
                      <td className="px-2 py-2">{v.titre}</td>
                      <td className="px-2 py-2">{LIBELLE_ETAT[etat]}</td>
                      <td className="px-2 py-2">{libelleOrigine(origineDe(v, lancements, lots))}</td>
                      <td className="px-2 py-2">{v.prixDepart}</td>
                      <td className="px-2 py-2">{v.prixFinal ?? '–'}</td>
                      <td className="px-2 py-2">{nombreRelances(lancements, v.titre)}</td>
                      <td className="px-2 py-2">{nv}</td>
                      <td className="px-2 py-2">{nv > 0 ? `÷${2 ** nv}` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-sm text-muted">
          Une enchère non vendue est gardée en mémoire : à chaque non-vente de suite, le prix de départ de sa prochaine relance est divisé par deux (1re = ÷2, 2e = ÷4…), jamais sous {PRIX_DEPART_PLANCHER} (plus petit prix observé). Une vente remet le compte à zéro. Les non-ventes antérieures à cette fonction ne sont pas comptées.
        </p>
      </SectionRepliable>

      <SectionRepliable id="lancements-auto" titre="Lancements automatiques" resume={`${lancements.length} ${lancements.length > 1 ? 'lancements' : 'lancement'}`} testId="lancements-auto">
        {lancements.length === 0 ? (
          <p className="text-sm text-muted">Aucun lancement automatique pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {[...lancements].reverse().map((l) => (
              <li key={`${l.le}-${l.titre}`}>
                {heureFr(l.le)} : {l.titre}, départ {l.prix} : {l.resultat === 'reussie' ? 'lancée' : `échec (${l.cause ?? 'cause inconnue'})`}
              </li>
            ))}
          </ul>
        )}
        {retirees.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-bold">Cartes retirées de la relance</p>
            <ul className="mt-1 flex flex-col gap-2">
              {retirees.map((t) => (
                <li key={t} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">{t}</span>
                  <button type="button" className={CLASSE_BOUTON} onClick={() => e.remettreCarte(t)}>
                    Remettre
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionRepliable>
    </div>
  );
};

export default OngletMiseEnVente;
