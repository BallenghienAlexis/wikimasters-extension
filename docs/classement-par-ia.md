# Classer les cartes sans thème avec ton abonnement Claude

Circuit sans clé API ni coût supplémentaire (rattrapage ponctuel) : l’extension exporte les cartes sans thème, tu les fais classer dans Claude, puis tu réimportes le résultat.

1. Extension › Réglages › « Classement par l’IA » › **Exporter les cartes sans thème** : tu obtiens `cartes-sans-theme.json` (id, titre, description courte ; rien du compte).
2. Dans une conversation Claude, colle le prompt ci-dessous, puis joins le fichier (ou colle-le par morceaux d’environ 150 cartes si Claude le demande).
3. Claude répond par un objet JSON `{ "titre": ["theme", …] }`. Enregistre-le dans un fichier `.json` (2 Mo au plus).
4. Extension › Réglages › « Classement par l’IA » › **Importer les thèmes classés**. Les entrées invalides (titre inconnu, thème hors liste, plus de 4 thèmes, liste vide) sont ignorées et comptées ; rien n’est deviné. Les thèmes importés sont gardés par titre, comme ceux de l’API, et ne servent qu’en dernier recours.

## Prompt à coller

```text
Tu classes des cartes d’un jeu de collection dont chaque carte porte le titre d’un article de Wikipédia (personne, œuvre, lieu, objet, notion, animal…).
Pour chaque carte, choisis de 1 à 4 thèmes parmi le catalogue ci-dessous, du plus caractéristique au moins caractéristique.
Règles : réponds d’après le sens du sujet (ce qu’il est, ce qu’il fait), pas d’après les mots du titre ; choisis le thème le plus précis qui existe (« Moto » plutôt que « Véhicule ») ;
n’ajoute pas un thème parent en plus de son thème précis ; n’invente aucun identifiant ; si tu ne reconnais pas le sujet, omets cette carte de ta réponse (jamais de liste vide ni de thème deviné).
Format de réponse : uniquement un objet JSON, sans texte autour, dont les clés sont les TITRES EXACTS des cartes (champ "titre" du fichier) et les valeurs des listes de 1 à 4 identifiants. Exemple : {"Honda CB 900":["moto"],"Morcilla":["gastronomie"]}. Traite le fichier par lots de 150 cartes et donne le JSON complet de chaque lot
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
