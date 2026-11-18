# Pilote avec un coach ou un club

Objectif : tester Kitchen Rush avec un petit groupe réel (un coach, un club, un groupe WhatsApp) et mesurer ce qui se passe, sans suivre les personnes.

## 1. Préparer le lien et l'affiche
1. Ouvrir `poster.html?lang=fr` (affiche à imprimer), saisir le nom du club ou du coach, cliquer « Mettre à jour le QR ».
2. Le QR contient un lien balisé, par exemple `https://carossst.github.io/KitchenRush/fr.html?duel=deep&src=club-mon-club`. L'étiquette `src` est gardée sur l'appareil et ajoutée aux statistiques.
3. Imprimer (ou enregistrer en PDF) ; copier aussi le lien pour le groupe de discussion.

## 2. Message à copier
« Où allez-vous placer la prochaine balle ? Cinq essais pour trouver la zone. Dans le navigateur, sans compte. » + le lien balisé.

## 3. Mesurer (7 jours)
- **Toujours disponible, sur l'appareil** : onglet « Progrès » → « Copier mes données de test » (matchs, durée, causes des points). Demander aux testeurs de coller ce texte dans un message.
- **Statistiques agrégées (facultatif, éteintes par défaut)** : activer GoatCounter (voir HANDOFF.md, section « Analytics »). Événements : `landing`, `drill-start`, `drill-complete`, `duel-start`, `duel-second`, `duel-complete`, `daily-start`, `daily-complete`, `tutorial-complete`, `daily-share`, avec le segment `src-club-mon-club`. Comptages agrégés, pas de cohorte nominative.
- Premier signal : sur un petit groupe observé, noter qui commence le défi, qui atteint une cible, qui termine et qui relance spontanément. Les ratios des événements agrégés ne constituent pas des taux de conversion par joueur.

## 4. Après la semaine
Demander au coach ce que les joueurs ont dit (trop facile ? trop dur ? contrôles tactiles ?), lire les données copiées, noter les réglages à faire (pièces, difficulté) dans HANDOFF.md.

## Ce qu’on reprend du Pickleball Rules Quiz

- Son parcours club avec QR et liens balisés inspire l’affiche. Le bouton de la page d’arrivée ouvre l’exercice annoncé de cinq balles. [La page clubs du quiz](https://github.com/carossst/pickleballgame/blob/main/clubs/index.html)
- Son mode de reprise des erreurs inspire le lien entre la défaite, l’exercice conseillé et la revanche. Les deux jeux gardent leurs activités propres. [Modes du quiz](https://github.com/carossst/pickleballgame/blob/main/README.md)
- Le résultat du Quotidien propose un lien d’invitation au **Quotidien en cours**. Après minuit UTC, ce lien ouvre le nouveau défi. Le quiz adapte sa cible au joueur, tandis que Kitchen Rush conserve une graine et une fenêtre de visée communes.

Avant de distribuer l’affiche, scanner le QR sur iPhone et Android en portrait, ouvrir le défi, atteindre une cible et revenir au menu. Dans le pilote, distinguer nouvelle partie dans la session et retour le lendemain. Les comptages GoatCounter optionnels sont agrégés. Ils ne suffisent pas à calculer un taux de retour par joueur.
