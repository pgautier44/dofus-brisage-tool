# Outil de Brisage — Dofus

Petit outil web (sans backend) pour suivre la rentabilité du craft + brisage
d'équipements dans Dofus : coût de craft, runes obtenues, pourcentage de
brisage, et calcul automatique de rentabilité avec code couleur.

## Fonctionnalités

- **Types de runes** : déclare chaque type de rune (PA, PM, Vitalité, ...)
  avec son prix courant à l'hôtel de vente, réutilisable pour tous les essais.
- **Objets** : pour chaque objet, renseigne le coût total de craft et le
  nombre d'objets obtenus pour ce coût (le prix unitaire est calculé
  automatiquement).
- **Essais de brisage** : ajoute un essai par brisage réel, avec le
  pourcentage obtenu et le détail des runes reçues (type, quantité, prix).
  Les essais s'accumulent et le tableau calcule automatiquement :
  - le pourcentage moyen de brisage,
  - la valeur moyenne des runes obtenues,
  - le ratio valeur obtenue / coût de craft,
  - une étiquette de rentabilité colorée : **Rentable**, **Relativement
    rentable**, **Relativement pas rentable**, **Pas rentable**.
- **Tri du tableau** : clique sur l'en-tête d'une colonne pour trier
  (cliquer de nouveau inverse l'ordre).
- **Historique par objet** : bouton "Détails" pour voir/supprimer chaque
  essai individuel.

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

Le ratio = (valeur moyenne des runes obtenues) / (coût de craft unitaire) :

| Ratio        | Statut                     |
|--------------|-----------------------------|
| ≥ 1.2        | Rentable                    |
| 1.0 – 1.2    | Relativement rentable        |
| 0.8 – 1.0    | Relativement pas rentable    |
| < 0.8        | Pas rentable                 |

Ces seuils sont ajustables directement dans `app.js` (`RATIO_THRESHOLDS`).
