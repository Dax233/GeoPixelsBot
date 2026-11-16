# Localisation française de GhostPixel Bot

Base : Dax233/GeoPixelsBot, commit `efda7d87cadbb27954f58041d8bccbdf9fce20a2`, métadonnées 0.4.3. Branche : `feat/i18n-french`. Modifications locales datées du 16 novembre 2026, sous GPL-3.0 ; auteurs d’origine Dax233 et nymtuta conservés. Le fichier `LICENSE.md` reste inchangé.

## Choisir la bonne copie

- `ghostBot.user.js` : source destinée à la contribution amont. Détection de la langue du navigateur (`fr`, `en`, `zh`), anglais pour les autres langues. Sélecteur dans le panneau. Aucune langue imposée à tous les utilisateurs.
- Copie personnelle : générer un fichier distinct avec `npm run build:personal -- <chemin>/ghostBot.fr.user.js`. Français par défaut ; un choix mémorisé reste prioritaire. Nom marqué « Français (local) » et mises à jour amont désactivées dans cette copie pour éviter d’écraser la traduction. Aucun nouveau numéro de version officiel.

Le livrable personnel préparé pendant l’audit se trouve dans `../GeoPlacer-Audit/distribution/ghostBot.fr.user.js`. Ce fichier est généré, hors du diff destiné à l’amont. Il conserve `unsafeWindow`, les correspondances de site et la licence ; le seul nouveau droit est `GM_info`, utilisé pour lire la version des métadonnées.

## Installation et retour arrière

1. Dans Tampermonkey, exporter une sauvegarde du script original et de ses réglages. Ne pas démarrer le bot.
2. Désactiver le script original pour éviter deux instances. Créer un nouveau script, puis remplacer tout son contenu par celui de la copie française personnelle. Enregistrer. Dans ses paramètres, vérifier que la recherche automatique de mises à jour est désactivée.
3. Pour une vérification totalement locale, utiliser la recette navigateur ci-dessous. Pour votre contrôle d’affichage personnel sur GeoPixels, tenir compte des conditions du service : aucune autorisation de l’extension n’a été établie. Si ce contrôle est autorisé, recharger la page, ouvrir le panneau, vérifier les libellés et **ne jamais cliquer sur Démarrer**. Aucun compte ou jeton n’est nécessaire pour les tests fournis.
4. Le panneau doit afficher `v0.4.3`, comme Tampermonkey. Changer la langue puis recharger pour vérifier sa mémorisation. Réduire, rétablir et masquer le panneau ne démarrent pas le bot.
5. Pour revenir à l’original, désactiver la copie française, réactiver le script sauvegardé puis recharger. Ne pas effacer `ghostBotConfig_v2` : le script original retrouve ses paramètres. `ghostBotLanguage_v1` peut rester, il est ignoré par la version originale.

Ne pas activer simultanément les deux copies. Un changement de nom ou d’URL de téléchargement dans un futur fork doit être volontaire ; conserver l’URL Dax233 pour le `ghostBot.user.js` destiné à sa PR est intentionnel.

## Ce qui est traduit

63 entrées centralisées dans `MESSAGES` couvrent titres fonctionnels, modes, boutons, état initial, recharge, dessin par lot, attente, surveillance, déconnexion, fin de construction, notification, progression, pixels corrects et réparés, estimation de durée, options, aides, info-bulles, noms accessibles et diagnostics connus du bot. Les métadonnées proposent aussi une description française.

`Pixels corrects` désigne `total - remaining`, qui peut inclure des pixels déjà présents avant la session. Le traduire par « pixels placés » serait trompeur. Les couleurs « gratuites » gardent exactement le sens et la liste définis par l’auteur.

`Intl.NumberFormat` produit par exemple `2 954 / 2 261 547` avec des espaces insécables françaises et `0,1 %`. Les durées utilisent `j`, `h`, `min`, `s`, par exemple `39 j 13 h`. La largeur CSS de la barre garde son point décimal et la formule d’estimation reste inchangée.

