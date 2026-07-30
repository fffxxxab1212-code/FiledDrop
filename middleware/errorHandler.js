/**
 * errorHandler.js
 * ------------------------------------------------------------------
 * Gestionnaire d'erreurs centralisé. Toutes les routes délèguent leurs
 * erreurs ici via next(err). Objectif : ne jamais renvoyer de stack
 * trace ou de détail interne au client (fuite d'information), tout en
 * gardant des logs utiles côté serveur.
 * ------------------------------------------------------------------
 */

const multer = require('multer');
const config = require('../config/config');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // On interdit la mise en cache de toutes les réponses d'erreur
  // pour éviter qu'un navigateur ne conserve une erreur 404/500
  // et ne la resserve sans recontacter le serveur.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Erreurs Multer (taille de fichier, nombre de fichiers, etc.)
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `Fichier trop volumineux (max ${config.maxFileSizeMb} Mo).`,
      LIMIT_FILE_COUNT: `Trop de fichiers (max ${config.maxFilesPerUpload}).`,
      LIMIT_UNEXPECTED_FILE: 'Champ de fichier inattendu.',
    };
    return res.status(400).json({ error: messages[err.code] || 'Erreur lors du téléversement.' });
  }

  // Erreurs métier avec un status explicite (ex: type de fichier refusé)
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const publicMessage = status >= 500
    ? 'Une erreur interne est survenue. Merci de réessayer plus tard.'
    : (err.message || 'Requête invalide.');

  res.status(status).json({ error: publicMessage });
}

module.exports = errorHandler;
