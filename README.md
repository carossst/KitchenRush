# Kitchen Rush — rally arcade

Le jeu original de ce dépôt reprend les échanges de pickleball en **double 2 contre 2** : **aucune brique**.
Cette branche conserve son moteur `game.js` et sa configuration, corrige les coordonnées de portée et ajoute une interface au doigt avec déplacement libre.

## Jouer et vérifier

- Node **22.14 minimum** (SQLite intégré, encore marqué expérimental sur Node 22).
- Aucun paquet ni clé API nécessaire pour jouer localement.
- `npm start` : http://127.0.0.1:8790 ; classement SQLite persistant.
- `npm test` : moteur, déterminisme FR/USA, rotation, pouvoirs et API HTTP.
- Un hébergement statique / GitHub Pages fonctionne également : les échanges restent jouables en entraînement si le serveur est absent.

## Règles de cette version

Glisser horizontalement, utiliser la souris ou les flèches gauche/droite. En mode avancé seulement, le personnage avance ou recule sur demande ; le renvoi après rebond reste automatique. Tous les envois reviennent dans une même bande de réception : gauche/droite suffit pour jouer. Le glissement tactile et la souris ne déplacent que la largeur ; le mode avancé facultatif rétablit la profondeur au doigt, à la souris et aux quatre flèches. Une barre montre la portée de frappe et une ligne en pointillés indique la visée lorsque la balle est à portée. Se décaler du centre du cercle de réception modifie l’angle du renvoi. Un partenaire piloté par le jeu couvre l’autre moitié, se déplace à vitesse limitée et renvoie uniquement les balles qu’il atteint. Le joueur reste prioritaire lorsqu’il peut frapper. Les deux adversaires se répartissent les renvois ; un coup n’est gagnant que si aucun des deux n’atteint la balle. Les points et vies appartiennent à l’équipe.

- 3 vies, un renvoi = 1 point, un coup gagnant = 3 points supplémentaires.
- Kitchen Rush : 5 renvois sans rater déclenchent 6 secondes à 2 points par renvoi (pas de destruction ni de renvoi automatique supplémentaire).
- Niveau suivant tous les 8 renvois ; accélération progressive plafonnée.
- Premier joueur après 4 renvois, puis tous les 6 renvois.
- Chaque édition contient 10 joueurs. Mélange sans remise parmi les joueurs accessibles, sans répétition immédiate. Portée/ralentissement/volée réflexe dès la manche 1 ; vie/protection en manche 2 ; vitesse/drive en manche 3 ; ATP/smash en manche 4. Les dix identités deviennent accessibles sans jamais changer leur pouvoir.
- Même moteur, mêmes paramètres et mêmes pouvoirs par emplacement dans les deux éditions. Noé Khlif et Jay Devilliers conservent leur identité et pouvoir dans les deux.
- Un seul pouvoir d’équipe à la fois : les charges sont consommées par les renvois du joueur ou du partenaire ; la portée et la vitesse bénéficient aux deux. Aucun changement des associations FR/USA. Un seul effet à la fois ; pas de cumul incontrôlé. Les vies sont plafonnées à 3.
- Première découverte d’un pouvoir : fenêtre native qui suspend le jeu et son chronomètre, puis mémorisation locale.
- Pause manuelle (bouton/P), automatique lors d’un changement d’onglet ou perte de focus.
- Partie de 10 minutes maximum, puis publication possible du score final.

Les neuf effets d’équipe du prototype récent sont adaptés au jeu d’échanges : portée, déplacement, ralentissement, renvoi extérieur, frappe accélérée, sauvetage et vie. Il n’y a pas de multiballe ni d’explosion de briques dans ce mode. Les noms sont des coups de pickleball ; les effets sont des fictions arcade, pas des représentations du style réel des athlètes. Les six capsules supplémentaires propres au casse-briques ne sont pas importées comme telles.

Six profils de manche alternent : angle, milieu, côtés, rythme lent/rapide, ouverture gauche et ouverture droite. Le profil apparaît au-dessus du terrain. Leur vitesse et leur réaction augmentent progressivement, avec un plafond. La nouvelle version de règles sépare les scores des anciennes parties.

## Côté et stratégie avant la partie

Les options tactiques sont repliées par défaut pour démarrer sans préparation. Trois choix indépendants sont mémorisés localement et fixés pour la partie :

