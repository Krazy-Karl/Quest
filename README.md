# Quest — Grimoire de Campagne

Un outil de table pour jeu de rôle fantasy (règles inspirées de D&D 5e), jouable dans le navigateur.
Fiches de personnage, dés, inventaire et équipement, campagnes multiples, journal, combat avec initiative,
Monstropedia de 58 créatures originales, et un **Maître du Jeu Claude** (ou un MJ humain).

Interface sombre façon jeu vidéo (panneaux cerclés d'or, dés polyédriques, illustrations SVG, sons synthétisés).

## Fonctionnalités

- **Héros** : 6 caractéristiques (FOR, DEX, CON, INT, SAG, CHA), tirage 4d6 réparti selon la classe avec bonus de race,
  PV, PM (mana), CA calculée depuis l'armure, 18 compétences, états, équipement sur silhouette, sac avec icônes.
- **Campagnes** : chacune a son monde, son chat, son journal, sa mémoire résumée et son groupe de héros.
- **Combat** : attaques d20 contre la CA, critiques, avantage/désavantage, sorts (PM, sauvegarde, soins),
  ennemis suivis (CA, PV), initiative et tours, jets de mort, repos court/long, XP et niveaux, rencontres aléatoires.
- **MJ Claude** : il raconte ; le code gère tous les chiffres (dés, CA, dégâts, PM) via des outils.
- **Monstropedia** : filtres, tri, illustrations, XP par danger, tirage de butin, envoi direct au combat.
- **UX** : raccourcis clavier (1-9 attaques, N tour suivant, / chat), taille de texte, mobile, sons coupables.

## Trois façons de jouer

| | Où | Sauvegarde | MJ | Plusieurs joueurs |
|---|---|---|---|---|
| **Artifact claude.ai** | claude.ai | base de l'Artifact | Claude (abonnement du joueur) | oui, par invitation e-mail (Éditeur) |
| **Solo** | page web (GitHub Pages ou fichier) | navigateur | humain, ou Claude avec ta clé API | non |
| **Table en ligne** | page web + Firebase | Firestore, partagée | humain, ou Claude (clé API de l'hôte) | oui, avec un simple lien |

`src/app.html` est la source unique. `npm run build` produit :
- `index.html` : version autonome (Pages), qui ajoute `standalone/shim.js` (base locale ou Firestore, appel de l'API Anthropic, téléchargements) ;
- `dist/artifact.html` : le contenu à publier comme Artifact claude.ai (capacités `db`, `sample`, `downloads`).

## Jouer à plusieurs (table en ligne)

Une « table » est un code secret de 12 caractères (`ABCD-EF23-GH45`). Chaque joueur ouvre le lien de la table : héros, chat, dés,
combat et journal sont synchronisés en direct. Il faut un petit projet Firebase **gratuit** (formule Spark) :

1. Va sur https://console.firebase.google.com → **Ajouter un projet** (Google Analytics inutile).
2. **Build → Authentication → Commencer → Anonyme → Activer.** Puis **Settings → Authorized domains** : ajoute `TON-PSEUDO.github.io`.
3. **Build → Firestore Database → Créer une base** (mode production, région proche de toi). Onglet **Règles** : colle le contenu de
   `firestore.rules`, puis **Publier**.
4. **Paramètres du projet → Vos applications → Web (`</>`)** : copie l'objet `firebaseConfig` dans `firebase-config.js`.
   Ces valeurs ne sont pas secrètes ; la sécurité vient des règles.
5. Fusionne la branche dans `master` : le workflow `.github/workflows/pages.yml` publie le site. Dans **Settings → Pages**,
   choisis **Source : GitHub Actions**. (Un dépôt privé exige un compte GitHub payant pour Pages ; le site publié est public.)
6. Ouvre le site → **Créer une table** → ⚙ → **Copier le lien** → envoie-le à tes joueurs.

### MJ Claude à plusieurs

- Un joueur avec une **clé API Anthropic** (⚙ → clé) devient **hôte** (onglet Monde → « Devenir l'hôte du MJ Claude »).
  Son navigateur répond à tous les messages des joueurs : il doit rester ouvert. Les réponses sont facturées sur sa clé.
- Les autres joueurs n'ont besoin d'aucune clé. Sans hôte, passe en MJ humain.
- La clé reste dans le navigateur de l'hôte (visible via ses outils de développement) ; ne la partage jamais.

### MJ et joueurs

- Celui qui **crée la campagne** est le **MJ** (onglet Monde → « Devenir le MJ » / « Prendre le rôle de MJ » pour changer).
- **Le MJ** voit tout : PV et CA exacts des ennemis, monde, outils de combat, Monstropedia complet, et l'onglet **Écran du MJ**
  (notes privées enregistrées automatiquement).
- **Les joueurs** voient les ennemis avec un simple état (*Indemne, Blessé, Mal en point, Agonisant, Vaincu*), sans PV ni CA,
  ne peuvent ni modifier le monde ni gérer le combat, et ont un Monstropedia réduit (nom, type, habitat, description).
  Les messages de jet cachent la CA de l'ennemi, et le MJ Claude a pour consigne de ne jamais révéler les PV exacts.
- Tant qu'aucun MJ n'est désigné (anciennes campagnes), tout le monde voit tout.
- **Notes privées** : en ligne, elles sont écrites sous `rooms/{code}/private/{uid}/…` et seules les règles Firestore
  (`request.auth.uid == uid`) en autorisent la lecture : seul le navigateur qui les a écrites les relit, ce qui veut dire qu'elles
  ne suivent pas le MJ d'un appareil à l'autre. **Après une mise à jour, republie `firestore.rules` dans la console Firebase**
  (Firestore Database → Règles → Publier), sinon n'importe quel joueur connecté pourrait lire ces notes.
- Le masquage est **visuel** : la base contient les chiffres réels, et un joueur qui sait inspecter son navigateur pourrait
  les lire. Entre amis, ça suffit.

### Sécurité et limites

- Quiconque a le code peut **lire et modifier** la table. Ne le donne qu'à tes joueurs ; il est impossible de lister les tables.
- Aucun mot de passe ni rôle (chaque joueur peut modifier tous les héros) : le jeu repose sur la confiance entre joueurs.
- Quotas gratuits Firebase (Spark) : largement suffisants pour une table (un message, un jet ou un changement de fiche = une écriture ;
  chaque joueur envoie un battement de présence toutes les 20 s).

## Comment ça tourne dans claude.ai

| Besoin | Capacité Artifact |
|---|---|
| Sauvegarde partagée | `db` |
| MJ Claude | `sample` |
| Export JSON | `downloads` |

> Dans claude.ai, le MJ Claude utilise l'abonnement de **la personne qui regarde la page**, pas celui du propriétaire.

### Modèle de données

```
pj/{id}                         héros (global)
bestiaire/{id}                  créatures (global) — voir data/bestiaire.json
campagnes/{id}                  nom, ton, monde, résumé, mj, hôte, groupe (ids de héros)
campagnes/{id}/table/{msg}      chat
campagnes/{id}/journal/{id}     journal
campagnes/{id}/combat/etat      ennemis, ordre d'initiative, tour, round
presence/{joueur}               battement de présence (table en ligne)
```
En ligne, tout est placé sous `rooms/{code}/`.

## Tests

Playwright, avec une base simulée (`tests/mock.js`) et un MJ scripté ; rien ne contacte la vraie base ni Claude.

```bash
npm install
cd tests
node sim.js    # parties complètes, campagnes, persistance, migration
node sim2.js   # tirage des stats, noms anglais, migration des anciennes stats
node sim3.js   # attaques, critiques, avantage, sorts, PM, ennemis, outils du MJ
node sim4.js   # initiative, jets de mort, repos, XP, niveaux, compétences, armures
node sim5.js   # Monstropedia : filtres, combat, butin
node sim6.js   # journal
node sim7.js   # kit de départ pour d'anciens héros
```

`multi.js` teste la table en ligne avec le **vrai SDK Firebase** sur l'émulateur Firestore (règles de sécurité comprises),
deux joueurs, l'hôte MJ et l'API Anthropic simulée :

```bash
npm run emulator   # terminal 1 (Java requis)
npm run serve      # terminal 2
cd tests && node multi.js
```

Un test statistique de `sim2.js` peut échouer de temps en temps (tirages aléatoires).

## Règles simplifiées

- Jet d'attaque : d20 + modificateur + bonus de maîtrise (+2 au niveau 1) contre la CA ; 20 naturel = critique (dés doublés), 1 naturel = raté.
- Les sorts coûtent des **PM** : c'est une simplification maison des emplacements de sorts.
- Les valeurs d'XP par danger (DG 1 à 10) et les budgets de rencontre sont approximatifs.
- Les créatures sont originales, sans reprise de monstres protégés.