Le changement de langue conserve les nœuds DOM, les écouteurs, le mode, les cases cochées et les paramètres du bot. Il redessine seulement les textes et les statistiques déjà connues ; il ne recharge pas les données du dessin. La langue est stockée dans `ghostBotLanguage_v1`, séparément de `ghostBotConfig_v2`. Un stockage refusé laisse l’interface utilisable pour la session.

## Repli et limites

Une traduction absente utilise l’anglais ; une langue inconnue utilise l’anglais. Une clé inconnue reste visible pour faciliter son diagnostic. Les trois dictionnaires possèdent les mêmes paramètres dynamiques.

Le nom de produit, les noms de langue du sélecteur (Français / English / 中文), les identifiants techniques (`Colors`, `tileImageCache`, `g_id_onload`), les codes HTTP et les abréviations de niveaux de journal restent des identifiants. Les réponses arbitraires du serveur et les piles d’exception brutes restent disponibles dans leur langue originale pour le diagnostic. Les commentaires chinois du code sont conservés : leur présence dans le fichier n’est pas une présence de chinois dans le panneau français.

Les anciennes chaînes des fonctions métier servent d’identifiants de messages à `translateMessage`. Cette frontière permet de garder ces fonctions octet pour octet identiques. Après une mise à jour amont, les tests d’empreintes et le recensement doivent être revus pour repérer un message ajouté ou reformulé.

La version visible provient de `GM_info.script.version`. Si cette API est absente dans un autre environnement, `v?` est affiché au lieu d’inventer une version. Ni les endpoints, ni l’authentification, ni les jetons, ni les limites, ni les retries, ni les calculs d’énergie, ni les stratégies, ni la maintenance n’ont été modifiés.

## Validation reproductible

Prérequis : Node 22.23.2 utilisé pour cet audit et Git avec l’historique du commit amont disponible.

```powershell
npm ci --ignore-scripts
npm run check
npm run test:browser
```

`npm run check` exécute la vérification syntaxique puis 13 tests Node/jsdom. Les tests instrumentent uniquement leur copie en mémoire pour accéder aux fonctions d’affichage. Aucun point d’entrée de test n’est ajouté au script distribué. Un manifeste SHA-256 vérifie 26 déclarations protégées et compare ses valeurs à l’amont dans Git.

La recette navigateur utilise Edge installé en mode headless, ou Chromium installé pour Playwright. Elle sert une page factice sur `127.0.0.1`, bloque les requêtes externes et remplace `fetch`, XMLHttpRequest, WebSocket et `synchronize` par des fonctions qui échouent. Aucun clic sur Démarrer. Les données de progression et les états sont injectés dans l’affichage seulement. Les captures ne représentent pas une session réelle de GeoPixels.

Pour refaire aussi la capture d’origine :

```powershell
node scripts/visual-check.mjs ../GeoPlacer-Audit/evidence/dax233-efda7d8.user.js docs/screenshots
```

Les captures couvrent les trois langues et le français en fenêtre de 390 px. Aucun débordement de texte détecté. Cela ne certifie ni tous les niveaux de zoom, ni tous les appareils mobiles, ni la sandbox Tampermonkey réelle.

**Non réalisés** : test dans Tampermonkey 5.5.1, test Firefox/Safari réel, placement, connexion, authentification, utilisation de jeton, test de maintenance sur le service. Des défauts amont de fin de construction et de gestion d’erreur sont documentés dans l’audit ; cette contribution ne les corrige pas.

## Contribution et mises à jour

Le README amont invite les Pull Requests. Préférer une PR ciblée sur cette localisation. Une proposition est fournie dans `PROPOSITION-PR.md`. Aucun push, aucune PR, aucun fork distant et aucune release n’ont été créés.

Le dépôt original est conservé comme remote `upstream`. Après validation seulement, créer le fork distant, ajouter son URL comme `origin`, puis pousser la branche sans `--force`. Pour récupérer les corrections futures : `git fetch upstream`, puis examiner `git merge upstream/main` sur cette branche ; résoudre les conflits de textes, actualiser le manifeste après revue du changement métier amont, refaire tous les contrôles et régénérer la copie personnelle. Ne pas simplement modifier les empreintes pour faire passer un test.
