<p align="center"><img src="assets/logo.svg" width="560" alt="Maison 3D V2.0"/></p>

<p align="center"><img src="assets/icon.svg" width="110" alt="Icône Maison 3D"/></p>

<p align="center"><img src="assets/maison3d-reference.jpg" width="100%" alt="Maison 3D V2.0 — image exacte validée : maison, rampe à gauche, abri métallique au premier plan et garage à droite"/></p>

> **Image officielle validée :** capture « Maison 3D V2.0 » fournie le 14 novembre 2026, montrant la rampe et les voitures à gauche, l’abri métallique au premier plan, la maison au centre, le garage à droite et la balançoire sur la droite de cette vue. La capture exacte est maintenant publiée sous `assets/maison3d-reference.jpg` (conversion JPEG de la capture fournie, sans changement de composition).

# Maison 3D V2.0 — Home Assistant

Intégration Home Assistant avec panneau 3D interactif et éditeur d'implantation.

## Installation

> **Version en développement :** les corrections V2 sont dans la [PR #1](https://github.com/XAV59213/maison3d/pull/1), pas encore fusionnées. Ne pas interpréter la capture photoréaliste comme une capture de l'application WebGL actuelle.

1. HACS → Dépôts personnalisés → `https://github.com/XAV59213/maison3d` → **Intégration**.
2. Télécharger, puis redémarrer Home Assistant.
3. Paramètres → Appareils et services → Ajouter une intégration → **Maison 3D**.
4. Ouvrir **Maison 3D** dans la barre latérale.

## Référence retenue
La **capture Maison 3D V2.0 fournie explicitement le 14 novembre 2026** est la seule référence visuelle. La scène éditable est une maquette technique et ne reproduit pas encore photoréalistiquement cette image. Les positions et dimensions restent ajustables et approximatives.

Disposition : grange indépendante sur la gauche de la maison, rampe automobile côté gauche vers le stationnement, abri métallique au premier plan, garage à l'extrême droite, balançoire dans le jardin vers la piscine ; murets et paliers pour le dénivelé ; portail coulissant et portillon indépendant.

## Édition
Sélectionner un objet pour modifier sa position X/Z, ses dimensions, son orientation, le dupliquer ou le supprimer. Ajout de nouveaux objets avec l'outil **Ajouter**. Export/import JSON. La sauvegarde automatique utilise le stockage local du navigateur ; pensez à exporter une copie.

## Limites
- Three.js est chargé depuis un CDN, accès Internet requis.
- Aucune commande d'entité Home Assistant (portail, lumière, volets) n'est activée pour le moment.
- L'intégration utilise la **première entité `weather.*` disponible** dans Home Assistant ; si aucune n'est disponible, l'affichage indique une simulation locale. Les données météo viennent de Home Assistant, ce ne sont pas des prévisions générées par Maison 3D.
- La photo de référence n'est pas un mesh 3D : le rendu est un modèle interactif distinct.

## Installation manuelle
Copier `custom_components/maison3d` dans `/config/custom_components/maison3d`, redémarrer, ajouter l'intégration.

## Identité graphique

- Logo vectoriel : [assets/logo.svg](assets/logo.svg)
- Icône vectorielle : [assets/icon.svg](assets/icon.svg)
- Le rendu officiel doit utiliser **uniquement la capture fournie par le propriétaire**. Les montages promotionnels différents sont exclus de ce README.

## Météo et soleil

Le panneau transmet les états de la première entité `weather.*` ainsi que `sun.sun` à la scène WebGL. L'éclairage suit `sun.sun` automatiquement : jour, soir et nuit. Les animations Canvas affichent pluie, neige ou feuilles d'automne selon la condition et la saison ; le bouton **Météo** permet une démonstration pluie/neige/soleil et **Auto** rétablit la météo réelle. Le moteur calcule les saisons à partir du calendrier local.

**Limites à connaître :** premier capteur météo détecté automatiquement (choix explicite à développer), effets 2D superposés à la scène 3D et aucune commande d'appareil Home Assistant. Les animations météo et l'intégration complète n'ont pas encore été validées en conditions réelles sur une instance Home Assistant.