- **Gauche / droite** : position du joueur au départ et moitié attribuée au partenaire, même si le joueur traverse le milieu.
- **Construire (drop)** : renvois plus doux avec une courbe plus haute, visant la Kitchen adverse ; le partenaire accompagne une montée décidée par le joueur. L’adversaire a davantage de temps pour défendre.
- **Accélérer (drive)** : renvois plus rapides et plus bas vers le fond ; les contre-attaques adverses arrivent également plus vite. Aucun bonus de points caché.

Les défenseurs suivent maintenant les balles en profondeur et en largeur ; l’évaluation d’un coup gagnant utilise les deux coordonnées. Le serveur mémorise côté et stratégie au démarrage et les réutilise pour le replay : modifier les valeurs lors de la publication ne change pas les règles de la session. Migration additive des colonnes sur une ancienne base SQLite.

### Rôles complémentaires — passage de Thomas

- **Pilier** : le joueur assure son côté, son partenaire se positionne plus haut et prend la priorité sur les balles du milieu, uniquement s’il les atteint. Il peut donc traverser une partie du milieu sans déplacer automatiquement le joueur.
- **Créateur** : le joueur conserve les balles du milieu ; son partenaire couvre son côté et reste en appui. Pas de bonus de points selon le rôle.

Ces rôles sont indépendants du côté et du type de renvoi. Le jeu n’impose pas « droite = pilier » ni « gauche = attaquant ». Le serveur mémorise les trois choix, et les huit combinaisons restent possibles dans les deux langues.

### Sources et limites de l’adaptation

Le texte fourni `YOUTUBE TEXTE OK-noe-khlif-pickleball-pro-transcript-clean-v3.txt` oppose le réflexe de tout driver au travail de drops/dinks et à la construction du point à la Kitchen. Noé parle aussi du choix drive/drop préparé avant un match. Les deux options sont une **adaptation arcade de ce passage**, pas deux recommandations équivalentes attribuées à Noé ni une restitution exhaustive de sa tactique. Les coefficients numériques sont des réglages du jeu.

La transcription complète `bp-thomas-provost-sous-titres.txt` précise le duo avec Émilien Burnel : Thomas, à droite, ralentit son jeu et joue le pilier pendant qu’Émilien crée les occasions à gauche. Il parle aussi des balles du milieu laissées au partenaire et de l’adaptation de la stratégie pendant un match. Le choix Pilier/Créateur adapte ces **deux rôles complémentaires d’une même organisation**, sans prétendre que Thomas a énoncé deux systèmes tactiques nommés. Son passage sur la préparation d’une attaque en deux coups n’est pas assimilé à un bonus automatique « shake and bake ». Les documents privés ne sont pas copiés dans le dépôt. Les anciennes annotations et corrections ne sont pas traitées comme du discours.

## Architecture / sources de vérité

| Fichier | Rôle |
|---|---|
| `config.js`, `game.js` | Configuration et moteur originaux ; calculs balistiques, rebonds, états |
| `players.js` | Catalogue d’identités récupéré du prototype récent |
| `rally-config.js` | Paramètres, associations fixes FR/US, descriptions bilingues, PRNG |
| `rally-rules.js` | Extension du moteur original : placement simplifié, équipes de double, pouvoirs |
| `rally-view.js` | Projection unique pour terrain, personnages, balle et coordonnées du doigt |
| `rally-app.js` | UI bilingue, pause, tutoriels, préférences, clients classement/Kit/GoatCounter |
| `server/model.mjs` | Exécution isolée du même moteur pour chaque replay |
| `server/server.mjs` | Serveur Node portable, API, SQLite, limites de débit, CORS |
| `server/kit.mjs` | Intégration API V4 récupérée du projet récent |

Les anciennes interfaces `ui*.js`, `main.js`, le système premium et `simulate.js` restent dans l’historique et les sources mais ne sont plus chargés par `index.html`. Les simulations de personas ne remplacent pas les tests du moteur ou des essais humains.

## Échange continu, capture et précision

Quand le renvoi est couvert, le même objet balle conserve son identité et repart exactement de la réception adverse, avec un geste de raquette au même instant. Seuls une balle ratée ou un coup gagnant nécessitent un nouveau service. Les déplacements adverses restent bornés ; l’équipe doit battre les deux défenseurs pour marquer le bonus gagnant.

Chaque troisième manche offre une capture automatique sur une frappe du joueur : la balle suit sa raquette pendant 1,8 seconde, puis repart sans nouvelle commande. Aucun point n’est ajouté avant le relâchement, ni deux fois. Ce bonus de manche ne modifie aucun pouvoir de joueur.

