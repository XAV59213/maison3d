<div align="center">
  <img src="assets/logo.svg" width="540" alt="Logo Maison 3D" />

# 🏡 Maison 3D

**Votre propriété animée dans Home Assistant · Photographies météo · Saisons · Lune · Vue 3D**

[![Release](https://img.shields.io/github/v/release/XAV59213/maison3d?label=Version&color=1086e8)](https://github.com/XAV59213/maison3d/releases/latest)
[![Tests](https://github.com/XAV59213/maison3d/actions/workflows/validate.yml/badge.svg)](https://github.com/XAV59213/maison3d/actions/workflows/validate.yml)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Int%C3%A9gration-41BDF5?logo=homeassistant&logoColor=white)](https://www.home-assistant.io/)
[![HACS](https://img.shields.io/badge/HACS-Int%C3%A9gration-1d89d7)](https://www.hacs.xyz/)

<img src="assets/maison3d-reference.jpg" alt="Vue officielle de la propriété avec rampe, maison, jardin, abri métallique et garage" width="100%" />

*Image officielle de référence, validée par le propriétaire : maison au centre, rampe et voitures à gauche, abri métallique au premier plan, garage et jardin à droite.*

[**Installation**](#-installation-avec-hacs) · [**Galerie météo**](#-galerie-des-vraies-photos-météo) · [**Carte Lovelace**](#-carte-lovelace-prête-à-lemploi) · [**Capteurs**](#-configurer-les-capteurs-home-assistant) · [**Tests des effets**](#-tester-tous-les-états)

</div>

---

## ✨ Présentation

**Maison 3D** est une **intégration Home Assistant** installable via HACS, en catégorie **Intégration** et non en catégorie « Carte / Dashboard ».

Elle propose deux vues complémentaires :

| Vue | Description |
|:--|:--|
| 🖼️ **Photo réelle animée** | Photographies de la propriété et effets météo superposés : pluie, neige, nuages, soleil, vent, orages et saisons |
| 🏡 **Scène Three.js** | Maquette géométrique indépendante en 3D avec zoom, rotation, vues caméra et édition d'objets |

**À savoir :** une photo est une image fixe enrichie d'animations ; ce n'est pas un modèle 3D rotatif. La maquette Three.js reste distincte et ne reproduit pas encore exactement la photographie officielle.

### Fonctionnalités

- 🌤️ Ambiance selon l'entité météo et le soleil de Home Assistant.
- 🌓 **Lune dessinée directement dans le ciel**, y compris en journée lorsque sa phase est disponible, avec huit formes lunaires.
- ☀️ Commandes **Jour**, **Nuit réelle** et **Auto** : changement immédiat de l'ambiance photographique.
- 🌧️ Gouttes de pluie et reflets graphiques ; ❄️ flocons et voile hivernal.
- ⚡ Éclairs visibles en mode orage ; 💨 rafales de vent ; ☁️ nuages mobiles.
- 🌸 Pétales de printemps, ☀️ rayons d'été, 🍂 feuilles d'automne, ❄️ chute de neige hivernale.
- 🎚️ Intensité des animations de **0 à 200 %**.
- 🎮 **Prévisualisation manuelle de chaque état**, sans modifier les entités Home Assistant.
- 🩺 Sélection de capteurs et état de disponibilité depuis l'intégration.
- 🎨 **19 emplacements d'images configurables** pour les météos, saisons et phases lunaires.

## 🖼️ Choisir sa propre photo — v2.3.6

Chaque utilisateur peut désormais utiliser **sa propre photographie de maison** comme arrière-plan fixe, avec toutes les animations Home Assistant au-dessus. L'image officielle livrée est utilisée si aucune image n'est renseignée ou si l'URL choisie est inaccessible.

**Exemple :** déposez `ma-maison.jpg` dans `/config/www/maison3d/`, puis renseignez `/local/maison3d/ma-maison.jpg`.

- **Configuration globale :** Paramètres → Appareils et services → **Maison 3D** → **Configurer** → **Image principale**. Le choix s'applique au panneau Maison 3D et aux cartes qui ne définissent pas leur propre photo.
- **Configuration par carte Lovelace :** éditeur visuel de la carte → **Image principale de la propriété** → URL personnalisée et **Vérifier et prévisualiser**. La carte a priorité sur la configuration globale.
- **Panneau photo :** bouton **⚙ Images / météo** → **Image principale personnalisée**, avec bouton de contrôle et aperçu. Ce choix local au navigateur peut remplacer la valeur globale dans le panneau complet.
- **Priorité en mode carte :** URL de la carte → URL de l'intégration → photo officielle. **Priorité dans le panneau :** URL locale facultative → URL de l'intégration → photo officielle.
- **Formats :** URL `/local/...`, `/maison3d-assets/...`, `/api/...` ou HTTPS. Une image accessible depuis le navigateur est nécessaire. Les URLs non valides sont refusées.

### ✦ Activer ou désactiver les effets

La configuration de l'intégration propose **Activer les effets météo, lumineux et saisonniers**. L'éditeur Lovelace permet de laisser la valeur héritée, de l'activer ou de la désactiver pour une carte précise.

Dans la vue photo, **✦ Effets ON / ○ Effets OFF** et la case **Activer les effets météo, lumineux et saisonniers** permettent une bascule locale immédiate. Quand les effets sont désactivés, la photo de la propriété reste affichée sans pluie, neige, orage, lune dessinée, coloration météo ou assombrissement nocturne. La météo Home Assistant reste reçue, et les effets pourront être réactivés. Le choix manuel local de la vue est enregistré dans le navigateur.

Exemple de carte :

```yaml
type: custom:maison3d-card
title: Ma maison
height: 600
base_image_url: /local/maison3d/ma-maison.jpg
effects_enabled: true
```

## 🏡 Une photographie unique, une maison vivante

La **photographie officielle est l'arrière-plan fixe par défaut**. La maison, les voitures, les bâtiments et le jardin conservent **exactement leur perspective** ; les variations de météo, de saison, de luminosité et de phase lunaire sont dessinées **par-dessus**.

- **En automatique** : les capteurs Home Assistant déterminent le jour/la nuit, la pluie, la neige, le vent et les nuages ; le capteur lunaire fait évoluer la lune visible dans le ciel.
- **En mode test** : forcer pluie, neige, orage, vent, soleil, nuit, saison ou phase lunaire modifie uniquement les effets graphiques.
- **Photos alternatives (facultatif)** : une case « Utiliser les images météo alternatives » dans **⚙ Images / météo** réactive les quatre images livrées ou les images personnalisées. Elle est **désactivée par défaut**. Cela ne modifie pas le modèle 3D, qui reste indépendant.

Cette approche privilégie la continuité de la propriété et une ambiance vivante plutôt que des changements répétés de photographies.

## 📸 Galerie des vraies photos météo

Les quatre photographies alternatives ci-dessous sont **incluses dans le dépôt** depuis **v2.3.1**, mais ne sont **plus sélectionnées automatiquement par défaut**. Pour les utiliser, activer « Utiliser les images météo alternatives » dans le panneau **⚙ Images / météo**. Aucun chargement manuel n'est nécessaire.

<table>
<tr>
<td align="center" width="50%">
  <strong>☀️ Jour ensoleillé</strong><br/>
  <img src="custom_components/maison3d/www/images/jour.jpg" alt="Photo de la propriété par beau temps" width="100%"/><br/>
  <sub>jour.jpg</sub>
</td>
<td align="center" width="50%">
  <strong>☁️ Ciel nuageux</strong><br/>
  <img src="custom_components/maison3d/www/images/nuageux.jpg" alt="Photo de la propriété par ciel couvert" width="100%"/><br/>
  <sub>nuageux.jpg</sub>
</td>
</tr>
<tr>
<td align="center">
  <strong>🌧️ Pluie</strong><br/>
  <img src="custom_components/maison3d/www/images/pluie.jpg" alt="Photo de la propriété sous la pluie" width="100%"/><br/>
  <sub>pluie.jpg</sub>
</td>
<td align="center">
  <strong>❄️ Neige</strong><br/>
  <img src="custom_components/maison3d/www/images/neige.jpg" alt="Photo de la propriété sous la neige" width="100%"/><br/>
  <sub>neige.jpg</sub>
</td>
</tr>
</table>

Les images sont accessibles depuis le navigateur connecté à Home Assistant :

| Ambiance | URL d'image installée |
|---|---|
| ☀️ Jour | `/maison3d-assets/images/jour.jpg` |
| ☁️ Nuageux | `/maison3d-assets/images/nuageux.jpg` |
| 🌧️ Pluie | `/maison3d-assets/images/pluie.jpg` |
| ❄️ Neige | `/maison3d-assets/images/neige.jpg` |

**Autres ambiances :** le dépôt ne livre pas encore de JPEG distinct pour Nuit, Vent, Orage, chaque saison ou chaque phase lunaire. Le logiciel utilise alors la photo de référence et les effets animés, ou une image personnalisée si vous l'avez configurée.

## 📦 Installation avec HACS

1. Ouvrir **HACS → Dépôts personnalisés**.
2. Ajouter : **`https://github.com/XAV59213/maison3d`**.
3. Choisir la catégorie **Intégration**.
4. Installer Maison 3D puis **redémarrer Home Assistant**.
5. Aller dans **Paramètres → Appareils et services → Ajouter une intégration** et chercher **Maison 3D**.
6. Ouvrir le panneau **Maison 3D** dans la barre latérale.

**Version de cette PR : v2.3.3** (publication après fusion et validation). [Releases officielles](https://github.com/XAV59213/maison3d/releases).

<details>
<summary>Installation manuelle</summary>

Copier le dossier `custom_components/maison3d` vers `/config/custom_components/maison3d`, redémarrer Home Assistant, puis ajouter l'intégration. Le dossier `www/images` fait partie de l'intégration.

</details>

## 🌡️ Configurer les capteurs Home Assistant

Aller dans **Paramètres → Appareils et services → Maison 3D → Configurer**.

| Capteur | Domaine Home Assistant | Utilisation |
|---|---|---|
| 🌤️ Météo | `weather.*` | Condition actuelle |
| ☀️ Soleil | `sun.sun` | Jour et nuit |
| 🌙 Phase lunaire | `sensor.*` | Forme de la lune dessinée sur la photo |
| 🌡️ Température | `sensor.*` | Relevé extérieur |
| 💨 Vent | `sensor.*` | Rafales / mouvement |
| 🌧️ Pluie | `sensor.*` / `binary_sensor.*` | Pluie active |
| ❄️ Neige | `sensor.*` / `binary_sensor.*` | Neige active |
| ☁️ Nuages | `sensor.*` / `binary_sensor.*` | Couverture nuageuse |

Tous les capteurs supplémentaires sont facultatifs. La météo et le soleil peuvent fournir les données de base ; les autres valeurs enrichissent l'animation.

La page de l'appareil Maison 3D propose **un diagnostic général et des diagnostics individuels** : `OK`, `Non configuré`, `Introuvable`, `Indisponible`. Ils vérifient la disponibilité des entités, pas l'exactitude météorologique d'une mesure.

## 🖥️ Carte Lovelace prête à l'emploi

Après installation de l'intégration, ajouter la ressource **Module JavaScript** :

```text
/maison3d-assets/maison3d-card.js
```

Puis ajouter une carte manuelle :

```yaml
type: custom:maison3d-card
title: Maison 3D
height: 600
```

Les capteurs sélectionnés dans l'intégration sont repris automatiquement si la carte ne définit pas de remplacement. L'éditeur visuel de la carte permet de choisir ses propres capteurs et les images de chaque état.

<details>
<summary>Exemple avancé : carte personnalisée</summary>

```yaml
type: custom:maison3d-card
title: Ma propriété
height: 600
weather_entity: weather.maison
sun_entity: sun.sun
moon_entity: sensor.moon_phase
temperature_entity: sensor.temperature_exterieure
wind_entity: sensor.vitesse_vent
rain_entity: binary_sensor.pluie
snow_entity: binary_sensor.neige
cloud_entity: sensor.couverture_nuageuse
images:
  night: /local/maison3d/nuit.jpg
  storm: /local/maison3d/orage.jpg
  wind: /local/maison3d/vent.jpg
  moon_full_moon: /local/maison3d/pleine_lune.jpg
```

**Exemple à adapter** : ces noms d'entités ne sont pas garantis sur votre installation. Les images sous `/local/maison3d/` doivent être placées dans `/config/www/maison3d/`.

</details>

## 🎮 Tester tous les états

Le panneau **⚙ Images / météo** contient une zone **« Tester chaque état »** qui sert à vérifier les effets **sans modifier les vrais capteurs**.

| Test | Effet attendu |
|---|---|
| ☀ Jour | Photo lumineuse / soleil |
| ☾ Nuit | Assombrissement de la photo |
| ☁ Nuages | Photo nuageuse et voile mobile |
| 🌧 Pluie | Gouttes et reflets visuels |
| ❄ Neige | Flocons et atmosphère hivernale |
| 💨 Vent | Rafales et feuilles en mouvement |
| ⚡ Orage | Pluie et éclairs dessinés |
| 🌸 Printemps | Pétales flottants |
| ☀ Été | Rayons de soleil |
| 🍂 Automne | Feuilles emportées |
| ❄ Hiver | Neige et voile froid |

**Phases lunaires :** un sélecteur permet de tester **nouvelle lune**, **premier croissant**, **premier quartier**, **gibbeuse croissante**, **pleine lune**, **gibbeuse décroissante**, **dernier quartier** et **dernier croissant**. La lune apparaît **sur l'image même en journée**. En mode normal, sa phase provient du capteur Home Assistant configuré, s'il est disponible et reconnu.

À droite de la vue photo, les boutons **Printemps, Été, Automne, Hiver et Saisons auto** donnent aussi un accès direct aux démonstrations saisonnières.

Pour retourner aux conditions réelles, utiliser **◉ Revenir à la météo réelle** dans le panneau de test ou **◉ Auto** dans la barre supérieure.

> Les boutons de test sont un **aperçu manuel local**, et ne modifient ni la météo ni le capteur lunaire dans Home Assistant.

## 🌙 Lune, saisons et météo animée

Le module dessine la lune comme un disque lumineux dans le ciel, avec masque de phase, relief discret et halo. En journée, le halo est plus faible ; la lune reste visible tant qu'une phase valide est connue. Si le capteur de phase est absent, on peut tester manuellement les huit phases, mais le programme ne doit pas présenter une phase simulée comme une donnée astronomique réelle.

Les animations météo sont **des effets visuels superposés à une photographie** : pluie, neige, reflets doux, brume, rafales, éclairs, rayons solaires et feuilles. Leur intensité est réglable de **0 à 200 %** et peut être désactivée.

Les saisons suivent le calendrier local en mode Auto ; les boutons de droite permettent de les forcer pour un aperçu. Une vraie photo enneigée présente de la neige sur les éléments de la propriété ; un simple filtre animé ne remplace pas une photographie d'hiver.

## 🎨 Personnaliser les images

**19 images peuvent être remplacées** :

- **Météo et saisons (11)** : `day`, `night`, `cloudy`, `rain`, `snow`, `wind`, `storm`, `spring`, `summer`, `autumn`, `winter`.
- **Phases lunaires (8)** : `moon_new_moon`, `moon_waxing_crescent`, `moon_first_quarter`, `moon_waxing_gibbous`, `moon_full_moon`, `moon_waning_gibbous`, `moon_last_quarter`, `moon_waning_crescent`.

Pour utiliser une photo personnelle :

1. La déposer dans `/config/www/maison3d/`.
2. Saisir son URL (exemple `/local/maison3d/nuit.jpg`) dans le champ correspondant de la carte ou du panneau.
3. Choisir **Tester** pour vérifier le résultat.

Les quatre photos météo installées avec HACS restent disponibles en activant l'option facultative d'images alternatives. La photo officielle reste affichée par défaut. Les réglages du panneau Photo sont enregistrés dans le **navigateur local** ; pour reproduire une configuration sur plusieurs appareils, préférer les options de l'intégration et la configuration YAML de la carte.

## 🍂 Module des quatre saisons — calendrier Home Assistant

Les quatre saisons suivent **la date locale et le fuseau horaire configurés dans Home Assistant** (champ `time_zone`, par exemple `Europe/Paris`). La photo officielle de la propriété reste fixe ; le module `season-effects.js` superpose des animations propres à la saison.

| Saison | Période météorologique (France) | Animation |
|---|---|---|
| 🌸 Printemps | 1er mars – 31 mai | Pétales, teintes printanières |
| ☀️ Été | 1er juin – 31 août | Soleil chaleureux, points lumineux de nuit |
| 🍂 Automne | 1er septembre – 30 novembre | Feuilles en mouvement, tonalité ambrée |
| ❄️ Hiver | 1er décembre – 28/29 février | Flocons, voile hivernal |

**Mode automatique :** la date est vérifiée pendant le fonctionnement de la vue, ce qui permet de changer de saison au passage de minuit, même sans changement de capteur météo. Les conditions météo (pluie, orage, vent, etc.) restent indépendantes et peuvent s'ajouter à l'effet saisonnier.

**Mode manuel :** les cinq boutons fixes à droite permettent de tester Printemps, Été, Automne, Hiver et Auto. Le bouton **◉ Saisons auto** rétablit le calendrier de Home Assistant.

Les saisons météorologiques ne coïncident pas exactement avec les dates astronomiques des équinoxes et solstices.

## 🗺️ Accès rapide aux trois vues — v2.3.5

Les commandes **▣ Photo réelle**, **▤ Plan 2D** et **⬡ 3D éditable** restent accessibles depuis la barre au-dessus de l'image, même lorsque la vue photo est active.

- **Photo réelle** : photographie officielle fixe avec météo, lune et éclairage animés.
- **Plan 2D** : passe au modèle vu de dessus, en réutilisant la caméra de l'ancien bouton « Plan 2D ».
- **3D éditable** : rétablit la caméra 3D orbitale pour explorer la maquette.

Le choix entre plan 2D et vue 3D est mémorisé localement. Il n'est plus nécessaire de rechercher le bouton derrière la photo ; la barre d'outils 3D reste disponible selon le mode présentation ou édition.

## 🏗️ Vue 3D et édition

La scène Three.js distincte propose les vues **Façade, Aérienne, Jardin et Garage**, ainsi que la rotation, le zoom, le déplacement et le redimensionnement des objets. Dans le panneau complet, elle permet également l'**export et l'import JSON**.

La géométrie 3D est approximative et ne doit pas être présentée comme la vraie photographie en volume. Le stockage de la scène s'effectue dans le navigateur ; exporter le JSON pour conserver une sauvegarde.

## 🛠️ Dépannage

<details>
<summary>Maison 3D ne s'affiche pas</summary>

Vérifier que l'intégration a été ajoutée après l'installation HACS, puis **redémarrer Home Assistant**. Actualiser le navigateur (Ctrl + F5). Contrôler la ressource `/maison3d-assets/maison3d-card.js` et tester `/maison3d-assets/index.html`. La vue 3D dépend de Three.js chargé depuis un CDN ; vérifier la connexion réseau si elle reste vide.

</details>

<details>
<summary>La météo ou la lune ne change pas</summary>

Dans **Paramètres → Appareils et services → Maison 3D → Configurer**, vérifier l'identifiant des entités, puis leur état dans **Outils de développement → États**. Éviter `unknown` ou `unavailable`. Quitter le mode Test et réactiver **◉ Auto**.

</details>

<details>
<summary>Le bouton « Nuit réelle » n'a pas d'effet</summary>

La correction de la commande Nuit réelle est incluse dans **v2.3.2**. Vérifier la version installée avec HACS, redémarrer Home Assistant, vider le cache navigateur si nécessaire. La photo doit s'assombrir, même sans fichier de nuit personnalisé.

</details>

<details>
<summary>Une image personnalisée est inaccessible</summary>

Tester l'URL directement depuis Home Assistant. Exemple : `/config/www/maison3d/nuit.jpg` devient `/local/maison3d/nuit.jpg`. Une erreur de nom de fichier ou d'autorisation peut empêcher l'affichage.

</details>

## 🔗 Liens utiles

- [Dépôt GitHub](https://github.com/XAV59213/maison3d)
- [Releases officielles](https://github.com/XAV59213/maison3d/releases)
- [Actions — Validation HACS, Hassfest et tests](https://github.com/XAV59213/maison3d/actions/workflows/validate.yml)
- [Signaler un problème ou proposer une idée](https://github.com/XAV59213/maison3d/issues)

---

<div align="center">

**Maison 3D · Home Assistant · © XAV59213**

*Intégration communautaire non officielle. Les tests automatiques ne remplacent pas un essai visuel sur une instance Home Assistant réelle.*

</div>
