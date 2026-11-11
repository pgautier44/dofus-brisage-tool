# Simulateur de forgemagie — Exo PA

Outil local d'entraînement à la forgemagie Dofus, pour s'exercer à poser l'exo PA
sur l'**Anneau Cérémonial du Seigneur des Rats** (niveau 131) sans risquer un
véritable anneau en jeu. Aucune donnée ne quitte votre navigateur (tout est
stocké en `localStorage`).

## Méthode en 5 lignes

1. Un **moteur pur** (`src/engine/`, sans dépendance React) calcule les plafonds de
   lignes, la probabilité de succès critique de chaque rune, et la perte appliquée
   en cas d'échec ou de succès neutre (le puits absorbe en premier, le reste retire
   des points sur une ligne au hasard, avec 25% de chance de viser le PA si les
   conditions sont réunies).
2. Un **coach** (`src/engine/coach.ts`) suit l'objet en deux phases : tant que le
   PA n'est pas acquis (phase A), il sécurise Cri puis Do avant de tenter le Ga Pa —
   dès que ces minimums sont atteints, peu importe la probabilité (jamais > 50%,
   c'est normal : il faut quand même tenter) ; une fois le PA acquis (phase B), il
   ne conseille plus que des runes de poids < 10 (jamais Cri/Do/Ga Pa), pour ne plus
   jamais risquer de reperdre le PA. Les minimums (panneau "Objectifs") sont
   modifiables par vous : visez plus haut que les minimums par défaut si vous voulez
   l'anneau le plus fort possible, ou désactivez une ligne (champ vide = aucune
   exigence) si vous l'acceptez sacrifiable.
3. L'**écran d'entraînement** affiche les jauges de l'objet, le conseil du coach, la
   grille de runes (avec raccourcis clavier) et le journal des poses ; on peut
   partir de "Mon anneau HDV" ou d'un anneau tiré au hasard, et annuler sa dernière
   pose.
4. L'onglet **Estimation** fait tourner, dans un Web Worker, un grand nombre
   d'essais automatiques pilotés par le coach (prix des runes éditables), et
   affiche taux de réussite, coûts moyens/80e percentile et un histogramme du
   nombre de Ga Pa posées.
5. L'onglet **Historique** journalise automatiquement chaque essai mené à son
   terme (objectif atteint), avec un bouton pour tout effacer.
6. L'onglet **Coach en direct** sert à guider l'essai réel en jeu (pas une
   simulation) : partage ta fenêtre Dofus, calibre une fois les zones de chaque
   ligne, puis "Lire l'écran" fait l'OCR (Tesseract.js, 100% local) et propose les
   valeurs lues — à valider ou corriger avant que le coach les utilise. La saisie
   manuelle reste toujours disponible en complément ou en remplacement complet de
   la lecture d'écran.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir l'URL affichée (`http://localhost:5173` par défaut).

Autres commandes utiles :

```bash
npm test        # suite de tests du moteur (Vitest)
npm run build   # build de production dans dist/
npm run preview # sert le build de production localement
```

## À savoir en utilisant l'outil

Les marges de "% Critique" (min OK = max = 4) et "Dommages" (min OK à 1 point du
max) sont très serrées : un échec collatéral sur l'une de ces deux lignes suffit à
repasser sous le minimum requis, ce qui redéclenche un cycle de réparation. C'est
voulu (ça reflète la vraie difficulté de cette forgemagie) et pas un bug — c'est
justement ce que l'onglet Estimation permet de quantifier avant de se lancer pour
de vrai.

## Coach en direct : le partage d'écran en pratique

- Le partage d'écran (`getDisplayMedia`) n'est autorisé par les navigateurs qu'en
  contexte sécurisé — `localhost` convient (donc `npm run dev`/`preview` sans
  problème), mais pas un accès par IP en HTTP simple.
- **Calibrage** : capture une image fixe, choisis une ligne dans la liste de puces,
  puis dessine un rectangle serré autour du nombre affiché par Dofus pour cette
  ligne (pas besoin d'inclure le "/max"). Chaque zone est mémorisée en
  `localStorage` et reste valable tant que la fenêtre du jeu garde la même
  position à l'écran — redessine juste la ou les zones concernées si tu la
  déplaces ou changes de résolution.
- **Lire l'écran** découpe chaque zone calibrée sur l'image du moment et lance
  Tesseract.js (OCR 100% local, aucun envoi réseau) dessus. Si le jeu affiche un
  format "valeur/max" (ex: `39/40`), seule la valeur avant le `/` est gardée.
- Les valeurs lues s'affichent dans des champs éditables **avant** validation :
  corrige toute erreur de lecture avant de cliquer "Valider ces valeurs".
- Le panneau "Saisie / correction manuelle" est toujours visible, indépendamment
  de la lecture d'écran : tu peux t'en servir seul (sans jamais partager l'écran),
  ou pour corriger une ligne après une lecture OCR ratée.
- L'OCR peut se tromper sur de petits caractères stylisés ; vise une zone bien
  cadrée, en zoomant l'interface du jeu si besoin pour des caractères plus grands.

## Structure

```
src/
  engine/        moteur pur : types, config, RNG seedable, plafonds,
                 probabilités, perte, pose de rune, coach, simulation d'essai
  engine/engine.test.ts   tests Vitest du moteur
  worker/        Web Worker pour la simulation de masse (Estimation)
  screen/        capture d'écran + OCR (Tesseract.js) pour le Coach en direct
  components/    composants React de l'interface
  hooks/         état de session (poses, annuler, persistance) + état du Coach en direct
  storage.ts     lecture/écriture localStorage (session, prix, historique, objectifs, calibrage)
```
