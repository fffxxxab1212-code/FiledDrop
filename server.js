/**
 * server.js
 * ------------------------------------------------------------------
 * Point d'entrée de l'application.
 *
 * Ordre des middlewares (important pour la sécurité) :
 *   1. Helmet (en-têtes de sécurité)
 *   2. CORS (origines autorisées)
 *   3. Compression
 *   4. Parsers (JSON / urlencoded), avec limite de taille
 *   5. Vérification d'origine (protection CSRF)
 *   6. Rate limiting général
 *   7. Fichiers statiques (frontend)
 *   8. Routes API
 *   9. Route "jolie" /file/:id -> sert la page de téléchargement
 *   10. 404 puis gestionnaire d'erreurs centralisé
 * ------------------------------------------------------------------
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const config = require('./config/config');
const fileService = require('./services/fileService');
const cleanupService = require('./services/cleanupService');
const fileRoutes = require('./routes/fileRoutes');
const errorHandler = require('./middleware/errorHandler');
const originCheck = require('./middleware/originCheck');
const { generalLimiter } = require('./middleware/rateLimiter');
const { isValidPublicId } = require('./utils/validators');

const app = express();

// Nécessaire derrière un reverse proxy (Render, Railway, Nginx...) pour que les
// IP et protocoles (https) soient correctement détectés par Express.
app.set('trust proxy', 1);

// --- 1. Sécurité des en-têtes HTTP ---------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // nécessaire pour nos styles inline légers
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

// --- 2. CORS ---------------------------------------------------------
// En production (même domaine frontend/API sur Railway/Render), on autorise
// dynamiquement l'origine de la requête. Cela évite les blocages CORS
// quand PUBLIC_URL n'est pas défini explicitement.
app.use(
  cors({
    origin: (origin, cb) => {
      // Pas d'origine (requête serveur à serveur, curl, etc.) → on autorise
      if (!origin) return cb(null, true);

      // Si une liste blanche est configurée, on vérifie l'origine
      if (config.corsOrigins.length > 0) {
        return cb(null, config.corsOrigins.includes(origin));
      }

      // Sinon on autorise l'origine de la requête (le frontend et l'API
      // sont servis depuis le même domaine Express)
      cb(null, true);
    },
    methods: ['GET', 'POST', 'DELETE'],
    credentials: false,
  })
);

// --- 3. Compression des réponses -------------------------------------
app.use(compression());

// --- 4. Parsers (payload JSON limité, pas utile pour l'upload qui est
//        en multipart mais nécessaire pour d'éventuels futurs endpoints) --
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// --- 5. Protection CSRF adaptée (voir middleware/originCheck.js) -----
app.use(originCheck);

// --- 6. Rate limiting général -----------------------------------------
app.use('/api', generalLimiter);

// --- 7. Fichiers statiques du frontend ---------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// --- 8. Routes API -------------------------------------------------------
app.use('/api', fileRoutes);

// --- 9. Route "jolie" : /file/:id sert la page de téléchargement -------
// (le JS côté client lit l'id dans l'URL et interroge l'API)
app.get('/file/:id', (req, res) => {
  // La page en elle-même est un simple gabarit statique, mais on interdit
  // sa mise en cache pour garantir que le JS qu'elle contient revérifie
  // systématiquement, à chaque visite, l'état réel du lien auprès de l'API.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (!isValidPublicId(req.params.id)) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'download.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

// --- 10. 404 pour tout le reste de l'API --------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route inconnue.' });
});

// --- Gestionnaire d'erreurs centralisé -----------------------------------
app.use(errorHandler);

/** Démarrage du serveur après préparation du stockage. */
async function start() {
  await fileService.ensureStorageReady();
  cleanupService.startCleanupJob();

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Serveur démarré sur http://localhost:${config.port} (env: ${config.env})`);
  });
}

start().catch(err => {
  // eslint-disable-next-line no-console
  console.error('Échec du démarrage du serveur :', err);
  process.exit(1);
});

module.exports = app;
