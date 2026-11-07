// Content script : lit la page de collection ouverte par le joueur et y affiche ses décisions.
// Il ne clique sur rien, n'envoie rien et ne change pas de page : le joueur reste aux commandes.
import { LIBELLES_STATUT, type Carte, type Collection } from '../lib/collection';
import { identifiantCarte, lireFenetreEnchere, lirePositionPage, regrouperCartes, trouverCartes } from '../lib/lecteur';
import { chargerCollection, ecouterCollection, enregistrerPage, enregistrerValeur, fusionnerDansStockage } from '../lib/stockage';
import { demarrerExecutant } from './executant';
import { progression, texteProgression, type Synchro } from '../lib/synchro';

const CLASSE_REPERE = 'wm-repere';
const CLASSE_SYNCHRO = 'wm-synchro';
const DELAI_MS = 400;

const texteRepere = (carte: Carte): string | null => {
  if (carte.statut === 'a-trier') return null;
  const prix = carte.prixCible === null ? '' : ` · ${carte.prixCible}`;
  const ami = carte.ami === null ? '' : ` · ${carte.ami}`;
  return `${LIBELLES_STATUT[carte.statut]}${ami}${prix}`;
};

function afficherReperes(collection: Collection): void {
  const parId = new Map(collection.cartes.map((c) => [c.id, c]));
  for (const { element, carte } of trouverCartes(document)) {
    const suivie = parId.get(identifiantCarte(carte.rarete, carte.titre));
    const texte = suivie ? texteRepere(suivie) : null;
    const repere = element.querySelector<HTMLElement>(`:scope > .${CLASSE_REPERE}`);
    if (!suivie || !texte) {
      repere?.remove();
      continue;
    }
    const cible = repere ?? element.appendChild(document.createElement('span'));
    const classe = `${CLASSE_REPERE} ${CLASSE_REPERE}-${suivie.statut}`;
    if (cible.className !== classe) cible.className = classe;
    // Affiché par le CSS : un texte réel se mêlerait à celui de la carte lors de la lecture.
    if (cible.dataset.wmTexte !== texte) cible.dataset.wmTexte = texte;
  }
}

// Reste visible pendant que le joueur tourne les pages.
function afficherSynchro(synchro: Synchro): void {
  const indicateur = document.querySelector<HTMLElement>(`.${CLASSE_SYNCHRO}`) ?? document.body.appendChild(document.createElement('div'));
  indicateur.className = CLASSE_SYNCHRO;
  indicateur.dataset.wmTexte = `WM Collection · ${texteProgression(progression(synchro))}`;
}

async function lirePage(): Promise<void> {
  if (location.pathname !== '/collection' && !location.pathname.startsWith('/collection/')) return;
  const cartes = trouverCartes(document).map(({ carte }) => carte);
  if (cartes.length > 0) {
    afficherReperes(await fusionnerDansStockage(regrouperCartes(cartes)));
    const position = lirePositionPage(document);
    if (position) afficherSynchro(await enregistrerPage(position.cle, position.pagination));
  }
  // Fenêtre ouverte par le joueur : on relève la moyenne, sans jamais la valider.
  const lue = lireFenetreEnchere(document);
  if (lue) await enregistrerValeur(lue.id, lue.valeur);
}

const estRepere = (noeud: Node): boolean =>
  noeud instanceof Element && (noeud.classList.contains(CLASSE_REPERE) || noeud.classList.contains(CLASSE_SYNCHRO));

let minuteur: ReturnType<typeof setTimeout> | undefined;
const planifierLecture = (): void => {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => void lirePage().catch(() => undefined), DELAI_MS);
};

// Nos propres repères ne doivent pas relancer une lecture.
new MutationObserver((mutations) => {
  const venantDuSite = mutations.some(
    (m) => !estRepere(m.target) && ![...m.addedNodes, ...m.removedNodes].every(estRepere),
  );
  if (venantDuSite) planifierLecture();
}).observe(document.body, { childList: true, subtree: true, characterData: true });

ecouterCollection(afficherReperes);
void chargerCollection().then(afficherReperes);
planifierLecture();
// Pilotage depuis la page de gestion : aucune requête tant qu'aucune action n'est branchée.
demarrerExecutant();
