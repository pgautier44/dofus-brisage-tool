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

## Structure

```
src/
  engine/        moteur pur : types, config, RNG seedable, plafonds,
                 probabilités, perte, pose de rune, coach, simulation d'essai
  engine/engine.test.ts   tests Vitest du moteur
  worker/        Web Worker pour la simulation de masse (Estimation)
  components/    composants React de l'interface
  hooks/         état de session (poses, annuler, persistance)
  storage.ts     lecture/écriture localStorage (session, prix, historique)
```
