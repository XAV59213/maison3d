# Journal des versions

Les notes de chaque version officielle. Lorsqu’un tag `vX.Y.Z` est poussé, le workflow [release.yml](.github/workflows/release.yml) reprend la section correspondante pour créer la release GitHub. La procédure complète est dans [CONTRIBUTING.md](CONTRIBUTING.md).

Les notes des versions antérieures à v2.10.1 restent sur la [page Releases](https://github.com/XAV59213/maison3d/releases).

## v2.16.2 — Badge Forum Domotique

- Un badge « Discuter sur Forum Domotique » apparaît en haut du README, à côté des autres badges, et mène au [sujet du projet sur Forum Domotique](https://forumdomotique.com/forums/topic/4096-%F0%9F%8F%A1-projet-en-cours-maison-3d-votre-maison-qui-vit-au-rythme-de-la-m%C3%A9t%C3%A9o-dans-home-assistant/).

## v2.16.1 — Correctif : démarrage (redirection des anciennes photos)

- L’intégration ne plante plus au démarrage de Home Assistant (`RuntimeError: Cannot modify frozen list`) : les 4 anciennes URL de photos (`jour`, `nuageux`, `pluie`, `neige`) sont redirigées en 301 par une `HomeAssistantView` (chemins exacts, enregistrés une seule fois, avant le chemin statique), au lieu d’un middleware aiohttp.
- Une erreur sur cette redirection est journalisée en avertissement et n’empêche plus le chargement de l’entrée.
- Un test avec un vrai Home Assistant (setup, rechargement, déchargement, 301) couvre cette régression.

## v2.16.0 — i18n du reste de l’interface FR/EN

- Les réglages détaillés du menu ⚙, le brouillon (💾, ↶, badges), le chrome de la 3D et du plan, les visites intérieures, la présentation, les toasts, alertes et tooltips, ainsi que les dates et heures, suivent la langue de Home Assistant (français ou anglais).
- Le français reste la langue par défaut ; l’anglais est utilisé si Home Assistant est en anglais.
- Un test vérifie que les clés FR et EN sont identiques ; un balayage headless refuse tout français résiduel sur les écrans principaux en anglais.

## v2.15.0 — Visites génériques et chrome mobile 390 px

- Les bâtiments à visiter sont choisis parmi les objets du projet 3D ; les boutons des bâtiments absents sont masqués.
- L’aménagement réaliste de la grange est un projet exemple, actif par défaut et désactivable.
- Le libellé « Volumes intérieurs provisoires » est optionnel et masqué par défaut.
- Le bouton 📷 n’apparaît que si le bâtiment a une photo, sous le nom « Photo de la grange » (ou du bâtiment).
- Sur mobile 390 px (portrait et paysage) : une seule barre d’ambiance en 3D, barre Extérieur/Intérieur dans ☰ Menu, barre du bas repliable aussi dans le panneau.

## v2.14.0 — Aperçus temporaires, Saison fixe, brouillon et remplacements

- Aperçus temporaires des saisons et de la phase de lune : rien n’est enregistré, l’aperçu se termine avec « ↩ Revenir » ou au bout de 2 minutes.
- **Saison fixe** dans le menu ⚙, enregistrée avec 💾 Enregistrer.
- Récupération des modifications non enregistrées (sessionStorage) au retour sur le panneau ou la carte.
- Les réglages du menu ⚙ qui remplacent une option de l’intégration sont signalés, avec « Revenir à l’intégration ».
- Les non-administrateurs peuvent garder une version de ce navigateur (non partagée).

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