Le défi précision est facultatif avant la partie : portée des deux joueurs réduite de 28 %, chaque renvoi d’équipe rapporte un point supplémentaire (2 normalement, 3 pendant Rush). Son classement est séparé, tout comme celui du mode avancé. Les options sont fixées dans la session serveur et non crues à la soumission.

## Défi du jour, historique et partage

Le défi quotidien utilise une graine déterministe à partir de la version des règles et de la date UTC. FR et USA partagent la graine ; côté gauche, drops, rôle Créateur, arcade et précision désactivée sont imposés à tous. Essais illimités. Le serveur fixe la date au démarrage : une fin après minuit reste attachée au jour de la session. En cas de réseau absent, le même tirage se joue localement sans publication différée.

Le classement distingue édition, règles, partie libre/défi, date du défi, style et précision. Les migrations SQLite ajoutent les colonnes sans supprimer les anciennes parties.

`rally-progress.js` conserve sur l’appareil les 20 dernières parties (5 affichées pour l’édition), les joueurs réellement rencontrés et au maximum 100 records de contexte. Noé/Jay gardent une seule identité de collection commune. Données validées, stockage inaccessible ou corrompu toléré. Aucun email, pseudo, token ni journal de déplacements n’y est stocké. Les anciens records des versions précédentes ne sont pas convertis en scores des nouvelles règles.

L’écran de fin indique l’écart au record et le prochain palier de dix points. Le partage natif, la copie ou un champ manuel exportent édition, contexte, date du défi et statut local/vérifié. Un partage de test localhost avertit que l’adresse fonctionne uniquement sur cet ordinateur. En production, l’URL partagée utilise l’origine réellement déployée, sans domaine de production inventé.

## Classement mondial : déploiement séparé du code

GitHub reste le dépôt de référence. GitHub Pages sert les fichiers statiques mais **ne peut pas exécuter le serveur ni contenir la clé Kit**.

Deux possibilités :

1. Déployer ce dépôt sur un hébergement Node avec disque persistant ; lancer `npm start` et exposer le serveur en HTTPS via son proxy.
2. Conserver GitHub Pages et déployer seulement le serveur. Renseigner son URL publique dans `<meta name="kr-api-base" content="https://serveur.example/">` de `index.html`.

Configurer `KR_ALLOWED_ORIGINS` avec les origines autorisées séparées par des virgules, incluant l’origine HTTPS de l’hébergement lui-même et `https://carossst.github.io` si nécessaire. Le serveur se lie par défaut à 127.0.0.1 ; définir `HOST=0.0.0.0` si l’hébergeur le demande. Utiliser un volume persistant pour `KR_DB_PATH`, sauvegarder SQLite, et lancer une seule instance pour cette configuration simple. Derrière un proxy, les quotas portent par défaut sur l’adresse réseau du proxy : régler le proxy ou adapter l’identification IP avant une forte affluence. Aucun en-tête IP fourni arbitrairement par un visiteur n’est cru.

Le protocole utilise des sessions signées par jeton aléatoire à usage unique, des graines serveur et des déplacements X/Y quantifiés à 60 Hz. Le serveur recalcule les scores, rejette les journaux invalides/incomplets, les durées impossibles, les répétitions et les versions différentes. Cela bloque les scores simplement inventés, **pas les bots capables de jouer**. Les sessions non soumises expirent en une heure. Le classement `rally-8` ne mélange pas les anciens scores casse-briques. Les pseudos ne sont pas des identités authentifiées.

Le serveur fourni n’est pas déployé automatiquement par cette branche. Tant que l’API n’est pas connectée, l’interface indique clairement « entraînement » ; elle n’invente pas de classement mondial.

## Kit / statistiques

Copier `.env.example` dans un secret d’hébergement ou un `.env` local ignoré par Git. Pour charger ce dernier : `node --env-file=.env server/server.mjs`.

