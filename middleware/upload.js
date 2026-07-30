/**
 * upload.js (middleware)
 * ------------------------------------------------------------------
 * Configuration de Multer pour la réception des fichiers :
 *  - stockage direct sur disque (pas de buffer mémoire pour rester
 *    scalable avec de gros fichiers)
 *  - nom de fichier aléatoire (jamais le nom d'origine)
 *  - limite de taille et de nombre de fichiers
 *  - filtrage par liste blanche de types MIME + extensions bloquées
 * ------------------------------------------------------------------
 */

const multer = require('multer');
const config = require('../config/config');
const { generateDiskName } = require('../utils/idGenerator');
const { isAllowedFile } = require('../utils/validators');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, generateDiskName(file.originalname));
  },
});

function fileFilter(req, file, cb) {
  const check = isAllowedFile(file.originalname, file.mimetype);
  if (!check.ok) {
    // On transmet une erreur explicite qui sera interceptée par errorHandler
    const err = new Error(check.reason);
    err.status = 415; // Unsupported Media Type
    return cb(err);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: config.maxFilesPerUpload,
  },
});

module.exports = upload;
