# Photos météo Maison 3D

Ce dossier est prévu pour quatre photographies issues de l'archive approuvée `maison3d_images_meteo.zip`.

| Fichier à ajouter | Ambiance |
|---|---|
| `day.jpg` | Soleil / jour |
| `cloudy.jpg` | Nuageux |
| `rain.jpg` | Pluie |
| `snow.jpg` | Neige |

Extraire les fichiers à l'aide de :

```bash
python3 scripts/import_weather_images.py maison3d_images_meteo.zip
```

Puis versionner ces 4 JPEG. La vue photo essaie de les afficher automatiquement s'ils sont présents et utilise sinon la photo officielle de référence. Aucune image météo n'est reconstituée à partir d'un visuel fictif.
