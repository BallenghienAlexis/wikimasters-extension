import { describe, expect, it } from 'vitest';
import { estDiagnosticPrix, journaliserDiagnostic } from '../../src/content/synchroAuto';

describe('diagnostic des prix dans le journal', () => {
  it('ne retient que les messages de diagnostic des prix', () => {
    expect(estDiagnosticPrix('Diagnostic prix : refus pour « A » à la demande n° 31, 8 s après la première.')).toBe(true);
    expect(estDiagnosticPrix('Prix indisponible (réponse 403) pour « A » : carte ignorée (1/3 refus d’affilée).')).toBe(true);
    expect(estDiagnosticPrix('Pause de 60 s après 30 prix demandés (limite de débit supposée).')).toBe(true);
    expect(estDiagnosticPrix('Échec 1/3 d’affilée : Requête impossible (réseau).')).toBe(true);
    expect(estDiagnosticPrix('Ventes : lecture ignorée (réponse non exploitable), la synchro continue.')).toBe(true);
    expect(estDiagnosticPrix('Page 3 lue')).toBe(false);
  });

  it('écrit le diagnostic au journal, sans rien d’autre', async () => {
    const ecrits: Array<{ titre: string; parametre: string | null }> = [];
    const ecrire = async (e: { titre: string; parametre: string | null }): Promise<void> => {
      ecrits.push(e);
    };
    journaliserDiagnostic('Pause de 60 s après 30 prix demandés (limite de débit supposée).', ecrire as never);
    journaliserDiagnostic('Page 3 lue', ecrire as never);
    await new Promise((r) => setTimeout(r, 0));
    expect(ecrits).toHaveLength(1);
    expect(ecrits[0]?.parametre).toContain('Pause de 60 s');
  });
});
