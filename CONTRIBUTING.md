# Contribuer à Maison 3D

## Publier une version

La publication n’est plus faite par un fichier `.github/workflows/publish-vX-Y-Z.yml` par version. Un seul workflow, [`.github/workflows/release.yml`](.github/workflows/release.yml), se déclenche lorsqu’un **tag** `vX.Y.Z` est poussé.

Les releases et tags déjà publiés ne sont pas modifiés.

### Étapes

1. Le travail à publier est déjà sur `main` (après le squash-merge de la PR, titré `Maison 3D — … (#n)`).
2. Mettre à jour le numéro de version au même endroit partout :
   - `custom_components/maison3d/manifest.json` (`version`, sans le préfixe `v`) ;
   - la ligne **Version actuelle : vX.Y.Z** du `README.md`.
3. Ajouter tout en haut de `CHANGELOG.md` (juste sous l’introduction) une section :

   ```markdown
   ## vX.Y.Z — Titre court en français

   Notes de la release, en français.
   ```

   Le titre GitHub sera `Maison 3D vX.Y.Z — Titre court en français`. À défaut de section dans le journal, le fichier `.github/release-notes/vX.Y.Z.md` est utilisé.
4. Un commit `chore: release vX.Y.Z` sur `main` (identité `XAV59213`).
5. Créer et pousser le tag, **sans** republier les tags déjà existants :

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

6. Le workflow vérifie que la version du manifeste correspond au tag, lance tous les tests (Python, JavaScript, headless), puis crée la release GitHub à partir des notes. S’il n’y a pas de notes pour ce tag, le workflow échoue et aucune release n’est créée.

Ne jamais merger ni publier sans l’accord explicite de Xavier.
