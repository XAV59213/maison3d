# Journal des versions

Les notes de chaque version officielle. Lorsqu’un tag `vX.Y.Z` est poussé, le workflow [release.yml](.github/workflows/release.yml) reprend la section correspondante pour créer la release GitHub. La procédure complète est dans [CONTRIBUTING.md](CONTRIBUTING.md).

Les notes des versions antérieures à v2.10.1 restent sur la [page Releases](https://github.com/XAV59213/maison3d/releases).

## v2.13.0 — Nettoyage, délai de grâce Netatmo et i18n

- Un unique workflow `release.yml` crée la release GitHub lorsqu’un tag `vX.Y.Z` est poussé (à la place des anciens `publish-v2-x-y.yml`).
- Les quatre anciennes photos sans suffixe (`jour`, `nuageux`, `pluie`, `neige`) sont retirées du dépôt ; leurs URL historiques restent servies.
- Le délai de grâce Netatmo passe à 15 minutes par défaut (réglable de 0 à 60) et tolère aussi l’état `unavailable` au démarrage de Home Assistant.
- L’éditeur de carte et les libellés principaux de l’iframe suivent la langue de Home Assistant (français et anglais).

## v2.12.0 — Capteurs de diagnostic et lumières extérieures la nuit

- Cinq capteurs de diagnostic (mode des saisons, saison active, photo affichée, ambiance météo, jour/nuit), calculés par Home Assistant.
- Lumières extérieures la nuit : halos placés sur la photo, optionnellement cliquables pour allumer ou éteindre.

## v2.11.0 — Option Animations Auto / Toujours / Jamais

- Réglage **Animations** dans le menu ⚙ : Auto (suit `prefers-reduced-motion`, mouvement ralenti à ~20 %), Toujours, ou Jamais.

## v2.10.1 — Floutage d’une plaque d’immatriculation

- Plaque visible sur la photo réelle de l’intérieur de la grange floutée (toutes les tailles livrées).
