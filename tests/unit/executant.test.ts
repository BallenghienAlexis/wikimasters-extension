import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Action, ResultatAction } from '../../src/lib/actions';
import { demarrerExecutant } from '../../src/content/executant';

type Ecouteur<T> = (valeur: T) => void;

function fauxPort() {
  const surMessage: Ecouteur<unknown>[] = [];
  const surDeconnexion: Ecouteur<void>[] = [];
  const envoyes: unknown[] = [];
  return {
    envoyes,
    postMessage: (m: unknown) => void envoyes.push(m),
    disconnect: () => surDeconnexion.forEach((f) => f()),
    onMessage: { addListener: (f: Ecouteur<unknown>) => void surMessage.push(f) },
    onDisconnect: { addListener: (f: Ecouteur<void>) => void surDeconnexion.push(f) },
    recevoir: (m: unknown) => surMessage.forEach((f) => f(m)),
  };
}

const ordreValide: Action = { type: 'lecture', idCarte: 'Rare|Carte' };
const attendre = () => new Promise((r) => setTimeout(r, 0));

let port: ReturnType<typeof fauxPort>;
let connect: ReturnType<typeof vi.fn>;
let changements: Array<(c: Record<string, unknown>, zone: string) => void>;
const fenetre = Object.assign(new EventTarget(), { postMessage: vi.fn() });

beforeEach(() => {
  port = fauxPort();
  connect = vi.fn(() => port);
  changements = [];
  const g = globalThis as unknown as Record<string, unknown>;
  g.chrome = {
    runtime: { connect },
    storage: { onChanged: { addListener: (f: never) => changements.push(f), removeListener: vi.fn() } },
  };
  g.window = fenetre;
  g.fetch = vi.fn();
});

afterEach(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.chrome;
  delete g.window;
  delete g.fetch;
});

describe('executant (content script)', () => {
  it('ouvre un port et envoie « bonjour »', () => {
    demarrerExecutant();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(port.envoyes).toEqual([{ message: 'bonjour' }]);
  });

  it('rejette un ordre invalide sans appeler emettre', async () => {
    const emettre = vi.fn();
    demarrerExecutant({ emettre });
    port.recevoir({ message: 'ordre', ordre: { type: 'inconnu', idCarte: 'x' } });
    port.recevoir({ message: 'ordre', ordre: { ...ordreValide, extra: 1 } });
    port.recevoir('n’importe quoi');
    await attendre();
    expect(emettre).not.toHaveBeenCalled();
    expect(port.envoyes).toHaveLength(1);
  });

  it('ordre valide : emettre par défaut → « action non disponible », aucun fetch', async () => {
    demarrerExecutant();
    port.recevoir({ message: 'ordre', ordre: ordreValide });
    await attendre();
    expect(port.envoyes[1]).toEqual({
      message: 'resultat',
      resultat: { classe: 'echec', codeHttp: null, cause: 'action non disponible' },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('ordre valide : appelle emettre injecté et renvoie son résultat', async () => {
    const resultat: ResultatAction = { classe: 'reussie', codeHttp: 200, cause: 'ok' };
    const emettre = vi.fn(async () => resultat);
    demarrerExecutant({ emettre });
    port.recevoir({ message: 'ordre', ordre: ordreValide });
    await attendre();
    expect(emettre).toHaveBeenCalledWith(ordreValide);
    expect(port.envoyes[1]).toEqual({ message: 'resultat', resultat });
  });

  it('si emettre lève, renvoie un résultat « inconnu » sans fuite du message d’erreur', async () => {
    demarrerExecutant({
      emettre: async () => {
        throw new Error('secret-interne');
      },
    });
    port.recevoir({ message: 'ordre', ordre: ordreValide });
    await attendre();
    const envoye = JSON.stringify(port.envoyes[1]);
    expect(envoye).toContain('"classe":"inconnu"');
    expect(envoye).not.toContain('secret-interne');
  });

  it('ignore un window.postMessage ou un CustomEvent portant un ordre valide', async () => {
    const emettre = vi.fn();
    demarrerExecutant({ emettre });
    const message = { message: 'ordre', ordre: ordreValide };
    fenetre.dispatchEvent(new MessageEvent('message', { data: message }));
    fenetre.dispatchEvent(new CustomEvent('ordre', { detail: message }));
    fenetre.postMessage(message, '*');
    await attendre();
    expect(emettre).not.toHaveBeenCalled();
  });

  it('le source n’écoute ni window ni événement de la page, ne clique pas', () => {
    const source = readFileSync('src/content/executant.ts', 'utf8');
    expect(source).not.toMatch(/addEventListener|\.click\(|\.focus\(|dispatchEvent|localStorage|document\.cookie/);
  });

  it('un contexte orphelin (connect lève) ne fait pas planter le content script', () => {
    connect.mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    expect(() => demarrerExecutant()).not.toThrow();
  });

  it('se reconnecte au signal de synchro si le port est fermé, pas sinon', () => {
    demarrerExecutant();
    const signal = { signalSynchro: { newValue: 1 } };
    changements.forEach((f) => f(signal, 'local'));
    expect(connect).toHaveBeenCalledTimes(1);
    port.disconnect();
    port = fauxPort();
    changements.forEach((f) => f(signal, 'local'));
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
