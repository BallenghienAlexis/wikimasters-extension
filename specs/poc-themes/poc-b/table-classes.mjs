// Table de correspondance : classe ou métier Wikidata → thème(s) du catalogue de src/lib/themes.ts.
// « theme:0.5 » = correspondance faible (poids 0,5). Les QID viennent du graphe récolté pour le jeu de test ;
// ceux marqués (?) n’ont pas pu être vérifiés dans la récolte (à contrôler sur le PC avec verifier-table.mjs).
export const TABLE = {
  // ---- Musique ----
  Q177220: ['musique'], Q639669: ['musique'], Q36834: ['musique'], Q855091: ['musique'], Q753110: ['musique'], Q488205: ['musique'],
  Q486748: ['musique'], Q12377274: ['musique'], Q806349: ['musique:0.6'], Q183945: ['musique:0.6'], Q158852: ['classique'],
  Q215380: ['musique'], Q2088357: ['musique'], Q5741069: ['rock'], Q71129815: ['techno'], Q482994: ['musique'], Q105543609: ['musique'],
  Q7366: ['musique'], Q134556: ['musique'], Q188451: ['musique'], Q373342: ['musique'], Q638: ['musique'], Q115484611: ['musique'],
  Q11399: ['rock'], Q83270: ['rock'], Q49451: ['rock'], Q76092: ['rock'], Q11366: ['rock'], Q11365: ['grunge'], Q483352: ['metal'], Q38848: ['metal'],
  Q183862: ['metalcore'], Q8341: ['jazz'], Q37073: ['pop'], Q11401: ['rap'], Q2252262: ['rap'], Q20502: ['techno'], Q9778: ['techno'],
  Q9759: ['blues'], Q3071: ['punk'], Q132438: ['metal'], Q7749: ['rock'], Q9794: ['reggae'], Q83440: ['countrymusique'], Q9730: ['classique'], // (?) blues, punk rock, reggae, country, classique
  // ---- Cinéma, télévision, animation, livres, BD, jeux ----
  Q11424: ['cinema'], Q2526255: ['cinema'], Q3455803: ['cinema'], Q3282637: ['cinema'], Q28389: ['cinema:0.7'], Q33999: ['cinema:0.5'], Q10800557: ['cinema'],
  Q130371093: ['cinema'], Q1762059: ['cinema'], Q1415395: ['cinema'], Q202866: ['animation'], Q20650540: ['animation'], Q1107679: ['animation'], Q1107: ['animation'], Q266569: ['animation'],
  Q5398426: ['television'], Q15416: ['television'], Q947873: ['television'],
  Q7725634: ['litterature'], Q571: ['litterature'], Q36180: ['litterature'], Q482980: ['litterature:0.7'], Q6625963: ['litterature'], Q7058673: ['jeuvideo'], Q1667921: ['litterature'],
  Q49757: ['poesie'], Q482: ['poesie'], Q214917: ['theatre'], Q116476516: ['theatre'], Q2259451: ['theatre'], Q80930: ['theatre'],
  Q1004: ['bd'], Q8274: ['bd'], Q21198342: ['bd'], Q14406742: ['bd'], Q191633: ['bd'], Q11892507: ['bd'], Q1114461: ['bd'], Q14831768: ['superheros'], Q2516866: ['bd:0.4'],
  Q7889: ['jeuvideo'], Q192851: ['jeuvideo'], Q112144412: ['jeuvideo:0.5'],
  Q131436: ['jeux'], Q734698: ['jeux'], Q11410: ['jeux'], Q7858742: ['jeux'],
  // ---- Informatique, sciences ----
  Q82594: ['informatique'], Q5482740: ['informatique'], Q7397: ['informatique'], Q899523: ['informatique'], Q241317: ['informatique'], Q137396449: ['informatique'], Q33120876: ['informatique'],
  Q123370638: ['informatique:0.6'], Q20514253: ['finance:0.7'],
  Q169470: ['physique'], Q19350898: ['physique'], Q173227: ['physique'], Q1293220: ['physique'], Q104934: ['physique'], Q37547: ['physique:0.5'],
  Q593644: ['chimie'], Q11344: ['chimie'], Q732744: ['chimie'], Q170790: ['mathematiques'], Q65943: ['mathematiques'],
  Q864503: ['biologie'], Q3779582: ['biologie'], Q2996394: ['biologie'], Q212980: ['psychologie'], Q3410028: ['psychologie'], Q41630: ['psychologie'],
  Q11631: ['espace'], Q11063: ['espace'], Q17505024: ['espace'], Q8928: ['espace'], Q634: ['planete'], Q3504248: ['planete'], Q523: ['etoile'], Q318: ['galaxie'], Q3863: ['espace'],
  Q12140: ['sante'], Q112193867: ['sante'], Q783906: ['sante'], Q186360: ['sante:0.6'], Q81096: ['technologie:0.7'], Q4964182: ['idees'], Q5891: ['idees'],
  // ---- Politique, histoire, guerre, crime, royauté ----
  Q82955: ['politique'], Q372436: ['politique'], Q7278: ['politique'], Q2973931: ['politique'], Q7163: ['politique'], Q245065: ['politique'], Q1307214: ['politique'], Q12909644: ['politique'],
  Q1156854: ['politique'], Q28108: ['politique:0.6'], Q3002772: ['politique'], Q8461: ['societe'], Q1641112: ['societe:0.6'], Q49773: ['societe:0.6'],
  Q47064: ['guerre'], Q189290: ['guerre'], Q4991371: ['guerre'], Q178561: ['guerre'], Q348120: ['guerre'], Q864113: ['guerre'], Q772547: ['guerre'], Q207320: ['guerre'], Q15627509: ['guerre'], Q180684: ['guerre:0.5'],
  Q8465: ['guerrecivile'], Q328468: ['nazis'], Q153813: ['nazis'], Q7310: ['nazis'], Q177716: ['nazis:0.6', 'crime:0.6'],
  Q931260: ['crime'], Q484188: ['crime'], Q1788992: ['crime'], Q179216: ['crime'], Q20725072: ['crime'], Q16266378: ['crime'], Q2543769: ['drogue', 'crime'], Q844924: ['drogue'],
  Q116: ['royaute'], Q39018: ['royaute'], Q2304859: ['royaute'], Q13418847: ['histoire'], Q47018478: ['histoire'], Q11514315: ['histoire:0.5'],
  Q7362268: ['romeantique'], Q267596: ['greceantique'], Q22989102: ['mythologie'], Q842697: ['mythologie'],
  Q9174: ['religion'], Q6957341: ['religion'], Q1234713: ['religion'], Q15995642: ['religion'], Q854997: ['bouddhisme'], Q611644: ['christianisme'], Q250867: ['christianisme'], Q725440: ['christianisme'], Q219477: ['religion'],
  // ---- Sujets eux-mêmes (le QID de la carte, ou un « partie de » / pays) ----
  Q748: ['bouddhisme'], Q432: ['islam'], Q9268: ['judaisme'], Q5043: ['christianisme'], Q8740: ['guerrevietnam'], Q8683: ['guerrefroide'], Q517: ['napoleon'], Q12546: ['croisades'],
  Q362: ['secondeguerre'], Q361: ['premiereguerre'], Q7318: ['nazis'], Q212: ['ukraine'], // (?) Q5043, Q362, Q361, Q7318 non vérifiés dans la récolte
  // ---- Taxons (chaîne P171) ----
  Q25265: ['felin'], Q160: ['cetace'], Q25371: ['requin:0.7'], Q16986904: ['serpent'], Q21736: ['rapace'], Q5113: ['oiseau'], Q430: ['dinosaure'], Q131396: ['dinosaure'], Q1390: ['insecte'], Q28319: ['papillon'],
  Q1357: ['araignee'], Q7380: ['singe'], Q11788: ['ours'], Q144: ['chien'], Q146: ['chat'], Q1160573: ['cheval'], Q127282: ['poisson'], Q9394365: ['poisson'], Q12004: ['arbre'], Q764: ['champignon'], Q221448: ['champignon'], Q7377: ['animaux:0.5'], Q729: ['animaux:0.5'],
  Q756153: ['papillon'], // (?) Q430, Q1390, Q28319, Q1357, Q127282 : à confirmer
  // ---- Ajouts guidés par la fréquence des classes non couvertes dans l'export réel (1 077 cartes tirées de la collection), sans regarder les cartes de référence ----
  Q532: ['ville'], Q486972: ['ville'], Q15284: ['ville'], Q3558970: ['ville'], Q123964505: ['ville'], Q498162: ['ville'], Q17343829: ['ville'], Q116457956: ['ville'], Q747074: ['ville'], Q3184121: ['ville'], Q1802801: ['ville'],
  Q667509: ['ville'], Q2074737: ['ville'], Q5153359: ['ville'], Q3266850: ['ville'], Q1852859: ['ville'], Q1115575: ['ville:0.7'], Q4976993: ['ville:0.7'],
  Q14757767: ['geographie'], Q12357920: ['geographie'], Q12357832: ['geographie'], Q15042037: ['geographie'], Q1048835: ['geographie'], Q56061: ['geographie'], Q11618417: ['geographie'], Q192498: ['geographie'], Q4835091: ['geographie:0.6'], Q192611: ['politique'],
  Q41466: ['hockey'], Q11774891: ['hockey'], Q5849: ['rugby'], Q14089670: ['rugby'], Q212434: ['sport:0.6'],
  Q201788: ['histoire'], Q3621491: ['histoire:0.7'], Q1622272: ['education:0.5'], Q5428874: ['education:0.4'], Q37226: ['education:0.5'], Q901: ['sciences:0.6'], Q1650915: ['sciences:0.5'],
  Q16970: ['christianisme', 'architecture:0.6'], Q24398318: ['religion'], Q44539: ['religion'], Q831474: ['christianisme'], Q191808: ['christianisme'], Q733786: ['religion'], Q140909609: ['christianisme:0.6'],
  Q5633421: ['sciences'], Q591041: ['sciences:0.7'], Q737498: ['sciences'], Q35127: ['informatique'], Q3427877: ['informatique:0.6'], Q17376908: ['langue'],
  Q55488: ['train'], Q695850: ['guerre', 'avion:0.6'], Q62447: ['avion'], Q245016: ['guerre'], Q645883: ['guerre'], Q350604: ['guerre'],
  Q473972: ['nature'], Q46169: ['nature'], Q46831: ['montagne'], Q90834785: ['courseauto'], Q29048322: ['vehicule:0.6'], Q131569: ['politique:0.6'],
  Q2385804: ['education'], Q5341295: ['education'], Q2085381: ['litterature:0.5'],
  // ---- Sport ----
  Q349: ['sport'], Q2312410: ['sport'], Q14547231: ['sport'], Q16510064: ['sport'], Q2066131: ['sport:0.6'],
  Q937857: ['football'], Q476028: ['football'], Q2736: ['football'], Q3665646: ['basketball'], Q13393265: ['basketball'], Q5372: ['basketball'],
  Q10871364: ['baseball'], Q5369: ['baseball'], Q10833314: ['tennis'], Q847: ['tennis'], Q11513337: ['athletisme'], Q542: ['athletisme'],
  Q10843402: ['natation'], Q31920: ['natation'], Q490253: ['golf'], Q12840545: ['handball'], Q8418: ['handball'],
  Q2309784: ['cyclisme'], Q3609: ['cyclisme'], Q53121: ['cyclisme'], Q2215841: ['cyclisme'], Q33881: ['cyclisme'],
  Q11338576: ['combat'], Q32112: ['combat'], Q10841764: ['formule1'], Q10349745: ['courseauto'], Q5386: ['courseauto'], Q1805420: ['courseauto'], Q10873124: ['echecs'],
  // ---- Transports et armes ----
  Q137735383: ['train'], Q811704: ['train'], Q728937: ['train'], Q3231690: ['voiture'], Q786820: ['automobile'], Q21546143: ['camion'], Q59569: ['camion'], Q23866334: ['moto'],
  Q15056993: ['avion'], Q15056995: ['avion'], Q20031543: ['avion'], Q20026879: ['avion'], Q20027951: ['avion'], Q46970: ['avion'], Q1248784: ['avion'],
  Q121289744: ['bateaux'], Q3362987: ['bateaux'], Q12859788: ['bateaux'], Q140424465: ['vehicule:0.6'], Q42889: ['vehicule'],
  Q22704163: ['armes'], Q124078422: ['armes'],
  // ---- Lieux et constructions ----
  Q8502: ['montagne'], Q1330974: ['volcan'], Q169358: ['volcan'], Q8072: ['volcan'], Q4022: ['fleuve'], Q23442: ['ile'], Q112099: ['ile', 'pays'], Q23397: ['lac'], Q8514: ['desert'], Q9430: ['ocean'],
  Q3624078: ['pays'], Q484170: ['ville'], Q515: ['ville'], Q7930989: ['ville'], Q200250: ['ville'], Q1549591: ['ville'], Q748149: ['ville'], Q1093829: ['ville'], Q1131296: ['ville'], Q135396321: ['ville'], Q79007: ['ville'],
  Q13410438: ['geographie'], Q3502482: ['geographie'], Q1620908: ['geographie'], Q2140699: ['vin'],
  Q12280: ['pont'], Q44377: ['tunnel'], Q12518: ['tour'], Q751876: ['chateau'], Q2977: ['cathedrale'], Q11303: ['gratteciel'], Q12323: ['barrage'], Q39715: ['phare'],
  // ---- Nourriture, objets, société, noms ----
  Q3314483: ['fruit'], Q140646522: ['fruit'], Q140358161: ['legume'], Q10373548: ['whisky'], Q2536409: ['cocktail'], Q134768: ['cocktail'], Q3499072: ['gastronomie'],
  Q3501317: ['mode'], Q4845479: ['mode'], Q29583: ['mode'], Q4830453: ['societe:0.5'], Q6881511: ['societe:0.5'],
  Q1028181: ['peinture'], Q3305213: ['peinture'], Q1281618: ['sculpture'], Q28890616: ['sculpture'], Q33231: ['photographie'], Q42973: ['architecture'],
  Q101352: ['noms'], Q12308941: ['noms'], Q11879590: ['noms'], Q202444: ['noms'],
  Q2629720: ['ecologie'], Q574376: ['ecologie'], Q15725976: ['ecologie'], Q608: ['sexualite'], Q8192: ['langue'], Q9779: ['langue'],
};

// Classes trop générales : on ne remonte pas au-delà (évite les ancêtres génériques de l’ontologie et les faux amis).
export const BARRIERES = new Set(['Q5', 'Q4167410', 'Q16521', 'Q55983715', 'Q96251598', 'Q111360549', 'Q21146257', 'Q488383', 'Q215627', 'Q17537576', 'Q386724', 'Q1914636', 'Q1190554', 'Q16686448', 'Q106559804', 'Q3778211', 'Q43229']);
