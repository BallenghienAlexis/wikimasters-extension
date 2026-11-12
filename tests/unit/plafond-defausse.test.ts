import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PlafondDefausse from '../../src/app/PlafondDefausse';

const rendu = (plafond: number): string => renderToStaticMarkup(React.createElement(PlafondDefausse, { plafond, onChange: () => {} }));

describe('PlafondDefausse', () => {
  it('affiche le plafond, les bornes 1 à 20 et un champ numérique', () => {
    const html = rendu(5);
    expect(html).toContain('value="5"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="20"');
  });

  it('n’avertit pas à 5 ou moins', () => {
    expect(rendu(5)).not.toContain('Attention');
    expect(rendu(1)).not.toContain('Attention');
  });

  it('avertit au-dessus de 5', () => {
    expect(rendu(6)).toContain('Attention');
    expect(rendu(20)).toContain('Attention');
  });
});
