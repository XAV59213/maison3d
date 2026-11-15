# Photos météo Maison 3D

Ces photos sont utilisées par la vue photo quand l'option **« Photos météo jour/nuit »** est active (intégration `weather_photos_enabled`, carte `weather_photos`, ou case du menu ⚙ Images / météo) et que la photo principale est la photo officielle. Chaque emplacement peut être remplacé par une image personnalisée (voir le README principal, « Personnaliser les images »).

> **Photo d'exemple :** la photo officielle et ses variantes montrent une maison réelle, fournie uniquement comme exemple prêt à l'emploi. Remplacez-la par la vôtre : **⚙ Images / météo → 📤 Envoyer une photo**, éditeur de la carte, ou option **Image principale** de l'intégration.

**Format :** toutes les photos fournies sont en WebP (qualité 80, 1286×914), visuellement équivalentes aux anciens JPEG.

## Photos jour / nuit générées (utilisées automatiquement)

Elles sont générées à partir de `../maison3d-reference.webp` par `scripts/generate_variant_images.py` (retouche Pillow/numpy, aucune image externe). La photo de référence et les anciennes photos ont été recadrées (1286×914) pour retirer la fausse interface qui était dessinée dessus (barres d'icônes, menu « Jour/Soir/Nuit/Météo/Saisons/Soleil »).

| Météo | Jour | Nuit |
|---|---|---|
| Clair | `clair-jour.webp` | `clair-nuit.webp` |
| Nuageux | `nuageux-jour.webp` | `nuageux-nuit.webp` |
| Pluie | `pluie-jour.webp` | `pluie-nuit.webp` |
| Neige | `neige-jour.webp` | `neige-nuit.webp` |
| Vent | `vent-jour.webp` | `vent-nuit.webp` |
| Orage | `orage-jour.webp` | `orage-nuit.webp` |
| Brouillard | `brouillard-jour.webp` | `brouillard-nuit.webp` |

Pour les régénérer : `python3 scripts/generate_variant_images.py`.

## Anciennes photos (conservées pour les configurations existantes)

`jour.webp`, `nuageux.webp`, `pluie.webp`, `neige.webp` restent accessibles (les anciennes adresses en `.jpg` aussi) sous `/maison3d-assets/images/…`, mais ne sont plus choisies automatiquement. Elles peuvent être (ré)importées depuis l'archive `maison3d_images_meteo.zip` avec :

```bash
python3 scripts/import_weather_images.py maison3d_images_meteo.zip
```