- `KIT_API_KEY` uniquement côté serveur ; ne jamais la placer dans HTML/JavaScript public.
- `KIT_SIGNUP_ENABLED=true` pour activer le formulaire natif une fois les confirmations vérifiées.
- Formulaires : FR `10107559`, EN `10110844`.
- Tags : intérêt `25052091`, FR `25052095`, EN `25052096`.
- Contact créé inactif, puis associé au formulaire et aux deux tags. Le double opt-in dépend des réglages de confirmation du formulaire Kit : tester les deux langues avant ouverture.
- Aucun email dans SQLite, localStorage, les logs du jeu ou GoatCounter.
- GoatCounter réutilisé : `kitchenrush.goatcounter.com`. Opt-in désactivé par défaut, DNT/GPC respectés, événements sans email/pseudo/URL complète. Les essais localhost ne sont pas envoyés.

Les clés du déploiement Sites existant ne sont pas présentes dans ce dépôt et n’ont pas été transférées.

## Vérification visuelle

Le canvas possède un repère fixe de 480 × 760. Sa taille CSS conserve ce rapport ; la zone Kitchen vaut 7/22 de chaque demi-terrain avant compression de perspective côté adverse. La même projection transforme les coordonnées du doigt et le contact de la raquette. Le pouvoir Volée bloquée agrandit visiblement la raquette ; son tutoriel compare avant/après. La frappe utilise un instant de contact commun à la balle et au geste, suivi d’un accompagnement de 230 ms. L’en-tête se réduit pendant une partie sur mobile pour laisser les vies et l’effet visibles.

Avant publication : tests automatisés, essais tactiles réels, lecture FR/EN, première découverte d’un pouvoir, perte de focus, erreurs réseau, hors ligne, et réception des deux confirmations Kit sur le nouvel hébergement.

## Présentation arcade

Le moteur et les scores restent ceux de `rally-8`. La présentation ajoute une balle contrastée et une traînée courte, des impacts/rebonds, un compteur de série d’équipe, un objectif visible de 8 renvois par manche et des palettes de terrain variant avec la progression existante. Aucun multiplicateur caché n’est ajouté au combo. Les pouvoirs sont matérialisés sur le terrain ; les quatre personnages ont une animation de déplacement.

`rally-feedback.js` conserve au maximum 16 événements et 9 points de traînée. Les effets utilisent le temps simulé : la pause les suspend et une nouvelle partie les remet à zéro. La préférence système de réduction des mouvements désactive les traînées et la marche animée et réduit les déplacements des effets. Pas de secousse d’écran ni de clignotement plein écran.

Le son est désactivé par défaut, mémorisé localement et activé par un bouton accessible. Des notes courtes sont synthétisées dans le navigateur après un geste utilisateur : frappe, rebond, point gagnant, pouvoir et balle ratée. Aucun fichier audio ni service externe requis. Les effets n’altèrent ni la physique ni le replay serveur.

### Démarrer et reprendre

Un bouton Jouer est disponible directement sur le terrain, en plus du bouton principal. En pause (bouton, perte de focus ou changement d’onglet), une invitation Reprendre reste visible au centre. Espace lance la partie ou bascule pause/reprise. Les sons et effets sont facultatifs : leur absence ne doit pas empêcher le démarrage.

### Correspondances des éditions

Chaque paire FR/USA référence la même définition de pouvoir, figée et partagée : même effet, durée, charges et points. Le guide des joueurs affiche le nom de son équivalent. Noé Khlif et Jay Devilliers sont communs. Les dix paires sont testées à pleine vie et avec une vie manquante. Les noms et les traductions n’interviennent pas dans les règles.

## Mises à jour et installation bilingue

Le service worker prépare un cache complet sans forcer son activation. Un bouton propose la mise à jour et reste bloqué pendant une partie, y compris en pause. L’utilisateur peut l’installer après la fin ; la page ne recharge qu’après cette action explicite. Le cache fournit un ensemble cohérent de fichiers, sans intercepter les API. L’historique n’est pas effacé. Les manifestes FR/USA conservent la langue de lancement.

Validation de cette évolution : tests du moteur, paires FR/USA, capture, stockage, worker, défi quotidien à minuit UTC, classements isolés et replay des options verrouillées. Les essais navigateur utilisent une base de test en mémoire ; ils ne publient aucun score réel de production. Installation sur appareil physique et hébergement public restent à réaliser.

Validation finale : **58 tests passent**. Parcours navigateur FR complet jusqu’à la fin, historique/collection, copie du résultat et score accepté par l’API locale après replay. Défi quotidien EN avec paramètres imposés, mouvement en profondeur et précision sur tablette, affichage mobile sans débordement, rechargement hors connexion, mise à jour bloquée en partie puis activée après fin avec historique conservé. Tests d’installation sur téléphone physique non effectués.
