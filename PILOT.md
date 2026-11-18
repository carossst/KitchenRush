# Pilote avec un coach ou un club

Objectif : tester Kitchen Rush avec un petit groupe réel (un coach, un club, un groupe WhatsApp) et mesurer ce qui se passe, sans suivre les personnes.

## 1. Préparer le lien et l'affiche
1. Ouvrir `poster.html?lang=fr` (affiche à imprimer), saisir le nom du club ou du coach, cliquer « Mettre à jour le QR ».
2. Le QR contient un lien balisé, par exemple `https://carossst.github.io/KitchenRush/fr.html?src=club-mon-club`. L'étiquette `src` est gardée sur l'appareil et ajoutée aux statistiques.
3. Imprimer (ou enregistrer en PDF) ; copier aussi le lien pour le groupe de discussion.

## 2. Message à copier
« Vous visez où ? Essayez le Duel de Kitchen Rush : vous choisissez où part chaque balle, contre une IA. Gratuit, dans le navigateur, sans compte. » + le lien balisé.

## 3. Mesurer (7 jours)
- **Toujours disponible, sur l'appareil** : onglet « Progrès » → « Copier mes données de test » (matchs, durée, causes des points). Demander aux testeurs de coller ce texte dans un message.
- **Statistiques agrégées (facultatif, éteintes par défaut)** : activer GoatCounter (voir HANDOFF.md, section « Analytics »). Événements : `landing`, `duel-start`, `duel-second`, `duel-complete`, `daily-start`, `daily-complete`, `tutorial-complete`, `daily-share`, avec le segment `src-club-mon-club`. Comptages agrégés, pas de cohorte nominative.
- Premier signal : combien de personnes terminent un premier duel (`duel-complete` / `landing`), puis combien en lancent un second (`duel-second`). Objectifs de départ : au moins 40 % finissent un premier duel, au moins 20 % en lancent un second.

## 4. Après la semaine
Demander au coach ce que les joueurs ont dit (trop facile ? trop dur ? contrôles tactiles ?), lire les données copiées, noter les réglages à faire (pièces, difficulté) dans HANDOFF.md.
