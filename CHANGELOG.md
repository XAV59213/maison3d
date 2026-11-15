# Journal des versions

Les notes de chaque version officielle. Lorsqu’un tag `vX.Y.Z` est poussé, le workflow [release.yml](.github/workflows/release.yml) reprend la section correspondante pour créer la release GitHub. La procédure complète est dans [CONTRIBUTING.md](CONTRIBUTING.md).

Les notes des versions antérieures à v2.10.1 restent sur la [page Releases](https://github.com/XAV59213/maison3d/releases).

## v2.12.0 — Capteurs de diagnostic et lumières extérieures la nuit

- Cinq capteurs de diagnostic (mode des saisons, saison active, photo affichée, ambiance météo, jour/nuit), calculés par Home Assistant.
- Lumières extérieures la nuit : halos placés sur la photo, optionnellement cliquables pour allumer ou éteindre.

## v2.11.0 — Option Animations Auto / Toujours / Jamais

- Réglage **Animations** dans le menu ⚙ : Auto (suit `prefers-reduced-motion`, mouvement ralenti à ~20 %), Toujours, ou Jamais.

## v2.10.1 — Floutage d’une plaque d’immatriculation

- Plaque visible sur la photo réelle de l’intérieur de la grange floutée (toutes les tailles livrées).
