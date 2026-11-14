# Photos météo Maison 3D

Ces photos sont utilisées par la vue photo quand l'option **« Photos météo jour/nuit »** est active (intégration `weather_photos_enabled`, carte `weather_photos`, ou case du menu ⚙ Images / météo) et que la photo principale est la photo officielle. Chaque emplacement peut être remplacé par une image personnalisée (voir le README principal, « Personnaliser les images »).

## Photos jour / nuit générées (utilisées automatiquement)

Elles sont générées à partir de `../maison3d-reference.jpg` par `scripts/generate_variant_images.py` (retouche Pillow/numpy, aucune image externe). La photo de référence et les anciennes photos ont été recadrées (1286×914) pour retirer la fausse interface qui était dessinée dessus (barres d'icônes, menu « Jour/Soir/Nuit/Météo/Saisons/Soleil »).

| Météo | Jour | Nuit |
|---|---|---|
| Clair | `clair-jour.jpg` | `clair-nuit.jpg` |
| Nuageux | `nuageux-jour.jpg` | `nuageux-nuit.jpg` |
| Pluie | `pluie-jour.jpg` | `pluie-nuit.jpg` |
| Neige | `neige-jour.jpg` | `neige-nuit.jpg` |
| Vent | `vent-jour.jpg` | `vent-nuit.jpg` |
| Orage | `orage-jour.jpg` | `orage-nuit.jpg` |
| Brouillard | `brouillard-jour.jpg` | `brouillard-nuit.jpg` |

Pour les régénérer : `python3 scripts/generate_variant_images.py`.

## Anciennes photos (conservées pour les configurations existantes)

`jour.jpg`, `nuageux.jpg`, `pluie.jpg`, `neige.jpg` restent accessibles sous `/maison3d-assets/images/…`, mais ne sont plus choisies automatiquement. Elles peuvent être (ré)importées depuis l'archive `maison3d_images_meteo.zip` avec :

```bash
python3 scripts/import_weather_images.py maison3d_images_meteo.zip
```
