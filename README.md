# Outil de Brisage — Dofus

Petit outil web (sans backend) pour suivre la rentabilité du craft + brisage
d'équipements dans Dofus : coût de craft, runes obtenues, pourcentage de
brisage, et calcul automatique de rentabilité avec code couleur.

## Fonctionnalités

- **Types de runes** : déclare chaque type de rune (PA, PM, Vitalité, ...)
  avec son prix courant à l'hôtel de vente, réutilisable pour tous les essais.
- **Objets** : un objet n'a qu'un nom. Tout le reste (coût de craft, %
  de brisage, runes obtenues) se renseigne essai par essai, puisque ces
  valeurs varient d'une tentative à l'autre (prix des ingrédients qui
  bouge, brisage crafté en lot, etc.).
- **Essais de brisage** : ajoute un essai par brisage réel via "+ Nouvel
  essai", avec le coût total de craft pour cet essai, le nombre d'objets
  obtenus pour ce coût, le pourcentage de brisage, et le détail des runes
  reçues (type, quantité, prix). Chaque essai peut aussi être modifié ou
  supprimé individuellement depuis l'historique ("Détails").
  Les essais s'accumulent et le tableau calcule automatiquement :
  - le prix de craft unitaire **moyen** (moyenne des coûts unitaires de
    chaque essai — informatif),
  - le pourcentage moyen de brisage,
  - la valeur moyenne des runes obtenues par essai (le gain),
  - le gain net **par série** (valeur des runes obtenues − coût total de
    craft de la série, pas le coût unitaire — si tu crafts 10 objets pour
    50 000 K et que le brisage rapporte 47 000 K de runes, c'est une perte
    de 3 000 K, pas un gain),
  - le ratio valeur obtenue / coût total de craft de la série,
  - une étiquette de rentabilité colorée : **Rentable**, **Relativement
    rentable**, **Relativement pas rentable**, **Pas rentable**.
- **Tri du tableau** : clique sur l'en-tête d'une colonne pour trier
  (cliquer de nouveau inverse l'ordre).
- **Historique par objet** : bouton "Détails" pour voir, modifier ou
  supprimer chaque essai individuel.

## Utilisation

Aucune installation nécessaire : c'est une page statique.

- En local : ouvre `index.html` dans un navigateur, ou sers le dossier
  (`python3 -m http.server`) puis va sur `http://localhost:8000`.
- En ligne : active **GitHub Pages** sur ce dépôt (Settings → Pages →
  Deploy from branch `main` / dossier racine).

## Stockage des données

Toutes les données (types de runes, objets, essais) sont sauvegardées dans
le `localStorage` du navigateur. Elles restent donc sur l'appareil/navigateur
utilisé et ne sont pas partagées ailleurs.

## Seuils de rentabilité

Le ratio = (valeur des runes obtenues) / (coût total de craft de la série), moyenné sur tous les essais :

| Ratio        | Statut                     |
|--------------|-----------------------------|
| ≥ 1.2        | Rentable                    |
| 1.0 – 1.2    | Relativement rentable        |
| 0.8 – 1.0    | Relativement pas rentable    |
| < 0.8        | Pas rentable                 |

Ces seuils sont ajustables directement dans `app.js` (`RATIO_THRESHOLDS`).
