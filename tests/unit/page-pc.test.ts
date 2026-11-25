import { describe, expect, it, vi } from 'vitest';
import { garderPageSynchroPcOuverte } from '../../src/content/pagePc';

describe('garder la page de synchro entre PC ouverte', () => {
  it('demande la page quand les autres PC ne sont plus lus, puis chaque minute', async () => {
    vi.useFakeTimers();
    const demander = vi.fn();
    const arreter = garderPageSynchroPcOuverte(demander, async () => false);
    await vi.advanceTimersByTimeAsync(0);
    expect(demander).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(demander).toHaveBeenCalledTimes(2);
    arreter();
    vi.useRealTimers();
  });
  it('ne demande rien quand la fusion est récente', async () => {
    vi.useFakeTimers();
    const demander = vi.fn();
    const arreter = garderPageSynchroPcOuverte(demander, async () => true);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(demander).not.toHaveBeenCalled();
    arreter();
    vi.useRealTimers();
  });
});
