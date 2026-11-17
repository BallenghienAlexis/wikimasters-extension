# Classer les cartes sans thème avec ton abonnement Claude

Circuit sans clé API ni coût supplémentaire (rattrapage ponctuel) : l’extension exporte les cartes sans thème, tu les fais classer dans Claude, puis tu réimportes le résultat.

1. Extension › Réglages › « Classement par l’IA » › **Exporter les cartes sans thème** : tu obtiens un ou plusieurs fichiers `cartes-sans-theme*.json` (150 cartes au plus chacun, par exemple `cartes-sans-theme-1-sur-4.json`) : un objet `{ "prompt": …, "cartes": [id, titre, description courte] }` (rien du compte). Le prompt, avec le catalogue de thèmes et le format de réponse, est **dans chaque fichier**.
2. Dans une conversation Claude (ou autre IA), joins **un fichier par message**, tel quel, sans rien écrire d’autre : l’IA suit le prompt qu’il contient et répond par un seul bloc de code JSON (ou un fichier `classement.json`). Le prompt ci-dessous n’est donné qu’à titre de référence (ou si l’IA refuse les pièces jointes : colle-le avec les cartes).
3. Dans l’extension, **colle la réponse** dans la zone « Ou colle ici la réponse de l’IA » puis « Importer le texte collé » (à répéter pour chaque réponse), ou choisis le ou les fichiers avec « Importer les thèmes classés » (plusieurs à la fois, 2 Mo au plus chacun). Le texte autour, un bloc de code ou plusieurs objets sont tolérés ; le titre est retrouvé malgré l’apostrophe ’, la casse ou les espaces.
4. Les entrées invalides (titre inconnu, thème hors liste, plus de 4 thèmes, liste vide) sont ignorées et comptées ; rien n’est deviné. Les pages d’homonymie, noms de famille, prénoms et sujets inconnus sont omis par l’IA et restent « à classer » : c’est voulu (jamais « Autres » ni « À classer » posé). Les thèmes importés sont gardés par titre, comme ceux de l’API, et ne servent qu’en dernier recours.

## Prompt à coller

```text
Tu classes des cartes d’un jeu de collection dont chaque carte porte le titre d’un article de Wikipédia (personne, œuvre, lieu, objet, notion, animal…). Tu reçois un fichier avec une liste "cartes" (id, titre, description courte).
Pour chaque carte, choisis de 1 à 4 thèmes parmi le catalogue ci-dessous, du plus caractéristique au moins caractéristique.
Règles : appuie-toi sur la description quand il y en a une, puis sur ce que le sujet est réellement (pas sur les mots du titre) ; choisis le thème le plus précis qui existe (« Moto » plutôt que « Véhicule ») ;
n’ajoute pas un thème parent en plus de son thème précis ; n’invente aucun identifiant ; une liste, une année (« 2013 en Bulgarie »), une résolution, une commune ou un établissement ont un sujet : classe-les.
À omettre (ne les écris pas dans la réponse) : pages d’homonymie, noms de famille, prénoms, et sujets que tu ne reconnais pas avec certitude. Ces cartes restent « à classer » dans l’extension, c’est voulu. Jamais de liste vide, jamais de thème deviné, jamais de thème « À classer » ni « Autres ».
Format de réponse : ta réponse entière est UN SEUL bloc de code JSON (```json … ```), sans aucune phrase avant ou après, sans explication ni liste des cartes omises. Si tu peux créer un fichier téléchargeable, donne-le sous le nom classement.json avec le même contenu.
Ce bloc est un unique objet dont les clés sont les TITRES EXACTS des cartes (champ "titre", recopié caractère pour caractère) et les valeurs des listes de 1 à 4 identifiants. Exemple : {"Honda CB 900":["moto"],"Morcilla":["gastronomie"]}.
Traite toutes les cartes du fichier dans cette seule réponse (il en contient 150 au plus), sans la couper en plusieurs messages.
Catalogue (identifiant : libellé) :
vehicule : Véhicule
automobile : Automobile
voiture : Voiture
moto : Moto
camion : Camion
bus : Bus
tracteur : Tracteur
train : Train
avion : Avion
bateaux : Bateaux
course : Course
formule1 : Formule 1
nascar : Nascar
rallye : Rallye
musique : Musique
rock : Rock
poprock : Pop Rock
pop : Pop
metal : Métal
metalcore : Metalcore
grunge : Grunge
jazz : Jazz
techno : Techno
rap : Rap
classique : Musique classique
histoire : Histoire
guerre : Guerre
nazis : Nazis
politique : Politique
royaute : Royauté
sciences : Sciences
physique : Physique
espace : Espace
sante : Santé
technologie : Technologies
informatique : Informatique
jeuvideo : Jeu vidéo
nature : Nature
animaux : Animaux
plantes : Plantes
gastronomie : Gastronomie
geographie : Géographie
pays : Pays
ville : Ville
arts : Art
architecture : Architecture
cinema : Cinéma
television : Télévision
litterature : Littérature
bd : BD et Manga
langue : Langue
idees : Philosophie
religion : Religion
sport : Sport
football : Football
hockey : Hockey
cyclisme : Cyclisme
combat : Arts martiaux
societe : Société
crime : Crime
chien : Chien
chat : Chat
cheval : Cheval
felin : Félin
ours : Ours
singe : Singe
cetace : Cétacé
requin : Requin
serpent : Serpent
rapace : Rapace
dinosaure : Dinosaure
insecte : Insecte
papillon : Papillon
araignee : Araignée
pont : Pont
tunnel : Tunnel
tour : Tour
chateau : Château
cathedrale : Cathédrale
phare : Phare
barrage : Barrage
gratteciel : Gratte-ciel
sexualite : Sexualité
pornographie : Pornographie
drogue : Drogue
jeux : Jeux
mode : Mode
danse : Danse
armes : Armes
ecologie : Écologie
finance : Finance
education : Éducation
tibet : Tibet
ukraine : Ukraine
montagne : Montagne
volcan : Volcan
ile : Île
fleuve : Fleuve
lac : Lac
desert : Désert
ocean : Océan
planete : Planète
etoile : Étoile
galaxie : Galaxie
comete : Comète
fusee : Fusée
arbre : Arbre
fleur : Fleur
champignon : Champignon
fromage : Fromage
vin : Vin
biere : Bière
alcool : Alcool
boisson : Boissons
fruit : Fruit
dessert : Dessert
tennis : Tennis
rugby : Rugby
basketball : Basketball
ski : Ski
golf : Golf
natation : Natation
velo : Vélo
egypteantique : Égypte antique
romeantique : Rome antique
greceantique : Grèce antique
moyenage : Moyen Âge
prehistoire : Préhistoire
premiereguerre : Première Guerre mondiale
secondeguerre : Seconde Guerre mondiale
mythologie : Mythologie
superheros : Super-héros
```
