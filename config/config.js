/**
 * config.js
 * ------------------------------------------------------------------
 * Point d'entrée unique pour toute la configuration de l'application.
 * Tout est lu depuis les variables d'environnement (voir .env.example)
 * avec des valeurs par défaut sûres pour le développement local.
 * ------------------------------------------------------------------
 */

const path = require('path');
require('dotenv').config();

// Racine du projet (utile pour construire des chemins absolus fiables)
const ROOT_DIR = path.join(__dirname, '..');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // URL publique utilisée pour générer les liens de partage
  // (ex: https://monsite.local ou https://mon-app.onrender.com)
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',

  // Dossiers de stockage
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT_DIR, 'uploads'),
  dataDir: process.env.DATA_DIR || path.join(ROOT_DIR, 'data'),
  dbFile: path.join(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'), 'db.json'),

  // Limites d'upload
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 200, // par fichier
  maxFilesPerUpload: parseInt(process.env.MAX_FILES_PER_UPLOAD, 10) || 10,
  maxTotalSizeMb: parseInt(process.env.MAX_TOTAL_SIZE_MB, 10) || 500, // par upload (tous fichiers confondus)

  // Extensions/MIME autorisées (liste blanche = plus sûr qu'une liste noire).
  // Modifiable facilement ici sans toucher au reste du code.
  allowedMimeTypes: [
    // Images
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/x-icon',
    // Documents
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/rtf',
    // Archives
    'application/zip', 'application/x-7z-compressed', 'application/x-rar-compressed',
    'application/gzip', 'application/x-tar',
    // Audio / vidéo
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm', 'video/quicktime',
    // Divers sûrs
    'application/json',
  ],

  // Extensions explicitement interdites même si le MIME semble correct
  // (double protection contre les fichiers exécutables déguisés).
  blockedExtensions: [
    '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr',
    '.js', '.jse', '.vbs', '.vbe', '.wsf', '.wsh', '.jar', '.php',
    '.phtml', '.asp', '.aspx', '.jsp', '.cgi', '.dll', '.app', '.dmg',
  ],

  // Durées d'expiration disponibles, exposées telles quelles au frontend.
  // La clé est stockée avec chaque fichier ; la valeur est en millisecondes.
  expirationOptions: {
    '10m': { label: '10 minutes', ms: 10 * 60 * 1000 },
    '1h': { label: '1 heure', ms: 60 * 60 * 1000 },
    '24h': { label: '24 heures', ms: 24 * 60 * 60 * 1000 },
    '7d': { label: '7 jours', ms: 7 * 24 * 60 * 60 * 1000 },
    '30d': { label: '30 jours', ms: 30 * 24 * 60 * 60 * 1000 },
  },
  defaultExpiration: '24h',

  // CORS : liste blanche d'origines, séparées par des virgules dans .env
  // Exemple: CORS_ORIGINS=https://monsite.com,https://admin.monsite.com
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),

  // Fréquence du nettoyage des fichiers expirés (syntaxe cron)
  cleanupCron: process.env.CLEANUP_CRON || '* * * * *', // chaque minute

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // fenêtre de 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300, // requêtes générales
    maxUploads: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX, 10) || 20, // uploads sur la fenêtre
  },

  // Longueur de l'identifiant public (dans l'URL /file/:id). Non devinable.
  publicIdBytes: 16, // 16 octets -> ~128 bits d'entropie, encodés en base62
};

module.exports = config;
