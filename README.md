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

## Comment ça tourne

`index.html` est une page unique (HTML, CSS et JS, sans dépendance externe).
Elle s'appuie sur le runtime des **Artifacts claude.ai** :

| Besoin | Capacité Artifact |
|---|---|
| Sauvegarde partagée (héros, campagnes, chat, journal, combat, bestiaire) | `db` |
| MJ Claude (appelle Claude avec des outils) | `sample` |
| Export JSON | `downloads` |

Hors de claude.ai, la page s'ouvre mais affiche un message : la base de données et Claude ne sont pas disponibles.
Pour la publier, ouvre `index.html` dans une session Claude et demande de la publier comme Artifact avec les capacités
`db`, `sample` et `downloads` (retire l'enveloppe `<html><body>` : le contenu de `<body>` est la page).

> Important : le MJ Claude utilise l'abonnement de **la personne qui regarde la page**, pas celui du propriétaire.

### Modèle de données (`db`)

```
pj/{id}                         héros (global)
bestiaire/{id}                  créatures (global) — voir data/bestiaire.json
campagnes/{id}                  nom, ton, monde, résumé, mj, groupe (ids de héros)
campagnes/{id}/table/{msg}      chat
campagnes/{id}/journal/{id}     journal
campagnes/{id}/combat/etat      ennemis, ordre d'initiative, tour, round
```

## Tests

Les tests utilisent Playwright avec une base simulée (`tests/mock.js`) et un MJ scripté.
Ils ne contactent ni la vraie base ni Claude.

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

Un test statistique de `sim2.js` peut échouer de temps en temps (tirages aléatoires), et la vérification
« rechargement » de `sim.js` dépend du navigateur de test.

## Règles simplifiées

- Jet d'attaque : d20 + modificateur + bonus de maîtrise (+2 au niveau 1) contre la CA ; 20 naturel = critique (dés doublés), 1 naturel = raté.
- Les sorts coûtent des **PM** : c'est une simplification maison des emplacements de sorts.
- Les valeurs d'XP par danger (DG 1 à 10) et les budgets de rencontre sont approximatifs.
- Les créatures sont originales, sans reprise de monstres protégés.
