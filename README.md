<p align="center"><img src="assets/logo.svg" width="560" alt="Maison 3D V2.0"/></p>

<p align="center"><img src="assets/icon.svg" width="110" alt="Icône Maison 3D"/></p>

<p align="center"><img src="assets/maison3d-reference.jpg" width="100%" alt="Maison 3D V2.0 — image exacte validée : maison, rampe à gauche, abri métallique au premier plan et garage à droite"/></p>

> **Image officielle validée :** capture « Maison 3D V2.0 » fournie le 14 novembre 2026, montrant la rampe et les voitures à gauche, l’abri métallique au premier plan, la maison au centre, le garage à droite et la balançoire sur la droite de cette vue. La capture exacte est maintenant publiée sous `assets/maison3d-reference.jpg` (conversion JPEG de la capture fournie, sans changement de composition).

# Maison 3D V2.0 — Home Assistant

Intégration Home Assistant avec **panneau 3D interactif**, **carte Lovelace 3D interactive** et éditeur d'implantation. Ce n'est pas une image statique : la scène utilise Three.js/WebGL et les objets disposent d'une géométrie 3D.

## Installation

> **Version publiée :** [v2.0.0](https://github.com/XAV59213/maison3d/releases/tag/v2.0.0). Les correctifs de fiabilité v2.0.1 sont en préparation dans une nouvelle PR. Ne pas confondre l'image de référence photoréaliste avec le rendu WebGL actuel.

1. HACS → Dépôts personnalisés → `https://github.com/XAV59213/maison3d` → **Intégration**.
2. Télécharger, puis redémarrer Home Assistant.
3. Paramètres → Appareils et services → Ajouter une intégration → **Maison 3D**.
4. Ouvrir **Maison 3D** dans la barre latérale.


## Carte Lovelace 3D interactive

Maison 3D propose aussi une **véritable carte de tableau de bord**, distincte du panneau plein écran.

Après installation de l'intégration et redémarrage de Home Assistant :

1. Ouvrir le tableau de bord → **Modifier le tableau de bord** → menu à trois points → **Ressources** (ou **Paramètres → Tableaux de bord → Ressources** selon la version).
2. Ajouter la ressource `/maison3d-assets/maison3d-card.js`, de type **Module JavaScript**. Il suffit de le faire une seule fois.
3. Ajouter une carte manuelle contenant :

```yaml
type: custom:maison3d-card
title: Maison 3D
height: 500
weather_entity: weather.maison
sun_entity: sun.sun
```

Remplacer `weather.maison` par votre entité météo réelle. Ce paramètre est facultatif : en son absence, la carte utilise la première entité météo disponible. `height` peut varier de 240 à 1400 pixels.

La carte offre une **vue orbitale 3D interactive** (rotation, zoom) et l'ambiance jour/nuit/météo. L'édition détaillée des objets s'effectue dans le panneau **Maison 3D** : menu latéral de Home Assistant. La carte reflète le modèle local dans le navigateur ; **la synchronisation des modifications entre navigateurs et appareils n'est pas encore implémentée**.

⚠️ Le rendu est une scène Three.js composée de géométries 3D : il n'est pas encore une reconstitution photoréaliste identique à la capture officielle du README. Pour installer cette carte, utiliser la version intégrant les changements de la PR de maintenance v2.0.1, non la release v2.0.0.

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

## Dépannage installation

**Après installation HACS**, redémarrez complètement Home Assistant avant de chercher « Maison 3D » dans **Paramètres → Appareils et services**. HACS installe une **Intégration**, pas une carte Lovelace. L'ajout de l'intégration crée l'entrée du panneau dans la barre latérale. Sur mobile, déployez la barre latérale si nécessaire.

- **L'intégration n'apparaît pas** : vérifier dans **Paramètres → Système → Journaux** l'absence d'erreurs `maison3d`, puis vérifier que `/config/custom_components/maison3d/manifest.json` existe. Effectuer un redémarrage complet.
- **La page Maison 3D est vide** : essayer d'ouvrir `/maison3d-assets/index.html` depuis **la même adresse Home Assistant**, puis vérifier l'accès Internet vers jsDelivr (Three.js). Une restriction réseau ou CSP peut empêcher le chargement du moteur 3D.
- **Pas de météo réelle** : vérifier qu'au moins une entité `weather.*` affiche un état utilisable dans **Outils de développement → États**. L'intégration utilise la première entité météo disponible ; `sun.sun` fournit le jour et la nuit.
- **La scène ne mémorise pas les modifications** : le navigateur doit autoriser le stockage local ; utilisez l'export JSON pour une sauvegarde portable entre navigateurs. Les données ne sont pas encore stockées dans Home Assistant.
- **Après une mise à jour HACS** : redémarrer Home Assistant, puis forcer le rechargement de la page (Ctrl+F5 ou vider les fichiers du site en cache) si nécessaire.

**Diagnostic rapide :** depuis un navigateur déjà connecté à Home Assistant, ouvrir `https://VOTRE-HOME-ASSISTANT/maison3d-assets/index.html`. L'URL doit afficher l'éditeur 3D. Tester également le panneau `/maison3d`. En cas d'échec, relever les erreurs du navigateur et les journaux Home Assistant.

### Changements prévus pour v2.0.1

- Nouvelle carte Lovelace `custom:maison3d-card` avec vue WebGL embarquée et météo en direct.
- Enregistrement du panneau réentrant et déchargement prudent, sans redéclarer les chemins statiques lors des rechargements.
- Transmission météo fiable après le chargement du panneau ; exclusion des entités météo `unavailable` et `unknown`.
- Validation stricte des fichiers de scène JSON importés et sélection des objets sans injection HTML.
- Message explicite si la sauvegarde navigateur est inaccessible.

**Important :** les contrôles HACS/Hassfest et les tests de syntaxe ne remplacent pas une validation sur votre propre version de Home Assistant.
