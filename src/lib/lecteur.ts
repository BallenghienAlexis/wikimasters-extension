// Identifiants et raretés des cartes, partagés avec la lecture de l’API (la lecture du texte des pages a été retirée le 2026-11-14).
export const RARETES = ['L', 'UR', 'SR', 'R', 'PC', 'C'];

export const identifiantCarte = (rarete: string, titre: string): string => `${rarete}|${titre}`;
