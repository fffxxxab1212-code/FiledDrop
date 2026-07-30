# FileDrop — Partage de fichiers temporaire

Site de partage de fichiers éphémère : on dépose un fichier, on obtient un
lien sécurisé et impossible à deviner, valable pour une durée choisie.
Passé ce délai, le fichier et ses métadonnées sont supprimés
automatiquement et définitivement.

Stack : **HTML / CSS / JavaScript vanilla** côté frontend,
**Node.js + Express** côté backend. Aucune dépendance frontend lourde
(pas de React/Vue/Angular), aucune base de données externe requise.

---

## 1. Installation

```bash
npm install
cp .env.example .env   # puis ajuster les valeurs si besoin
npm start               # ou : npm run dev (avec nodemon)
```

Le site est alors accessible sur `http://localhost:3000`.

Au premier démarrage, l'application crée automatiquement les dossiers
`uploads/` (fichiers binaires) et `data/` (métadonnées, fichier
`db.json`) s'ils n'existent pas.

## 2. Architecture

```
/config         → configuration centralisée (config.js)
/controllers     → logique métier de l'API
/middleware       → upload (Multer), rate limiting, anti-CSRF, erreurs
/routes           → déclaration des routes REST
/services         → accès aux métadonnées + tâche de nettoyage planifiée
/utils            → génération d'identifiants, validations
/public           → frontend statique (HTML / CSS / JS vanilla)
  /css/style.css
  /js/main.js       → page d'accueil (upload)
  /js/download.js   → page de téléchargement (/file/:id)
  /js/toast.js      → notifications partagées
  /js/helpers.js    → formatage partagé (taille, date, icônes)
/uploads          → fichiers reçus (créé automatiquement, jamais commité)
/data             → métadonnées (db.json, créé automatiquement)
server.js         → point d'entrée
```

Le code est volontairement découpé en petites couches indépendantes
(config / validation / stockage / contrôleur / routes) pour rester
facile à faire évoluer sans toucher au reste.

## 3. API REST

| Méthode | Route                     | Description                              |
|---------|---------------------------|-------------------------------------------|
| POST    | `/api/upload`             | Envoie un ou plusieurs fichiers           |
| GET     | `/api/file/:id`           | Métadonnées publiques d'un fichier        |
| GET     | `/api/file/:id/download`  | Téléchargement du contenu binaire         |
| DELETE  | `/api/file/:id`           | Suppression manuelle anticipée            |
| GET     | `/api/health`             | Vérification de disponibilité du service  |

`POST /api/upload` attend un `multipart/form-data` avec :
- `files` : un ou plusieurs fichiers (champ répété)
- `expiration` : une clé parmi `10m`, `1h`, `24h`, `7d`, `30d` (défaut : `24h`)

Réponse : `{ "files": [{ id, url, name, mimetype, size, createdAt, expiresAt, expirationKey }] }`

## 4. Sécurité mise en œuvre

- **Liens non devinables** : identifiant public de 128 bits d'entropie
  (`crypto.randomBytes`), jamais séquentiel.
- **Nom de fichier disque aléatoire** (UUID v4), totalement déconnecté
  du nom d'origine → aucune fuite d'information, aucun risque de path
  traversal.
- **Validation du type de fichier** : liste blanche de types MIME +
  liste noire d'extensions dangereuses (`.exe`, `.php`, `.js`, etc.),
  vérifiées indépendamment.
- **Limites de taille** configurables (par fichier et par upload
  global) via Multer.
- **Helmet** : en-têtes de sécurité HTTP, CSP stricte, `X-Content-Type-Options`.
- **CORS** configurable par liste blanche d'origines.
- **Rate limiting** : limiteur général + limiteur strict dédié à
  l'upload (`express-rate-limit`).
- **Protection CSRF adaptée** : l'application n'utilise ni cookie ni
  session (voir `middleware/originCheck.js` pour le détail du
  raisonnement), donc la surface CSRF classique est éliminée par
  construction ; une vérification d'origine est appliquée en défense
  en profondeur sur les requêtes qui modifient l'état.
- **Anti-XSS** : toutes les valeurs dynamiques affichées côté frontend
  passent par un échappement HTML (`textContent`), jamais d'insertion
  brute dans le DOM.
- **Gestion d'erreurs centralisée** : aucune stack trace ni détail
  interne n'est jamais renvoyé au client.
- **Confidentialité** : aucun compte, aucun cookie non essentiel,
  aucune donnée personnelle stockée — uniquement ce qui est
  nécessaire au fonctionnement (nom, taille, type, dates).

## 5. Expiration & nettoyage automatique

Chaque fichier a un `expiresAt`. Une tâche planifiée (`node-cron`,
fréquence configurable via `CLEANUP_CRON`, par défaut chaque minute)
parcourt les métadonnées et supprime :
- le fichier binaire sur le disque,
- son enregistrement de métadonnées.

Par sécurité supplémentaire, `GET /api/file/:id` et `/download`
revérifient systématiquement l'expiration même si le cron n'est pas
encore passé : un lien expiré ne sert jamais de contenu.

## 6. Déploiement (Render / VPS)

- Définir `PUBLIC_URL` avec l'URL publique réelle (utilisée pour
  générer les liens partagés).
- Monter `uploads/` et `data/` sur un disque persistant si la
  plateforme utilise un système de fichiers éphémère (ex: disque
  persistant Render), sinon les fichiers seront perdus au redéploiement.
- Définir `CORS_ORIGINS` avec le(s) domaine(s) réel(s) en production.
- Démarrer avec `npm start`.

## 7. Évolutions prévues (architecture déjà prête pour)

- **Mot de passe sur les liens** : ajouter un champ `passwordHash`
  dans `FileRecord` (services/fileService.js) et une vérification
  dans `getFileMeta` / `downloadFile`.
- **Téléchargement à usage unique** : ajouter un flag `singleUse` et
  appeler `deleteFileRecord` juste après le premier `downloadFile` réussi.
- **Chiffrement des fichiers** : chiffrer le flux dans `middleware/upload.js`
  avant écriture disque, déchiffrer au streaming dans `downloadFile`.
- **Antivirus** : brancher un scan (ex: ClamAV) comme étape
  asynchrone après réception dans `uploadFiles`, avant de rendre le
  lien actif.
- **Statistiques** : compteur de téléchargements dans `FileRecord`.
- **Compte utilisateur** : ajouterait une vraie session/cookie — il
  faudra alors ajouter un token CSRF classique en complément
  d'`originCheck.js`.
- **API publique** : les routes existantes sont déjà REST et
  stateless, prêtes à être documentées/exposées publiquement avec une
  clé d'API en plus.
- **QR Code / partage rapide** : purement frontend, à générer à partir
  de l'URL déjà retournée par `/api/upload`.
- **Thème personnalisable** : les couleurs sont centralisées en
  variables CSS (`:root` dans `style.css`), prêtes à être surchargées.

## 8. Licence

MIT — projet fourni comme base de départ, à adapter librement.
